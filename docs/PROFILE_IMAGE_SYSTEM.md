# Profile Image System — Implementation Plan

> เอกสารออกแบบและวางแผน implementation สำหรับระบบรูปโปรไฟล์ CareConnect
> วันที่: 2026-03-16
> Status: Draft — verified from source code

---

## 1. ปัญหาปัจจุบัน (Verified from Code)

### 1.1 สิ่งที่มีอยู่

| ส่วน | สถานะ | รายละเอียด |
|------|--------|-----------|
| **DB column** | ⚠️ Runtime fallback | `users.avatar VARCHAR(500)` — ไม่มีใน `schema.sql` แต่เพิ่มผ่าน `ensureProfileSchema()` |
| **Upload endpoint** | ✅ มี | `POST /api/auth/avatar` — multer, max 5MB, JPEG/PNG/WebP |
| **File storage** | ✅ มี | `/app/uploads/avatars/{uuid}.{ext}` — Docker named volume `backend_uploads` |
| **Static serving** | ✅ มี | `app.use('/uploads', express.static(...))` ใน `server.js` |
| **Avatar component** | ✅ มี | `frontend/src/components/ui/Avatar.tsx` — 5 sizes (xs-xl) |
| **Upload UI** | ✅ มี | `ProfilePage.tsx` — file input + upload button |

### 1.2 ปัญหาที่พบ

**ภาพเล็กเกินไปทุกจุด:**
- Avatar sizes ปัจจุบัน: xs=24px, sm=32px, md=40px, lg=48px, xl=64px
- ขนาดใหญ่สุด `xl` คือ 64×64px — เล็กเกินไปสำหรับ:
  - หน้า Profile (ควร 120-160px)
  - หน้า Caregiver Public Profile (ควร 120-160px)
  - Search results (ควร 64-80px)
- **ไม่มีขนาด 2xl/3xl** สำหรับหน้า profile / public profile

**ไม่มี image processing:**
- ไฟล์ถูก save ตรงจาก upload โดยไม่มี resize/crop/compress
- User อัปโหลดรูป 5MB → serve 5MB ทุกจุด แม้แสดง 48px
- ไม่มี image variants (thumbnail, medium, large)
- ไม่มี WebP conversion สำหรับ performance

**Avatar URL resolution ไม่ consistent:**
- `ProfilePage.tsx` ใช้ `useMemo` ตรวจ http/https prefix
- `SearchCaregiversPage.tsx` ใช้ template literal `/uploads/${cg.avatar}`
- `CreateJobPage.tsx` ใช้ raw `<img>` + manual fallback แทน Avatar component
- ไม่มี utility function กลาง → ต้องเขียนซ้ำทุกหน้า

**ไม่มี crop ก่อน upload:**
- User อัปโหลดรูปอะไรก็ได้ ไม่ว่าจะเป็นแนวนอน/ตั้ง/panorama
- `object-cover` ใน CSS ช่วยแสดง ok แต่ตัดส่วนสำคัญออกได้
- ไม่มี crop preview ให้ user จัดตำแหน่ง

**Avatar column ไม่อยู่ใน master schema:**
- `database/schema.sql` ไม่มี `avatar` column ใน `users` table
- ใช้ runtime `ALTER TABLE ADD COLUMN IF NOT EXISTS` ใน `ensureProfileSchema()`
- ควรย้ายเข้า schema.sql + สร้าง migration

**TopBar ไม่แสดง avatar:**
- `TopBar.tsx` ไม่ import/ใช้ Avatar component เลย
- แสดงเพียง text/icon — ควรแสดงรูป user ด้วย

---

## 2. มาตรฐานรูปโปรไฟล์ใหม่ที่แนะนำ

### 2.1 ขนาดภาพต้นฉบับ (Source Image)

