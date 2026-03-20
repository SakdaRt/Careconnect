/**
 * Deposit Tier Utility
 * Hardcoded tier table for MVP — move to DB config in Phase 2
 */

const HIRER_DEPOSIT_TIERS = [
  { max: 500, deposit: 100 },
  { max: 2000, deposit: 200 },
  { max: 5000, deposit: 500 },
  { max: 10000, deposit: 1000 },
  { max: Infinity, deposit: 2000 },
];

export function getHirerDepositAmount(totalAmount) {
  const amount = Number(totalAmount) || 0;
  if (amount <= 0) return 0;
  for (const tier of HIRER_DEPOSIT_TIERS) {
    if (amount <= tier.max) return tier.deposit;
  }
  return 2000;
}

export function getCaregiverDepositAmount(/* totalAmount */) {
  return 0; // MVP: caregiver deposit not active
}
