import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../../.env");
const backendEnvPath = path.resolve(__dirname, "../../.env");
const externalEnvKeys = new Set(Object.keys(process.env));
const overlayAssignedKeys = new Set();

const hasValue = (key) => String(process.env[key] ?? "").trim() !== "";
const envWarnings = [];

const pushWarning = (message) => {
  if (!envWarnings.includes(message)) {
    envWarnings.push(message);
  }
};

const applyDefault = (key, value, warningMessage = "") => {
  if (hasValue(key)) return;
  process.env[key] = value;
  if (warningMessage) {
    pushWarning(warningMessage);
  }
};

const loadModeOverlay = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  Object.entries(parsed).forEach(([key, value]) => {
    if (externalEnvKeys.has(key) || overlayAssignedKeys.has(key)) return;
    process.env[key] = value;
    overlayAssignedKeys.add(key);
  });
};

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath, override: false });

const mode = process.env.NODE_ENV || "development";
const rootModeEnvPath = path.resolve(__dirname, `../../../.env.${mode}`);
const backendModeEnvPath = path.resolve(__dirname, `../../.env.${mode}`);

loadModeOverlay(rootModeEnvPath);
loadModeOverlay(backendModeEnvPath);

const applyNonProductionEnvPolicy = () => {
  applyDefault("NODE_ENV", mode);
  applyDefault("TZ", "Asia/Bangkok");
  applyDefault("PORT", "3000");
  applyDefault(
    "DATABASE_HOST",
    "localhost",
    `[Backend Env] DATABASE_HOST is not set; using localhost in ${mode}`,
  );
  applyDefault(
    "DATABASE_PORT",
    "5432",
    `[Backend Env] DATABASE_PORT is not set; using 5432 in ${mode}`,
  );
  applyDefault(
    "DATABASE_NAME",
    "careconnect",
    `[Backend Env] DATABASE_NAME is not set; using careconnect in ${mode}`,
  );
  applyDefault(
    "DATABASE_USER",
    "careconnect",
    `[Backend Env] DATABASE_USER is not set; using careconnect in ${mode}`,
  );
  applyDefault(
    "DATABASE_PASSWORD",
    "careconnect_dev_password",
    `[Backend Env] DATABASE_PASSWORD is not set; using development database password in ${mode}`,
  );
  applyDefault(
    "JWT_SECRET",
    "careconnect_jwt_secret_dev_only",
    `[Backend Env] JWT_SECRET is not set; using development-only fallback in ${mode}`,
  );
  applyDefault("JWT_EXPIRES_IN", "7d");
  applyDefault("JWT_REFRESH_EXPIRES_IN", "30d");
  applyDefault(
    "WEBHOOK_SECRET",
    "careconnect_webhook_secret_dev",
    `[Backend Env] WEBHOOK_SECRET is not set; using development-only fallback in ${mode}`,
  );
  applyDefault("MOCK_PROVIDER_BASE_URL", "http://localhost:4000");
  applyDefault("WEBHOOK_BASE_URL", "http://localhost:3000");
  applyDefault("UPLOAD_DIR", "./uploads");
  applyDefault("MAX_FILE_SIZE_MB", "10");
  applyDefault("FRONTEND_URL", "http://localhost:5173");
  applyDefault("BACKEND_URL", "http://localhost:3000");
  applyDefault(
    "ADMIN_EMAIL",
    "admin@careconnect.com",
    `[Backend Env] ADMIN_EMAIL is not set; using development admin email in ${mode}`,
  );
  applyDefault(
    "ADMIN_PASSWORD",
    "Admin1234!",
    `[Backend Env] ADMIN_PASSWORD is not set; using development admin password in ${mode}`,
  );

  if (!hasValue("PAYMENT_PROVIDER")) {
    process.env.PAYMENT_PROVIDER = "mock";
    pushWarning(`[Backend Env] PAYMENT_PROVIDER is not set; using mock in ${mode}`);
  }

  if (!hasValue("SMS_PROVIDER")) {
    process.env.SMS_PROVIDER = "mock";
    pushWarning(`[Backend Env] SMS_PROVIDER is not set; using mock in ${mode}`);
  }

  if (!hasValue("EMAIL_PROVIDER")) {
    process.env.EMAIL_PROVIDER = "mock";
    pushWarning(`[Backend Env] EMAIL_PROVIDER is not set; using mock in ${mode}`);
  }

  if (!hasValue("PUSH_PROVIDER")) {
    process.env.PUSH_PROVIDER = "mock";
    pushWarning(`[Backend Env] PUSH_PROVIDER is not set; using mock in ${mode}`);
  }

  if (!hasValue("KYC_PROVIDER")) {
    process.env.KYC_PROVIDER = "mock";
  }

  if (!hasValue("BANK_TRANSFER_PROVIDER")) {
    process.env.BANK_TRANSFER_PROVIDER = "mock";
  }

  const paymentProvider = String(process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (paymentProvider === "stripe") {
    const missingStripeKeys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].filter((key) => !hasValue(key));
    if (missingStripeKeys.length > 0) {
      process.env.PAYMENT_PROVIDER = "mock";
      pushWarning(
        `[Backend Env] PAYMENT_PROVIDER=stripe but ${missingStripeKeys.join(", ")} ${missingStripeKeys.length === 1 ? "is" : "are"} missing; falling back to mock in ${mode}`,
      );
    }
  }

  const emailProvider = String(process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (emailProvider === "smtp") {
    const missingSmtpKeys = ["EMAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].filter(
      (key) => !hasValue(key),
    );
    if (missingSmtpKeys.length > 0) {
      process.env.EMAIL_PROVIDER = "mock";
      pushWarning(
        `[Backend Env] EMAIL_PROVIDER=smtp but ${missingSmtpKeys.join(", ")} ${missingSmtpKeys.length === 1 ? "is" : "are"} missing; falling back to mock in ${mode}`,
      );
    }
  }

  const smsProvider = String(process.env.SMS_PROVIDER || "").toLowerCase();
  if (smsProvider === "smsok") {
    const missingSmsOkKeys = ["SMSOK_API_URL", "SMSOK_API_KEY", "SMSOK_API_SECRET"].filter((key) => !hasValue(key));
    if (missingSmsOkKeys.length > 0) {
      process.env.SMS_PROVIDER = "mock";
      pushWarning(
        `[Backend Env] SMS_PROVIDER=smsok but ${missingSmsOkKeys.join(", ")} ${missingSmsOkKeys.length === 1 ? "is" : "are"} missing; falling back to mock in ${mode}`,
      );
    }
  }

  applyDefault("EMAIL_FROM", "noreply@careconnect.local");
};

if (mode !== "production") {
  applyNonProductionEnvPolicy();
}

envWarnings.forEach((message) => {
  console.warn(message);
});