| ข้อกำหนด | ค่า | เหตุผล |
|----------|-----|--------|
| **Minimum resolution** | 400×400px | ให้ได้คุณภาพดีเมื่อแสดงที่ 200px (2x retina) |
| **Maximum upload size** | 10MB | รองรับกล้องมือถือ (ลด server-side) |
| **Accepted formats** | JPEG, PNG, WebP, HEIC | HEIC สำหรับ iPhone |
| **Aspect ratio** | อิสระ (crop เป็น 1:1 client-side) | ภาพครึ่งตัว/ภาพเต็มตัว crop ที่ face |
| **Output format** | WebP (primary) + JPEG (fallback) | WebP เล็กกว่า ~30% |

### 2.2 ทำไมต้อง 1:1 (สี่เหลี่ยมจัตุรัส)

- Avatar ทุกจุดในระบบเป็นวงกลม (`rounded-full`)
- 1:1 crop ที่ face → object-cover ทำงานสมบูรณ์
- ง่ายต่อการ resize เป็น variants ต่างๆ
- ไม่มีปัญหา letterbox / pillarbox

### 2.3 สำหรับ "ภาพครึ่งตัว" (Half-body Portrait)

ถ้าต้องการแสดงภาพครึ่งตัว (ไม่ใช่แค่ใบหน้า) สำหรับ public profile:

| ข้อกำหนด | ค่า |
|----------|-----|
| **Aspect ratio** | 3:4 (portrait) |
| **ใช้ที่ไหน** | Caregiver public profile hero, Search detail modal |
| **Minimum** | 480×640px |
| **Stored as** | variants แยก (`portrait_sm`, `portrait_md`) |

> **แนะนำ Phase 1**: เริ่มจาก 1:1 avatar ก่อน เพิ่ม 3:4 portrait variant ใน Phase 2

---

## 3. Image Variants ที่ควรมี

### 3.1 Avatar Variants (1:1 square → rendered as circle)

| Variant | Dimensions | Quality | Use Cases | Approx Size |
|---------|-----------|---------|-----------|-------------|
| `thumb` | 64×64px | 80% | TopBar dropdown, chat list, notification items | ~3-5KB |
| `sm` | 128×128px | 80% | Card avatars, search result list, job cards | ~8-12KB |
| `md` | 256×256px | 85% | Profile page, public profile, search detail | ~15-25KB |
| `lg` | 512×512px | 85% | Full-screen view, future "zoom" feature | ~30-50KB |
| `original` | ตามที่ crop | 90% | Archive / reprocess ในอนาคต | ≤500KB |

### 3.2 Storage Path Convention

```
/app/uploads/avatars/
  {userId}/
    thumb.webp      (64×64)
    thumb.jpg       (64×64 fallback)
    sm.webp         (128×128)
    sm.jpg          (128×128 fallback)
    md.webp         (256×256)
    md.jpg          (256×256 fallback)
    lg.webp         (512×512)
    lg.jpg          (512×512 fallback)
    original.webp   (cropped original)
```

### 3.3 Serving URL

```
/uploads/avatars/{userId}/sm.webp
/uploads/avatars/{userId}/md.webp
```

DB เก็บแค่ flag ว่ามี avatar หรือไม่ + version:
```sql
avatar_version INT DEFAULT 0  -- increment ทุกครั้งที่ upload ใหม่
```

Frontend สร้าง URL จาก `userId` + `variant` + `avatar_version` (cache-bust):
```
/uploads/avatars/{userId}/sm.webp?v={avatar_version}
```

---

## 4. แนวทาง Crop และการอัปโหลด

### 4.1 Client-side Crop (แนะนำ)

ใช้ library: **react-image-crop** หรือ **react-easy-crop** (เลือก 1)

| Library | ขนาด | ข้อดี | ข้อเสีย |
|---------|------|------|--------|
| `react-easy-crop` | ~30KB | UX ดี, pinch-to-zoom, mobile-friendly | ต้อง canvas API |
| `react-image-crop` | ~20KB | เบากว่า, ง่ายกว่า | UX ด้อยกว่าเล็กน้อย |

**แนะนำ: `react-easy-crop`** — UX ดีกว่ามากบนมือถือ

### 4.2 Upload Flow (ใหม่)

