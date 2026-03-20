#!/usr/bin/env node
/**
 * Generate realistic avatar images for demo personas
 * Downloads photos from randomuser.me and processes them with sharp
 * into the variant format the app expects.
 *
 * Usage: node backend/src/seeds/generateDemoAvatars.js
 */

import "../config/loadEnv.js";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { query, closePool } from "../utils/db.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

const AVATAR_VARIANTS = [
  { name: "thumb", size: 64, quality: 80 },
  { name: "sm", size: 128, quality: 80 },
  { name: "md", size: 256, quality: 85 },
  { name: "lg", size: 512, quality: 85 },
];

// Specific randomuser.me portrait IDs for consistent, good-looking Thai-passing photos
const PERSONA_PHOTOS = {
  "demo.somsri@careconnect.local": { gender: "women", id: 44 },   // Hirer หลัก (ผู้หญิง)
  "demo.wichai@careconnect.local": { gender: "men", id: 32 },     // Hirer รอง (ผู้ชาย)
  "demo.napa@careconnect.local": { gender: "women", id: 68 },     // Hirer ใหม่ (ผู้หญิง)
  "demo.pim@careconnect.local": { gender: "women", id: 21 },      // Caregiver หลัก (ผู้หญิง)
  "demo.thiti@careconnect.local": { gender: "men", id: 75 },      // Caregiver รอง (ผู้ชาย)
  "demo.malee@careconnect.local": { gender: "women", id: 55 },    // Caregiver ใหม่ (ผู้หญิง)
  "demo.anan@careconnect.local": { gender: "men", id: 45 },       // Caregiver banned (ผู้ชาย)
};

async function downloadImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download ${url}: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function processAvatar(inputBuffer, userAvatarDir) {
  await fs.mkdir(userAvatarDir, { recursive: true });

  for (const variant of AVATAR_VARIANTS) {
    await sharp(inputBuffer)
      .resize(variant.size, variant.size, { fit: "cover", position: "centre" })
      .webp({ quality: variant.quality })
      .toFile(path.join(userAvatarDir, `${variant.name}.webp`));

    await sharp(inputBuffer)
      .resize(variant.size, variant.size, { fit: "cover", position: "centre" })
      .jpeg({ quality: variant.quality, progressive: true })
      .toFile(path.join(userAvatarDir, `${variant.name}.jpg`));
  }

  await sharp(inputBuffer)
    .webp({ quality: 90 })
    .toFile(path.join(userAvatarDir, "original.webp"));
}

async function main() {
  console.log("=== Generating Demo Avatars ===\n");

  // Get demo user IDs
  const emails = Object.keys(PERSONA_PHOTOS);
  const result = await query(
    `SELECT id, email FROM users WHERE email = ANY($1)`,
    [emails]
  );

  if (result.rows.length === 0) {
    console.error("No demo users found. Run runDemoSeed.js first.");
    await closePool();
    process.exit(1);
  }

  const userMap = {};
  for (const row of result.rows) {
    userMap[row.email] = row.id;
  }

  for (const [email, photo] of Object.entries(PERSONA_PHOTOS)) {
    const userId = userMap[email];
    if (!userId) {
      console.log(`  ⚠ Skipping ${email} — user not found`);
      continue;
    }

    const photoUrl = `https://randomuser.me/api/portraits/${photo.gender}/${photo.id}.jpg`;
    console.log(`  Downloading ${email} from ${photoUrl}...`);

    try {
      const imageBuffer = await downloadImage(photoUrl);
      const userAvatarDir = path.join(UPLOAD_DIR, "avatars", userId);
      await processAvatar(imageBuffer, userAvatarDir);

      // Update DB
      await query(
        `UPDATE users SET avatar_version = 1, updated_at = NOW() WHERE id = $1`,
        [userId]
      );

      // Verify files
      const files = await fs.readdir(userAvatarDir);
      console.log(`  ✓ ${email} → ${files.length} files (${files.join(", ")})`);
    } catch (err) {
      console.error(`  ✗ ${email} — ${err.message}`);
    }
  }

  // Also create placeholder document files for caregiver documents
  console.log("\n=== Creating Demo Document Placeholders ===\n");
  const docsDir = path.join(UPLOAD_DIR, "documents");
  await fs.mkdir(docsDir, { recursive: true });

  const docFiles = [
    "demo-cert-firstaid.pdf",
    "demo-license-nursing.pdf",
    "demo-cert-elderly.pdf",
  ];

  for (const docFile of docFiles) {
    const docPath = path.join(UPLOAD_DIR, "documents", docFile);
    try {
      await fs.access(docPath);
      console.log(`  ✓ ${docFile} — already exists`);
    } catch {
      // Create a minimal placeholder PDF
      const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Demo Document) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`;
      await fs.writeFile(docPath, pdfContent);
      console.log(`  ✓ ${docFile} — created placeholder`);
    }
  }

  console.log("\n=== Done ===");
  await closePool();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
