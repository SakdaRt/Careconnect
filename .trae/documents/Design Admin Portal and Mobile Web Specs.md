# แผนการออกแบบ Admin Portal และ Mobile Web Specs

## 0. ข้อกำหนดเทคโนโลยีให้ตรงกับของจริง
**สถานะ:** ยืนยันแล้วให้ปรับ requirement ให้สอดคล้องกับสแต็กจริงเพื่อแก้ไขง่ายและพัฒนาง่าย
**สแต็กจริงของโปรเจค:**
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Axios, Context/Zustand
- Backend: Node.js, Express, PostgreSQL (pg), JWT, Socket.IO
- Testing: Backend ใช้ Jest, Frontend ใช้ Vitest
- Deployment: Docker/Docker Compose
**สิ่งที่ไม่ใช้ตาม requirement เดิม:** Redux Toolkit, MongoDB, Webpack, React Testing Library
**แนวทาง:** ปรับเอกสาร/สเปคทั้งหมดให้ยึดสแต็กจริงเป็นฐาน และเสริมเฉพาะส่วนที่ต้องการจริงภายหลัง (เช่น i18n, caching, monitoring)

## 1. สร้างเอกสาร `12-admin-portal-design.md`
**สถานะ:** จัดทำแล้วใน [docs/phase-1/12-admin-portal-design.md](../../docs/phase-1/12-admin-portal-design.md)
**ขอบเขต:** สเปคหน้าจอและ workflow สำหรับ Admin แบบ exception-based โดยยึด Navigation Contract
**จุดที่ต้องระวัง:** การสื่อสารกับผู้ใช้ต้องผ่าน Dispute Chat เท่านั้น และทุกการเงินต้องยึด ledger append-only + audit

## 2. สร้างเอกสาร `13-mobile-web-specs.md`
**สถานะ:** จัดทำแล้วใน [docs/phase-1/13-mobile-web-specs.md](../../docs/phase-1/13-mobile-web-specs.md)
**ขอบเขต:** ข้อกำหนด UX/ข้อจำกัดเทคนิคสำหรับ Mobile Web โดยไม่เพิ่มหน้าเกิน Navigation Contract
**จุดที่ต้องระวัง:** GPS/Notifications/Camera ต้องออกแบบให้เป็น requirement ระดับพฤติกรรม ไม่ลงรายละเอียดเชิง implementation

## 3. อัปเดต `README.md`
**สถานะ:** อัปเดตสารบัญเอกสารใน [docs/phase-1/README.md](../../docs/phase-1/README.md) และเพิ่มสเปค third-party (15)