```
1. User เลือกรูป → File input
2. แสดง crop modal (react-easy-crop)
   - Aspect ratio: 1:1
   - Zoom: 1x-3x
   - เคลื่อนตำแหน่งได้
3. User กด "ยืนยัน" → crop ด้วย canvas API
4. ส่ง cropped image (Blob) → POST /api/auth/avatar
5. Backend:
   a. รับ file (multer)
   b. ใช้ sharp → resize เป็น 4 variants
   c. Save ทุก variant ไปที่ /uploads/avatars/{userId}/
   d. ลบ variants เก่า
   e. UPDATE users SET avatar_version = avatar_version + 1
   f. Response: { avatar_version: N }
6. Frontend: updateUser({ avatar_version: N })
```

### 4.3 ทำไมต้อง Crop ฝั่ง Client

- **ลด bandwidth**: ส่งแค่ส่วนที่ต้องการ ไม่ใช่ภาพเต็ม
- **User control**: user เลือกจุดโฟกัส (ใบหน้า) เอง
- **Faster processing**: backend รับภาพที่ crop แล้ว resize เร็วกว่า
- **Mobile-friendly**: ไม่ต้องส่งภาพ 10MB จากมือถือ

### 4.4 Fallback สำหรับ Browser เก่า

ถ้า canvas API ไม่ทำงาน → ส่ง original file + backend crop center

---

## 5. มาตรฐานการแสดงผลในแต่ละหน้า

### 5.1 Avatar Size Map (ใหม่)

| Size Key | Dimensions | Variant | ใช้ที่ไหน |
|----------|-----------|---------|----------|
| `xs` | 24×24px | `thumb` | Chat bubble sender icon |
| `sm` | 32×32px | `thumb` | TopBar dropdown, notification list |
| `md` | 40×40px | `sm` | Job card caregiver/hirer, compact list |
| `lg` | 48×48px | `sm` | Search result list item |
| `xl` | 64×64px | `sm` | Search result card, chat list |
| **`2xl`** | **96×96px** | **`md`** | **Caregiver public profile (card)** |
| **`3xl`** | **128×128px** | **`md`** | **My profile page, public profile hero** |

### 5.2 Retina Display

CSS ขนาด 128px → ต้องการ image 256px (2x) เพื่อคมบน retina
- **ทุก variant ถูกออกแบบที่ 2x** อยู่แล้ว:
  - `thumb` (64px) รองรับ CSS 32px
  - `sm` (128px) รองรับ CSS 64px
  - `md` (256px) รองรับ CSS 128px

### 5.3 หน้าที่ต้องปรับ

| หน้า | ปัจจุบัน | ควรเป็น |
|------|---------|--------|
| **TopBar** | ❌ ไม่แสดง avatar | `sm` (32px) ใน dropdown trigger |
| **ProfilePage** | `lg` (48px) | `3xl` (128px) |
| **SearchCaregiversPage** | `lg` (48px) | `xl` (64px) list / `2xl` (96px) detail modal |
| **CaregiverPublicProfilePage** | ❌ ไม่แสดง | `3xl` (128px) hero section |
| **CreateJobPage** (preferred caregiver) | raw `<img>` 40px | `md` (40px) ใช้ Avatar component |
| **Card.JobCard** | `sm` (32px) | `md` (40px) |
| **ChatRoomPage** | N/A | `xs` (24px) per message, `lg` (48px) header |

---

## 6. Frontend Component Architecture

### 6.1 ปรับ Avatar Component

```typescript
// frontend/src/components/ui/Avatar.tsx

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const sizeConfig: Record<AvatarSize, {
  container: string;      // Tailwind w-X h-X
  text: string;           // Fallback initials size
  variant: 'thumb' | 'sm' | 'md' | 'lg';  // Which image variant to load
}> = {
  xs:  { container: 'w-6 h-6',   text: 'text-[10px]', variant: 'thumb' },
  sm:  { container: 'w-8 h-8',   text: 'text-xs',     variant: 'thumb' },
  md:  { container: 'w-10 h-10', text: 'text-sm',     variant: 'sm' },
  lg:  { container: 'w-12 h-12', text: 'text-base',   variant: 'sm' },
  xl:  { container: 'w-16 h-16', text: 'text-lg',     variant: 'sm' },
  '2xl': { container: 'w-24 h-24', text: 'text-2xl',  variant: 'md' },
  '3xl': { container: 'w-32 h-32', text: 'text-3xl',  variant: 'md' },
};
```

