import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Joi from "joi";
import bcrypt from "bcrypt";
import "./config/loadEnv.js";
import { testConnection, testConnectionWithRetry, closePool, query } from "./utils/db.js";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import careRecipientRoutes from "./routes/careRecipientRoutes.js";
import disputeRoutes from "./routes/disputeRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import caregiverDocumentRoutes from "./routes/caregiverDocumentRoutes.js";
import caregiverSearchRoutes from "./routes/caregiverSearchRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import favoritesRoutes from "./routes/favoritesRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import Job from "./models/Job.js";
import { initChatSocket } from "./sockets/chatSocket.js";
import { setSocketServer } from "./sockets/realtimeHub.js";
import { DEV_MOCK_CAREGIVERS, DEV_MOCK_HIRERS, DEV_MOCK_ESCORT_JOB_TEMPLATES } from "./seeds/mockData.js";
import cron from "node-cron";
import { triggerNoShowScan } from "./workers/noShowWorker.js";

// Load environment variables

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().integer().min(1).max(65535),
  CORS_ORIGIN: Joi.string().allow(""),
  DATABASE_HOST: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  DATABASE_PORT: Joi.number()
    .integer()
    .when("NODE_ENV", { is: "production", then: Joi.required() }),
  DATABASE_NAME: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  DATABASE_USER: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  DATABASE_PASSWORD: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  JWT_SECRET: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  JWT_EXPIRES_IN: Joi.string(),
  JWT_REFRESH_EXPIRES_IN: Joi.string(),
  WEBHOOK_SECRET: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  EMAIL_PROVIDER: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  EMAIL_FROM: Joi.string(),
  PUSH_PROVIDER: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
  }),
  TZ: Joi.string(),
  MOCK_PROVIDER_URL: Joi.string(),
  MOCK_PROVIDER_BASE_URL: Joi.string(),
  PAYMENT_PROVIDER: Joi.string(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow(""),
  STRIPE_SECRET_KEY: Joi.string().when("PAYMENT_PROVIDER", {
    is: "stripe",
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().when("PAYMENT_PROVIDER", {
    is: "stripe",
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  }),
  STRIPE_ACCOUNT_ID: Joi.string().allow(""),
  SMS_PROVIDER: Joi.string(),
  KYC_PROVIDER: Joi.string(),
  BANK_TRANSFER_PROVIDER: Joi.string(),
  UPLOAD_DIR: Joi.string(),
  MAX_FILE_SIZE_MB: Joi.number(),
  WEBHOOK_BASE_URL: Joi.string(),
  ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }),
  ADMIN_PASSWORD: Joi.string(),
}).unknown(true);

