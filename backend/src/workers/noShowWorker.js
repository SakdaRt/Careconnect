import { processNoShowBatch } from '../services/jobService.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Run the no-show worker: scan all assigned jobs system-wide that have passed
 * the grace period and auto-cancel them with full hirer refund.
 *
 * Safe to call on any schedule — idempotency is guaranteed at the DB level
 * via the `AND status = 'assigned' RETURNING id` guard inside _cancelNoShowJob.
 *
 * @param {{ limit?: number }} options
 * @returns {{ total: number, processed: number, failed: number, durationMs: number }}
 */
async function runNoShowWorker({ limit = 100 } = {}) {
  const startTime = Date.now();
  console.log(`[NoShowWorker] Starting scan — runAt: ${new Date().toISOString()}`);

  const result = await processNoShowBatch(limit);
  const durationMs = Date.now() - startTime;
  const adminOverride = result.adminOverride ?? 0;
  const batchLimitHit = result.batchLimitHit ?? false;

  if (result.total === 0) {
    console.log(`[NoShowWorker] No overdue assigned jobs found — duration: ${durationMs}ms`);
  } else {
    console.log(
      `[NoShowWorker] Scan complete — total: ${result.total}, processed: ${result.processed}, failed: ${result.failed}, adminOverride: ${adminOverride}, batchLimitHit: ${batchLimitHit}, duration: ${durationMs}ms`
    );
  }

  if (adminOverride > 0) {
    console.error(
      `[NoShowWorker][ALERT] ${adminOverride} job(s) flagged settlement_mode=admin_override — manual review required. Query: SELECT * FROM jobs WHERE cancellation_reason='caregiver_no_show' AND settlement_mode='admin_override' ORDER BY cancelled_at DESC;`
    );
  }

  if (batchLimitHit) {
    console.warn(
      `[NoShowWorker][WARN] Batch limit (${limit}) hit — additional overdue jobs may be waiting. Consider increasing limit or reducing cron interval.`
    );
  }

  // Write audit log (fire-and-forget)
  try {
    await query(
      `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
       VALUES ($1, NULL, 'no_show_scan', 'system', $2, NOW())`,
      [
        uuidv4(),
        JSON.stringify({
          total: result.total,
          processed: result.processed,
          failed: result.failed,
          adminOverride,
          batchLimitHit,
          durationMs,
          limit,
        }),
      ]
    );
  } catch (auditErr) {
    console.error('[NoShowWorker] Failed to write audit log:', auditErr.message);
  }

  return { ...result, durationMs };
}

/**
 * Top-level wrapper for cron mount.
 * Catches unexpected errors so a single DB outage cannot crash the cron scheduler.
 */
async function triggerNoShowScan() {
  try {
    await runNoShowWorker();
  } catch (error) {
    console.error('[NoShowWorker][CRITICAL] Scan failed — skipping this tick:', error.message);
  }
}

export { runNoShowWorker, triggerNoShowScan };

if (process.argv[1]?.includes('noShowWorker.js')) {
  runNoShowWorker()
    .then((result) => {
      console.log('[NoShowWorker] Standalone run complete:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[NoShowWorker] Fatal error:', error);
      process.exit(1);
    });
}