### 6.2 Avatar URL Resolver (ใหม่)

```typescript
// frontend/src/utils/avatar.ts

export function getAvatarUrl(
  userId?: string | null,
  avatarVersion?: number | null,
  variant: 'thumb' | 'sm' | 'md' | 'lg' = 'sm'
): string | undefined {
  if (!userId || !avatarVersion) return undefined;
  return `/uploads/avatars/${userId}/${variant}.webp?v=${avatarVersion}`;
}
```

- **ทุกจุดที่แสดง avatar** จะเรียกผ่าน function นี้
- ไม่มี manual URL construction กระจายทั่วโค้ดอีก
- Cache-bust ด้วย `?v=` parameter

### 6.3 AvatarUpload Component (ใหม่)

```typescript
// frontend/src/components/ui/AvatarUpload.tsx

interface AvatarUploadProps {
  currentSrc?: string;
  name?: string;
  size?: AvatarSize;
  onUpload: (croppedBlob: Blob) => Promise<void>;
  loading?: boolean;
}
```

รวม:
- Avatar display ปัจจุบัน
- Camera icon overlay
- Click → เปิด file picker → crop modal → upload

### 6.4 CropModal Component (ใหม่)

```typescript
// frontend/src/components/ui/CropModal.tsx

interface CropModalProps {
  imageSrc: string;          // Object URL ของ file ที่เลือก
  aspectRatio?: number;      // default 1 (square)
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}
```

ใช้ `react-easy-crop` ภายใน:
- Zoom slider (1x - 3x)
- Drag to reposition
- Preview circle mask
- "ยืนยัน" / "ยกเลิก" buttons

### 6.5 CSS Rules สำคัญ

```css
/* Avatar container — ทุกขนาด */
.avatar-container {
  @apply relative inline-flex items-center justify-center
         flex-shrink-0 rounded-full overflow-hidden;
}

/* Image ภายใน — ป้องกันเพี้ยน */
.avatar-container img {
  @apply w-full h-full;
  object-fit: cover;       /* สำคัญ: crop ไม่ stretch */
  object-position: center; /* center ที่ใบหน้า (default) */
  aspect-ratio: 1 / 1;     /* บังคับ square */
  image-rendering: auto;   /* ให้ browser เลือก best quality */
}

/* ป้องกัน layout shift */
.avatar-container {
  contain: layout size;
}
```

**กฎสำคัญ:**
1. `object-fit: cover` — **ห้ามใช้ `contain`** เพราะจะเกิด letterbox
2. `aspect-ratio: 1/1` — ป้องกันภาพบิดเบี้ยวแม้ container ผิดขนาด
3. `rounded-full` + `overflow-hidden` — crop เป็นวงกลม
4. `flex-shrink-0` — ป้องกัน avatar หดตัวใน flex container

---

## 7. Backend / Image Processing

### 7.1 Dependencies ที่ต้องเพิ่ม

```bash
npm install sharp  # Image processing (resize, format convert, compress)
```

**sharp** คือ standard สำหรับ Node.js image processing:
- Native C++ (libvips) → เร็วกว่า Jimp 10-50x
- รองรับ WebP, AVIF, HEIC output
- Memory efficient (stream-based)
- ทำงานใน Docker ได้ดี (มี pre-built binaries)

### 7.2 Image Processing Service (ใหม่)