const { error: envError } = envSchema.validate(process.env, {
  abortEarly: false,
});
if (envError) {
  const details = envError.details.map((detail) => detail.message).join(", ");
  console.error(`[Backend] Environment validation failed: ${details}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

setSocketServer(io);


async function ensureCaregiverPublicProfileColumn() {
  await query(
    `ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT TRUE`,
  );
}

async function ensureMockCaregivers() {
  const isDev = process.env.NODE_ENV !== "production";
  const enabled = process.env.SEED_MOCK_CAREGIVERS !== "false";
  if (!isDev || !enabled) return;

  await ensureCaregiverPublicProfileColumn();

  const mockPasswordHash = await bcrypt.hash(
    process.env.MOCK_CAREGIVER_PASSWORD || "DemoCare123!",
    10,
  );

  const mockCaregiverReviewQueue = [];

  for (const caregiver of DEV_MOCK_CAREGIVERS) {
    const userResult = await query(
      `INSERT INTO users (
         id,
         email,
         password_hash,
         account_type,
         role,
         status,
         is_email_verified,
         trust_level,
         trust_score,
         completed_jobs_count,
         created_at,
         updated_at
       )
       VALUES (
         gen_random_uuid(),
         $1,
         $2,
         'guest',
         'caregiver',
         'active',
         TRUE,
         $3,
         $4,
         $5,
         NOW(),
         NOW()
       )
       ON CONFLICT (email) DO UPDATE
       SET role = 'caregiver',
           status = 'active',
           trust_level = EXCLUDED.trust_level,
           trust_score = EXCLUDED.trust_score,
           completed_jobs_count = GREATEST(users.completed_jobs_count, EXCLUDED.completed_jobs_count),
           updated_at = NOW()
       RETURNING id`,
      [
        caregiver.email,
        mockPasswordHash,
        caregiver.trust_level,
        caregiver.trust_score,
        caregiver.completed_jobs_count,
      ],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) continue;

    await query(
      `INSERT INTO caregiver_profiles (
         user_id,
         display_name,
         bio,
         experience_years,
         certifications,
         specializations,
         available_from,
         available_to,
         available_days,
         is_public_profile,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           bio = EXCLUDED.bio,
           experience_years = EXCLUDED.experience_years,
           certifications = EXCLUDED.certifications,
           specializations = EXCLUDED.specializations,
           available_from = EXCLUDED.available_from,
           available_to = EXCLUDED.available_to,
           available_days = EXCLUDED.available_days,
           is_public_profile = TRUE,
           updated_at = NOW()`,
      [
        userId,
        caregiver.display_name,
        caregiver.bio,
        caregiver.experience_years,
        caregiver.certifications,
        caregiver.specializations,
        caregiver.available_from,
        caregiver.available_to,
        caregiver.available_days,
      ],
    );

    // Ensure at least one document per caregiver
    const docExists = await query(
      `SELECT 1 FROM caregiver_documents WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (docExists.rows.length === 0) {
      const certName = (caregiver.certifications && caregiver.certifications[0]) || "basic_first_aid";
      const docTitles = {
        basic_first_aid: "ใบรับรองปฐมพยาบาลเบื้องต้น",
        safe_transfer: "ใบรับรองการเคลื่อนย้ายผู้ป่วยอย่างปลอดภัย",
        dementia_care: "ใบรับรองการดูแลผู้ป่วยสมองเสื่อม",
        medication_management: "ใบรับรองการจัดการยา",
        post_surgery_care: "ใบรับรองการดูแลผู้ป่วยหลังผ่าตัด",
        vitals_monitoring: "ใบรับรองการติดตามสัญญาณชีพ",
        catheter_care: "ใบรับรองการดูแลสายสวน",
        wound_care: "ใบรับรองการดูแลแผล",
        tube_feeding_care: "ใบรับรองการดูแลการให้อาหารทางสาย",
      };
      const docTitle = docTitles[certName] || `ใบรับรอง ${certName}`;
      const issuers = ["สภากาชาดไทย", "สภาการพยาบาล", "กรมอนามัย กระทรวงสาธารณสุข", "สมาคมผู้ดูแลผู้สูงอายุ", "โรงพยาบาลจุฬาลงกรณ์"];
      const issuer = issuers[Math.abs(userId.charCodeAt(0)) % issuers.length];
      await query(
        `INSERT INTO caregiver_documents (id, user_id, document_type, title, issuer, issued_date, file_path, file_name, file_size, mime_type, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'certification', $2, $3, $4, $5, $6, 102400, 'application/pdf', NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [userId, docTitle, issuer, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), `uploads/documents/cert-${certName}.pdf`, `cert-${certName}.pdf`],
      );
    }

    // Collect caregivers that need reviews
    const jobsCount = caregiver.completed_jobs_count || 0;
    if (jobsCount > 0) {
      mockCaregiverReviewQueue.push({ userId, jobsCount, email: caregiver.email });
    }
  }

  // Generate reviews after all caregivers created (need to disable FK for mock reviews)
  if (mockCaregiverReviewQueue.length > 0) {
    await query(`ALTER TABLE caregiver_reviews DISABLE TRIGGER ALL`);
    try {
      const reviewComments = [
        "ดูแลดีมาก เอาใจใส่ คุณยายชอบมาก",
        "ตรงเวลา ใจเย็น ดูแลอ่อนโยน",
        "พูดจาสุภาพ ทำงานเรียบร้อย แนะนำเลย",
        "ดูแลดี แต่มาสายบ้างเล็กน้อย",
        "เอาใจใส่ผู้ป่วยดีมาก มีความรับผิดชอบสูง",
        "ทำงานละเอียด ดูแลครบทุกอย่าง",
        "คุณแม่ชอบมาก บอกว่าอยากให้มาดูแลอีก",
        "ประทับใจบริการ สุภาพ มีน้ำใจ",
        "ดูแลดี ช่วยงานบ้านด้วย ขอบคุณค่ะ",
        "มาตรงเวลา ดูแลเอาใจใส่ตลอด",
        "พอใช้ได้ ต้องปรับปรุงเรื่องเวลาบ้าง",
        "ดูแลดีมาก ผู้ป่วยสบายใจ",
        "ใส่ใจรายละเอียด ดูแลยาได้ถูกต้อง",
        "ช่วยเหลือได้ดี คุณพ่อพอใจมาก",
        "ทำงานเก่ง มีประสบการณ์จริง",
      ];
      const hirerNames = ["สมศรี ว.", "วิชัย ส.", "นภา ใ.", "สุพรรณ ก.", "อรทัย จ.", "ประวิทย์ ล.", "จันทร์ ม.", "สมบัติ ร."];

      for (const cg of mockCaregiverReviewQueue) {
        const existingReviews = await query(`SELECT count(*)::int as cnt FROM caregiver_reviews WHERE caregiver_id = $1`, [cg.userId]);
        if ((existingReviews.rows[0]?.cnt || 0) > 0) continue;

        const reviewCount = Math.max(1, Math.floor(cg.jobsCount * (0.3 + Math.random() * 0.3)));
        let ratingSum = 0;
        for (let i = 0; i < reviewCount; i++) {
          const rating = Math.random() < 0.15 ? 3 : Math.random() < 0.3 ? 4 : 5;
          ratingSum += rating;
          const comment = reviewComments[Math.floor(Math.random() * reviewComments.length)];
          const reviewerName = hirerNames[Math.floor(Math.random() * hirerNames.length)];
          const daysBack = Math.floor(Math.random() * 180) + 7;
          const reviewDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
          await query(
            `INSERT INTO caregiver_reviews (id, job_id, job_post_id, reviewer_id, caregiver_id, rating, comment, created_at, updated_at)
             VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $4)`,
            [cg.userId, rating, `${comment} — ${reviewerName}`, reviewDate],
          );
        }
        const avgRating = (ratingSum / reviewCount).toFixed(2);
        await query(
          `UPDATE caregiver_profiles SET average_rating = $2, total_reviews = $3, total_jobs_completed = $4, updated_at = NOW() WHERE user_id = $1`,
          [cg.userId, avgRating, reviewCount, cg.jobsCount],
        );
      }
    } finally {
      await query(`ALTER TABLE caregiver_reviews ENABLE TRIGGER ALL`);
    }
  }
}

function buildScheduleWindow(startAfterHours, durationHours) {
  const now = new Date();
  const start = new Date(now.getTime() + startAfterHours * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function ensureMockHirers() {
  const isDev = process.env.NODE_ENV !== "production";
  const enabled = process.env.SEED_MOCK_JOBS !== "false";
  if (!isDev || !enabled) return new Map();

  const mockPasswordHash = await bcrypt.hash(
    process.env.MOCK_HIRER_PASSWORD || "DemoHirer123!",
    10,
  );
  const hirerIdsByEmail = new Map();

  for (const hirer of DEV_MOCK_HIRERS) {
    const userResult = await query(
      `INSERT INTO users (
         id,
         email,
         password_hash,
         account_type,
         role,
         status,
         is_email_verified,
         trust_level,
         trust_score,
         completed_jobs_count,
         created_at,
         updated_at
       )
       VALUES (
         gen_random_uuid(),
         $1,
         $2,
         'guest',
         'hirer',
         'active',
         TRUE,
         'L1',
         70,
         0,
         NOW(),
         NOW()
       )
       ON CONFLICT (email) DO UPDATE
       SET role = 'hirer',
           status = 'active',
           account_type = 'guest',
           is_email_verified = TRUE,
           trust_level = EXCLUDED.trust_level,
           trust_score = GREATEST(users.trust_score, EXCLUDED.trust_score),
           updated_at = NOW()
       RETURNING id`,
      [hirer.email, mockPasswordHash],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) continue;

    hirerIdsByEmail.set(hirer.email, userId);

    await query(
      `INSERT INTO hirer_profiles (
         user_id,
         display_name,
         updated_at
       )
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           updated_at = NOW()`,
      [userId, hirer.display_name],
    );
  }

  return hirerIdsByEmail;
}

async function ensureMockEscortJobs(hirerIdsByEmail) {
  const isDev = process.env.NODE_ENV !== "production";
  const enabled = process.env.SEED_MOCK_JOBS !== "false";
  if (!isDev || !enabled) return;
  if (!hirerIdsByEmail || hirerIdsByEmail.size === 0) return;

  for (
    let index = 0;
    index < DEV_MOCK_ESCORT_JOB_TEMPLATES.length;
    index += 1
  ) {
    const template = DEV_MOCK_ESCORT_JOB_TEMPLATES[index];
    const hirerSeed = DEV_MOCK_HIRERS[index % DEV_MOCK_HIRERS.length];
    const hirerId = hirerIdsByEmail.get(hirerSeed.email);
    if (!hirerId) continue;

    const existingResult = await query(
      `SELECT id, status
       FROM job_posts
       WHERE hirer_id = $1
         AND title = $2
       LIMIT 1`,
      [hirerId, template.title],
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.status !== "posted") {
        await query(
          `UPDATE job_posts
           SET status = 'posted',
               posted_at = COALESCE(posted_at, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          [existing.id],
        );
      }
      continue;
    }

    const schedule = buildScheduleWindow(8 + index * 4, template.total_hours);

    const jobPost = await Job.createJobPost({
      hirer_id: hirerId,
      title: template.title,
      description: template.description,
      job_type: "companionship",
      risk_level: template.risk_level,
      scheduled_start_at: schedule.startIso,
      scheduled_end_at: schedule.endIso,
      address_line1: template.address_line1,
      district: template.district,
      province: template.province,
      hourly_rate: template.hourly_rate,
      total_hours: template.total_hours,
      min_trust_level: template.min_trust_level,
      required_certifications: [],
      is_urgent: template.is_urgent,
      job_tasks_flags: template.job_tasks_flags,
      required_skills_flags: template.required_skills_flags,
      equipment_available_flags: template.equipment_available_flags,
      precautions_flags: template.precautions_flags,
      patient_profile_id: null,
    });

    if (jobPost?.id) {
      await query(
        `UPDATE job_posts
         SET status = 'posted',
             posted_at = COALESCE(posted_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [jobPost.id],
      );
    }
  }
}

// Middleware
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({
  origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
  credentials: true,
}));
app.use("/api/webhooks", webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Prevent caching of API responses (important for Cloudflare tunnel / CDN)
app.use("/api", (req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Basic routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "careconnect-backend",
    version: "1.0.0",
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Careconnect Backend API",
    version: "1.0.0",
    docs: "/api/docs",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      jobs: "/api/jobs",
      chat: "/api/chat",
      wallet: "/api/wallet",
      webhooks: "/api/webhooks",
      admin: "/api/admin",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/care-recipients", careRecipientRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/caregiver-documents", caregiverDocumentRoutes);
app.use("/api/caregivers", caregiverSearchRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/complaints", complaintRoutes);

// Static file serving for uploads
const uploadDir = process.env.UPLOAD_DIR || "/app/uploads";
app.use("/uploads/avatars", express.static(path.resolve(uploadDir, "avatars"), {
  maxAge: "365d",
  immutable: true,
}));
app.use("/uploads", express.static(path.resolve(uploadDir)));

// Initialize Socket.IO chat handlers
initChatSocket(io);

// Error handling middleware
import { errorHandler, NotFoundError } from "./utils/errors.js";

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  const error = new NotFoundError("The requested resource was not found", {
    path: req.path,
    method: req.method,
  });
  res.status(error.status).json(error.toJSON());
});

// Test database connection before starting server
const bootstrapAndListen = async () => {
  try {
    const connected = await testConnectionWithRetry(10, 2000);
    if (!connected) {
      console.error("[Backend] Failed to connect to database after 10 retries. Exiting...");
      process.exit(1);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const ensureAdmin = async () => {
      if (!adminEmail || !adminPassword) return;
      const existing = await query("SELECT id FROM users WHERE email = $1", [
        adminEmail,
      ]);
      if (existing.rows.length > 0) return;
      const hash = await bcrypt.hash(adminPassword, 10);
      await query(
        `INSERT INTO users (id, email, password_hash, account_type, role, trust_level, status, is_email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'guest', 'admin', 'L3', 'active', true, NOW(), NOW())`,
        [adminEmail, hash],
      );
    };

    const PORT = process.env.PORT || 3000;
    await ensureAdmin()
      .then(async () => {
        await ensureMockCaregivers();
        const hirerIdsByEmail = await ensureMockHirers();
        await ensureMockEscortJobs(hirerIdsByEmail);
      })
      .catch((error) => {
        console.error("[Backend] Bootstrap failed:", error);
      });

    cron.schedule("*/5 * * * *", triggerNoShowScan);
    console.log("[Backend] No-show worker scheduled (every 5 minutes)");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Backend] Server running on port ${PORT}`);
      console.log(`[Backend] Environment: ${process.env.NODE_ENV}`);
      console.log(
        `[Backend] Health check: http://localhost:${PORT}/health`,
      );
      console.log(
        `[Backend] Auth endpoints: http://localhost:${PORT}/api/auth`,
      );
      console.log(
        `[Backend] Job endpoints: http://localhost:${PORT}/api/jobs`,
      );
      console.log(
        `[Backend] Chat endpoints: http://localhost:${PORT}/api/chat`,
      );
      console.log(
        `[Backend] Wallet endpoints: http://localhost:${PORT}/api/wallet`,
      );
      console.log(
        `[Backend] Webhook endpoints: http://localhost:${PORT}/api/webhooks`,
      );
    });
  } catch (error) {
    console.error("[Backend] Failed to start server:", error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  bootstrapAndListen();

  process.on("SIGTERM", async () => {
    console.log("[Backend] SIGTERM received, shutting down gracefully...");
    server.close(async () => {
      console.log("[Backend] HTTP server closed");
      await closePool();
      console.log("[Backend] Database pool closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    console.log("\n[Backend] SIGINT received, shutting down gracefully...");
    server.close(async () => {
      console.log("[Backend] HTTP server closed");
      await closePool();
      console.log("[Backend] Database pool closed");
      process.exit(0);
    });
  });

  process.on("uncaughtException", (err) => {
    console.error("[Backend] Uncaught exception:", err);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 5000);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Backend] Unhandled rejection:", reason);
  });
}

// Export server for testing
export default server;

export { app, io };
