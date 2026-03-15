# CareConnect — Overlay & Mobile Viewport QA Checklist

> อัพเดทล่าสุด: 2026-03-15
> ใช้สำหรับ manual QA ก่อน demo / release

---

## Z-Index Layering Hierarchy (verified)

| Layer | Z-Index | Components | Status |
|-------|---------|-----------|--------|
| **Toast** | 9999 | react-hot-toast (Toaster) | ✅ สูงสุด — แสดงทับทุกอย่าง |
| **Accessibility** | z-[100] | Skip navigation link | ✅ เฉพาะ focus state |
| **Blocker** | z-[60] | CreateJobPage unsaved-changes modal | ✅ เหนือ modal ทั่วไป |
| **Global Chrome** | z-50 | TopBar header, TopBar dropdown, Modal, AdminLayout sidebar | ✅ |
| **App Nav** | z-40 | BottomBar (hirer/caregiver), TopBar dropdown backdrop, AdminLayout sidebar backdrop, CreateJobPage wizard nav | ✅ |

---

## QA Test Cases (screenshot-less)

### 1. Toast + Modal Interaction
- [ ] เปิด Modal (เช่น review modal ใน CreateJobPage) → trigger toast (success/error) → toast แสดงทับ Modal ✅
- [ ] Toast ไม่ถูก clip โดย Modal content
- [ ] Toast dismiss ได้ปกติแม้ Modal เปิดอยู่

### 2. TopBar Dropdown
- [ ] กด menu → dropdown แสดงทับ content ✅
- [ ] กด backdrop (พื้นที่นอก dropdown) → dropdown ปิด ✅
- [ ] กด Escape → dropdown ปิด ✅
- [ ] Scroll page → dropdown ยังอยู่ตำแหน่งถูกต้อง
- [ ] Mobile: dropdown ไม่หลุดออกนอกหน้าจอ

### 3. BottomBar + Content
- [ ] Hirer pages: BottomBar มองเห็นได้ครบ 4 tabs ✅
- [ ] Caregiver pages: BottomBar มองเห็นได้ครบ 4 tabs ✅
- [ ] Content ล่างสุดไม่ถูก BottomBar ทับ (มี pb-20) ✅
- [ ] iOS: BottomBar ไม่ถูก home indicator บัง (safe-area-bottom) ✅

### 4. CreateJobPage Wizard Nav
- [ ] Step 1: เห็นปุ่ม "ถัดไป →" ชัดเจน ✅
- [ ] Step 2-4: เห็นทั้ง "← ย้อนกลับ" และ "ถัดไป →" ✅
- [ ] Step 5: เห็น "← ย้อนกลับ" และ "✓ ยืนยันบันทึกแบบร่าง" ✅
- [ ] Success screen: ไม่มี sticky nav (ถูกต้อง) ✅
- [ ] BottomBar ไม่แสดงระหว่างใช้ wizard (showBottomBar=false) ✅
- [ ] iOS: wizard nav ไม่ถูก home indicator บัง ✅

### 5. Modal Stack
- [ ] Modal backdrop คลิกปิดได้ ✅
- [ ] Modal เปิดทับ content + BottomBar ✅
- [ ] Caregiver preview modal เปิด/ปิดได้ใน Step 4 ✅
- [ ] Template switch modal เปิด/ปิดได้ใน Step 1 ✅
- [ ] Review modal เปิด/ปิดได้ใน Step 5 ✅
- [ ] Unsaved changes blocker modal (z-60) แสดงทับ modal อื่น ✅

### 6. Admin Layout
- [ ] Sidebar (desktop): แสดงปกติ ไม่ทับ content ✅
- [ ] Sidebar (mobile): เปิด → backdrop แสดง → กด backdrop ปิด ✅
- [ ] Modal ใน admin page แสดงทับ sidebar ✅

### 7. Mobile-Specific
- [ ] iPhone notch: TopBar ไม่ถูกบัง
- [ ] iPhone home indicator: BottomBar / wizard nav ไม่ถูกบัง (safe-area-bottom)
- [ ] Android: fixed elements ทำงานปกติ
- [ ] Landscape mode: BottomBar ไม่ block content มากเกินไป
- [ ] Keyboard open: fixed bottom elements ไม่กระโดดขึ้นบน Android (browser-dependent)

### 8. Chat Page
- [ ] ChatLayout BottomBar แสดงปกติ ✅
- [ ] Message input ไม่ถูก BottomBar ทับ
- [ ] Keyboard open + chat input visible (iOS/Android)

---

## Known Limitations

| Issue | Status | หมายเหตุ |
|-------|--------|---------|
| iOS keyboard pushes fixed elements | ⚠️ Browser-dependent | ไม่มี CSS fix ที่สมบูรณ์ — ใช้ `dvh` unit ใน ChatLayout แล้ว |
| Android keyboard hides input | ⚠️ Browser-dependent | `resize` behavior ขึ้นกับ browser version |
| LoadingOverlay (z-50) | ✅ ไม่ใช้จริง | Component มีอยู่แต่ไม่ถูก import จากหน้าไหน |