```javascript
// backend/src/services/imageService.js

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const AVATAR_VARIANTS = [
  { name: 'thumb', size: 64,  quality: 80 },
  { name: 'sm',    size: 128, quality: 80 },
  { name: 'md',    size: 256, quality: 85 },
  { name: 'lg',    size: 512, quality: 85 },
];

export async function processAvatarUpload(inputPath, userId) {
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  const userAvatarDir = path.join(uploadDir, 'avatars', userId);
  
  // สร้าง directory ถ้ายังไม่มี
  await fs.mkdir(userAvatarDir, { recursive: true });

  // อ่าน input image
  const inputBuffer = await fs.readFile(inputPath);
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  // Validate minimum size
  if ((metadata.width || 0) < 100 || (metadata.height || 0) < 100) {
    throw { status: 400, message: 'รูปภาพต้องมีขนาดอย่างน้อย 100×100 pixels' };
  }

  // Generate all variants
  for (const variant of AVATAR_VARIANTS) {
    // WebP (primary)
    await sharp(inputBuffer)
      .resize(variant.size, variant.size, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: variant.quality })
      .toFile(path.join(userAvatarDir, `${variant.name}.webp`));

    // JPEG (fallback)
    await sharp(inputBuffer)
      .resize(variant.size, variant.size, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: variant.quality, progressive: true })
      .toFile(path.join(userAvatarDir, `${variant.name}.jpg`));
  }

  // Save cropped original as WebP
  await sharp(inputBuffer)
    .webp({ quality: 90 })
    .toFile(path.join(userAvatarDir, 'original.webp'));

  // ลบ temp upload file
  await fs.unlink(inputPath).catch(() => {});

  return { success: true };
}

export async function deleteAvatarFiles(userId) {
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  const userAvatarDir = path.join(uploadDir, 'avatars', userId);
  await fs.rm(userAvatarDir, { recursive: true, force: true });
}
```

### 7.3 ปรับ Upload Endpoint

```javascript
// ปรับ updateAvatar ใน authController.js

export const updateAvatar = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'กรุณาอัปโหลดรูปโปรไฟล์' });
    }

    // Process image → generate variants
    await processAvatarUpload(file.path, req.userId);

    // Increment avatar_version
    const result = await query(
      `UPDATE users 
       SET avatar_version = COALESCE(avatar_version, 0) + 1, updated_at = NOW()
       WHERE id = $1 
       RETURNING avatar_version`,
      [req.userId]
    );

    return res.json({
      success: true,
      data: {
        avatar_version: result.rows[0].avatar_version,
      },
    });
  } catch (error) {
    // cleanup temp file
    if (req.file?.path) fs.unlink(req.file.path).catch(() => {});
    
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    console.error('[Auth] Avatar upload error:', error);
    return res.status(500).json({ success: false, error: 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ' });
  }
};
```

### 7.4 Cache Headers

เพิ่มใน static serving:

```javascript
app.use('/uploads/avatars', express.static(path.resolve(uploadDir, 'avatars'), {
  maxAge: '1y',           // cache นาน — ใช้ ?v= bust
  immutable: true,        // บอก browser ว่า content ไม่เปลี่ยน
  etag: false,            // ไม่ต้อง etag เพราะ immutable
}));
```

---

## 8. Database / API Changes

### 8.1 Database Migration

```sql
-- backend/database/migrations/YYYYMMDD_XX_avatar_version.sql

-- เพิ่ม avatar_version column (แทน avatar path)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version INT NOT NULL DEFAULT 0;

-- Migrate existing avatar data:
-- ถ้า user มี avatar path อยู่ → set avatar_version = 1
UPDATE users SET avatar_version = 1 WHERE avatar IS NOT NULL AND avatar != '';

-- Note: ไม่ลบ avatar column ทันที — phase out ค่อยๆ
-- เพิ่ม comment
COMMENT ON COLUMN users.avatar_version IS 'Incremented on each avatar upload. 0 = no avatar.';
```

### 8.2 อัพเดท schema.sql

```sql
-- เพิ่มใน users table definition:
avatar_version INT NOT NULL DEFAULT 0,
```

### 8.3 API Response Changes

**GET /api/auth/me** — เพิ่ม `avatar_version` ใน response:
```json
{
  "id": "uuid",
  "email": "...",
  "avatar_version": 3,
  ...
}
```

**POST /api/auth/avatar** — เปลี่ยน response:
```json
// เดิม
{ "success": true, "data": { "avatar": "avatars/uuid.jpg" } }

// ใหม่
{ "success": true, "data": { "avatar_version": 4 } }
```

**GET /api/caregivers/public/...** — เพิ่ม `avatar_version` ใน caregiver results:
```json
{
  "id": "uuid",
  "display_name": "สมชาย",
  "avatar_version": 2,
  ...
}
```

### 8.4 Backward Compatibility

ระหว่าง migration:
1. Backend ยังคง return `avatar` field ด้วย (deprecated)
2. Frontend ตรวจ `avatar_version > 0` ก่อน → ใช้ new URL pattern
3. ถ้ามีแค่ `avatar` (legacy) → ใช้ `/uploads/${avatar}` เดิม
4. Phase out `avatar` column หลังจาก migrate data ครบ

---

## 9. Step-by-step Implementation Plan

### Phase 1: Backend Foundation (1-2 วัน)

```
1.1 เพิ่ม avatar_version column ใน schema.sql + migration
1.2 ติดตั้ง sharp ใน backend (Dockerfile + package.json)
1.3 สร้าง imageService.js (processAvatarUpload, deleteAvatarFiles)
1.4 ปรับ updateAvatar controller → ใช้ imageService
1.5 ปรับ static serving → เพิ่ม cache headers สำหรับ /uploads/avatars
1.6 ปรับ /api/auth/me → return avatar_version
1.7 ปรับ caregiver search/public endpoints → return avatar_version
1.8 Migrate existing avatar data → avatar_version=1 + process existing files
```

### Phase 2: Frontend Avatar System (1-2 วัน)

```
2.1 สร้าง frontend/src/utils/avatar.ts (getAvatarUrl helper)
2.2 ปรับ Avatar component → เพิ่ม 2xl/3xl sizes + ใช้ getAvatarUrl
2.3 ปรับ AuthContext/api.ts types → เพิ่ม avatar_version field
2.4 Refactor ทุกหน้าที่ใช้ avatar → ใช้ Avatar component + getAvatarUrl:
    - ProfilePage.tsx (avatar upload + display)
    - SearchCaregiversPage.tsx
    - CreateJobPage.tsx (ลบ raw <img>, ใช้ Avatar)
    - Card.tsx (JobCard, RecipientCard)
    - TopBar.tsx (เพิ่ม avatar ใน dropdown)
2.5 ปรับขนาด avatar ในแต่ละหน้าตาม §5.1
```

### Phase 3: Crop UI (1 วัน)

```
3.1 ติดตั้ง react-easy-crop
3.2 สร้าง CropModal component
3.3 สร้าง AvatarUpload component (รวม Avatar + crop + upload)
3.4 ปรับ ProfilePage → ใช้ AvatarUpload แทน file input ตรง
3.5 ทดสอบ crop flow: เลือกรูป → crop → preview → upload → display
```

### Phase 4: Polish + Testing (1 วัน)

```
4.1 ทดสอบ upload flow: crop → resize → display ทุก variant
4.2 ทดสอบ edge cases: รูปเล็กเกินไป, format ผิด, network error
4.3 ทดสอบ cache busting: upload ใหม่ → รูปเปลี่ยนทันที
4.4 ทดสอบ backward compatibility: legacy avatar path ยังทำงานได้
4.5 ทดสอบบน mobile: crop UX, upload speed
4.6 Lighthouse audit: image size, LCP impact
```

### Phase 5: Future (optional)

```
5.1 Portrait variant (3:4) สำหรับ caregiver public profile
5.2 AVIF format support (เล็กกว่า WebP ~20%)
5.3 CDN/S3 migration (ย้ายจาก local disk → object storage)
5.4 Lazy loading + blur placeholder (LQIP)
5.5 AI face detection สำหรับ auto-crop center
```

---

## 10. จุดที่ต้องระวัง

### 10.1 sharp ใน Docker

- sharp ต้อง native build → ตรวจ Dockerfile ว่ามี build tools
- Alpine Linux: ต้อง `apk add --no-cache build-base python3`
- หรือใช้ `--platform` flag ตอน `npm install`
- **ทดสอบใน Docker container ก่อน deploy**

### 10.2 Memory Usage

- sharp ใช้ memory น้อยกว่า alternatives (stream-based)
- แต่ถ้ามี concurrent uploads หลายตัว → ตั้ง limit
- แนะนำ: `sharp.concurrency(2)` สำหรับ small servers

### 10.3 File Cleanup

- ต้อง cleanup orphaned files ถ้า DB update fail
- ใช้ try-catch + cleanup ใน finally block
- อาจสร้าง cron job สำหรับ cleanup orphaned avatar directories

### 10.4 Security

- **ห้าม serve file ที่ user กำหนด path** → ใช้ userId + variant name ที่ fixed
- Multer `fileFilter` ต้อง validate MIME type + magic bytes
- Rate limit avatar upload (e.g., 5 ครั้ง/ชั่วโมง)
- ไม่เก็บ EXIF data (sharp strip metadata by default)

### 10.5 Backward Compatibility

- **ห้ามลบ `avatar` column ทันที** — ใช้ deprecation strategy:
  1. เพิ่ม `avatar_version` → ทำงานคู่กับ `avatar`
  2. Migrate data: ย้าย existing files → new path structure
  3. Frontend support ทั้ง old + new format
  4. หลังจาก deploy + verify → ลบ `avatar` column + code

### 10.6 Upload Size on Mobile

- ภาพจาก iPhone อาจ 5-15MB (HEIC) → ต้อง client-side compress ก่อน crop
- หรือเพิ่ม upload limit เป็น 10MB + let sharp handle conversion
- แสดง progress bar สำหรับ upload ที่ช้า

### 10.7 Placeholder / Loading State

- ขณะ upload → แสดง skeleton/spinner บน avatar
- ขณะ load image → แสดง initials fallback
- `<img loading="lazy">` สำหรับ avatar ที่อยู่ below fold

### 10.8 ไม่มี avatar_version ≠ ไม่มีรูป

- `avatar_version = 0` → ไม่มีรูป → แสดง initials
- `avatar_version >= 1` → มีรูป → สร้าง URL จาก userId + version
- ตรวจ `avatar_version` เป็น truthy ไม่พอ → ต้องเช็ค `> 0` explicitly

---

## Appendix: ไฟล์ที่ต้องแก้ไข (ทุก Phase)

### Backend
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `database/schema.sql` | เพิ่ม `avatar_version` column |
| `backend/database/migrations/new.sql` | Migration สำหรับ avatar_version |
| `backend/package.json` | เพิ่ม `sharp` dependency |
| `backend/Dockerfile` | เพิ่ม build tools สำหรับ sharp (ถ้าจำเป็น) |
| `backend/src/services/imageService.js` | ใหม่ — image processing |
| `backend/src/controllers/authController.js` | ปรับ updateAvatar, getMe |
| `backend/src/routes/authRoutes.js` | ปรับ upload limit (5MB → 10MB) |
| `backend/src/server.js` | ปรับ static serving cache headers |

### Frontend
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `frontend/package.json` | เพิ่ม `react-easy-crop` |
| `frontend/src/utils/avatar.ts` | ใหม่ — URL resolver |
| `frontend/src/components/ui/Avatar.tsx` | เพิ่ม 2xl/3xl sizes, ใช้ getAvatarUrl |
| `frontend/src/components/ui/AvatarUpload.tsx` | ใหม่ — upload + crop |
| `frontend/src/components/ui/CropModal.tsx` | ใหม่ — crop UI |
| `frontend/src/components/ui/index.ts` | Export ใหม่ |
| `frontend/src/services/api.ts` | ปรับ types + upload method |
| `frontend/src/contexts/AuthContext.tsx` | ปรับ User type → avatar_version |
| `frontend/src/pages/shared/ProfilePage.tsx` | ใช้ AvatarUpload, ปรับขนาด |
| `frontend/src/pages/hirer/SearchCaregiversPage.tsx` | ใช้ Avatar + getAvatarUrl |
| `frontend/src/pages/hirer/CreateJobPage.tsx` | ลบ raw `<img>`, ใช้ Avatar |
| `frontend/src/components/ui/Card.tsx` | ปรับ JobCard avatar size |
| `frontend/src/components/navigation/TopBar.tsx` | เพิ่ม avatar ใน dropdown |
