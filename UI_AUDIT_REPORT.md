# รายงานการตรวจสอบ UI (UI Audit Report)
**โปรเจกต์:** Careconnect Frontend  
**วันที่ตรวจ:** 21 กุมภาพันธ์ 2569  
**ผู้ตรวจ:** Cascade AI (UI/UX Auditor + Frontend Engineer)  
**Baseline:** WCAG 2.1 AA, Tailwind CSS Design System, Sarabun/Noto Sans Thai

---

## สรุปภาพรวม (Executive Summary)

| หมวด | จำนวน Issues | Critical | High | Medium | Low |
|------|-------------|----------|------|--------|-----|
| Typography | 8 | 0 | 3 | 4 | 1 |
| Buttons | 6 | 1 | 2 | 2 | 1 |
| Forms | 7 | 1 | 3 | 2 | 1 |
| Layout | 5 | 0 | 2 | 2 | 1 |
| Accessibility (a11y) | 9 | 2 | 4 | 2 | 1 |
| **รวม** | **35** | **4** | **14** | **12** | **5** |

---

## หมวด 1: Typography

| # | Issue | ไฟล์ | Severity | Guideline |
|---|-------|------|----------|-----------|
| T1 | Heading sizes ไม่สอดคล้องกัน — บางหน้าใช้ `text-2xl font-bold`, บางหน้าใช้ `text-xl font-semibold` สำหรับ page title เดียวกัน | HirerHomePage, CaregiverJobFeedPage, AdminDashboard | High | ต้องใช้ scale เดียวกัน: h1=2xl, h2=xl, h3=lg |
| T2 | Helper text / error text ไม่สอดคล้อง — Input ใช้ `text-sm text-red-600` แต่บางหน้า inline error ใช้ `text-xs text-red-500` | CreateJobPage, CareRecipientFormPage | High | ต้องใช้ `text-sm text-red-600` เหมือนกันทุกที่ |
| T3 | Section label ไม่สอดคล้อง — บางที่ใช้ `text-xs font-semibold text-gray-500 uppercase`, บางที่ใช้ `text-sm font-bold text-gray-700` | ProfilePage, AdminUsersPage, HirerWalletPage | High | กำหนด section label style เดียว |
| T4 | Font weight ไม่สอดคล้อง — label ฟอร์มบางที่ `font-medium`, บางที่ `font-semibold` | ConsentPage (raw checkbox), TopBar dropdown | Medium | Input/Select/Textarea component ใช้ `font-semibold` แล้ว แต่ยังมี raw label ที่ไม่ตรง |
| T5 | Line height ไม่ระบุใน body text ยาว — ทำให้อ่านยากบนมือถือ | ContactPage, AboutPage, FAQPage | Medium | เพิ่ม `leading-relaxed` หรือ `leading-7` ใน paragraph |
| T6 | ตัวเลขสถิติ/จำนวนเงิน ไม่ใช้ tabular numerals | WalletPage, EarningsHistoryPage | Medium | เพิ่ม `font-variant-numeric: tabular-nums` หรือ `font-mono` |
| T7 | Truncation ไม่สม่ำเสมอ — บางที่ใช้ `truncate`, บางที่ใช้ `line-clamp-2` โดยไม่มีเหตุผล | SearchCaregiversPage, JobCard | Medium | กำหนด rule: 1 บรรทัด=truncate, หลายบรรทัด=line-clamp |
| T8 | `text-[11px]` hardcode ขนาด — ใช้หลายที่แทนที่จะใช้ `text-xs` | AdminUsersPage (line 395), TopBar (line 312) | Low | แทนด้วย `text-xs` (12px) หรือ `text-[10px]` ถ้าต้องการเล็กกว่า |

---

## หมวด 2: Buttons

| # | Issue | ไฟล์ | Severity | Guideline |
|---|-------|------|----------|-----------|
| B1 | Raw `<button>` ที่ไม่ผ่าน Button component — ขาด focus ring, disabled state, และ consistent padding | TopBar (logout, switch role), AdminLayout (sidebar toggle), BottomBar ไม่มีปัญหา | Critical | ทุก interactive button ต้องมี `focus:ring-2 focus:ring-blue-500` |
| B2 | Icon-only button ไม่มี `aria-label` — ผู้ใช้ screen reader ไม่รู้ว่าปุ่มทำอะไร | TopBar (Bell icon, Menu icon), AdminLayout (sidebar toggle), ChatRoomPage | High | เพิ่ม `aria-label` ทุก icon-only button |
| B3 | Button ขนาดเล็กเกินไปบน mobile — touch target < 44×44px | หลายหน้า: `size="sm"` = `px-3.5 py-2` ≈ 36px สูง | High | WCAG 2.5.5: touch target ≥ 44×44px บน mobile |
| B4 | Disabled state ไม่สม่ำเสมอ — บางปุ่มใช้ `disabled:opacity-60` (จาก Button component), บางที่ inline `opacity-50` | TopBar switchRole button (line 324) | Medium | ใช้ Button component แทน raw button |
| B5 | Loading state ปุ่มไม่มี `aria-busy` — ผู้ใช้ screen reader ไม่รู้ว่ากำลังโหลด | CreateJobPage, LoginEmailPage, LoginPhonePage | Medium | เพิ่ม `aria-busy={isLoading}` และ `aria-live="polite"` |
| B6 | Danger action ไม่มี confirmation เพียงพอ — ปุ่มลบบางที่ไม่มี modal ยืนยัน | AdminUsersPage (suspend/delete inline) | Low | ใช้ ConfirmModal สำหรับ destructive actions |

---

## หมวด 3: Forms

| # | Issue | ไฟล์ | Severity | Guideline |
|---|-------|------|----------|-----------|
| F1 | Raw `<input type="checkbox">` ไม่ผ่าน component — ขาด label association, focus style ไม่สอดคล้อง | ConsentPage (3 checkboxes, line 123/164/207), MemberRegisterPage, GuestRegisterPage | Critical | ต้องมี `<label>` ที่ associate กับ `id` หรือใช้ CheckboxGroup component |
| F2 | Form validation error แสดงไม่สอดคล้อง — บางหน้า error ขึ้นทันที onChange, บางหน้าขึ้นเฉพาะ onSubmit | CreateJobPage vs LoginEmailPage | High | กำหนด policy: validate onBlur + onSubmit |
| F3 | Required field indicator ไม่สม่ำเสมอ — Input/Select/Textarea component มี `*` แดง แต่ raw form fields ไม่มี | ConsentPage, MemberRegisterPage | High | ทุก required field ต้องมี `*` และ `aria-required="true"` |
| F4 | Placeholder ใช้แทน label — บางฟอร์มมีแค่ placeholder ไม่มี label จริง | SearchCaregiversPage (filter selects ใช้ aria-label แต่ไม่มี visible label) | High | Placeholder หายไปเมื่อพิมพ์ — ต้องมี label จริงเสมอ |
| F5 | Error message ไม่ชัดเจน — บางที่แค่ "กรุณากรอก" โดยไม่บอกว่ากรอกอะไร | LoginEmailPage, ForgotPasswordPage | Medium | Error ต้องบอก: อะไรผิด + วิธีแก้ |
| F6 | Form group spacing ไม่สอดคล้อง — บางที่ `gap-4`, บางที่ `gap-6`, บางที่ `space-y-4` | CreateJobPage, CareRecipientFormPage, ProfilePage | Medium | กำหนด standard: `space-y-4` ใน form section |
| F7 | Select ไม่มี default empty option ที่ชัดเจน — บางที่ไม่มี placeholder option | HirerWalletPage, EarningsHistoryPage | Low | เพิ่ม `<option value="">-- เลือก --</option>` เป็น default |

---

## หมวด 4: Layout

| # | Issue | ไฟล์ | Severity | Guideline |
|---|-------|------|----------|-----------|
| L1 | Max-width ไม่สอดคล้อง — บางหน้าใช้ `max-w-7xl`, บางหน้าใช้ `max-w-4xl`, บางหน้าไม่มี max-width เลย | AboutPage, ContactPage vs MainLayout | High | กำหนด page container: `max-w-7xl mx-auto px-4` |
| L2 | Page padding ไม่สอดคล้อง — บางหน้า `p-4`, บางหน้า `px-4 py-6`, บางหน้า `p-6` | ทุกหน้าใน /pages | High | กำหนด standard: `px-4 py-4 sm:px-6` |
| L3 | Card padding ไม่สอดคล้อง — บางที่ `p-4`, บางที่ `p-6`, บางที่ `p-3` | HirerHomePage, SearchCaregiversPage, AdminDashboard | Medium | Card component ควร default `p-4` และ override ได้ |
| L4 | Mobile bottom padding ไม่เพียงพอ — content ถูก BottomBar บัง | หลายหน้าที่มี fixed content ด้านล่าง | Medium | MainLayout ใช้ `pb-16` แล้ว แต่บางหน้า override ด้วย padding ตัวเอง |
| L5 | Responsive breakpoint ไม่สม่ำเสมอ — บางที่ใช้ `sm:`, บางที่ข้ามไป `lg:` โดยไม่มี `md:` | AdminLayout, SearchCaregiversPage | Low | กำหนด breakpoint strategy: mobile-first, sm=640, lg=1024 |

---

## หมวด 5: Accessibility (a11y)

| # | Issue | ไฟล์ | Severity | WCAG Criterion |
|---|-------|------|----------|----------------|
| A1 | Icon-only button ไม่มี `aria-label` | TopBar (Bell, Menu), AdminLayout (toggle), ChatRoomPage (send, attach) | Critical | 1.1.1 Non-text Content |
| A2 | Modal ไม่มี focus trap — กด Tab ออกนอก modal ได้ | Modal component, ConfirmModal | Critical | 2.1.2 No Keyboard Trap (ต้องอยู่ใน modal) |
| A3 | Color เป็น sole indicator — status badge ใช้แค่สี ไม่มี icon/text เพิ่มเติม | Badge component (success=green, danger=red) | High | 1.4.1 Use of Color |
| A4 | Skip navigation link ไม่มี — ผู้ใช้ keyboard ต้อง Tab ผ่าน TopBar ทุกครั้ง | TopBar | High | 2.4.1 Bypass Blocks |
| A5 | Live region ไม่มีสำหรับ toast/notification — screen reader ไม่ประกาศ | react-hot-toast ใช้อยู่ แต่ไม่มี aria-live region backup | High | 4.1.3 Status Messages |
| A6 | Dropdown menu ไม่มี keyboard navigation ครบ — ไม่รองรับ Escape key, Arrow keys | TopBar dropdown menu | High | 2.1.1 Keyboard |
| A7 | Form error ไม่ focus อัตโนมัติเมื่อ submit ผิด — ผู้ใช้ไม่รู้ว่า error อยู่ที่ไหน | LoginEmailPage, CreateJobPage | Medium | 3.3.1 Error Identification |
| A8 | Image alt text ขาด — รูปโปรไฟล์และรูปใน LandingPage ไม่มี alt ที่มีความหมาย | LandingPage, ProfilePage | Medium | 1.1.1 Non-text Content |
| A9 | Contrast ratio ต่ำ — `text-gray-400` บน `bg-white` = ~2.9:1 (ต้องการ 4.5:1) | หลายหน้า: helper text, placeholder, secondary text | Low | 1.4.3 Contrast (Minimum) |

---

## แผนการแก้ไข (Fix Plan)

### ลำดับความสำคัญ

```
PR-A11Y  (Critical+High a11y)  ← ทำก่อน
PR-FORMS (Critical+High forms) ← ทำที่ 2
PR-BTNS  (Buttons)             ← ทำที่ 3
PR-TYPO  (Typography)          ← ทำที่ 4
PR-LAYOUT (Layout)             ← ทำที่ 5
```

### PR-A11Y: แก้ปัญหา Accessibility เร่งด่วน
- [ ] A1: เพิ่ม `aria-label` ทุก icon-only button
- [ ] A2: เพิ่ม focus trap ใน Modal component
- [ ] A4: เพิ่ม skip navigation link ใน TopBar
- [ ] A6: เพิ่ม keyboard navigation (Escape, Arrow) ใน TopBar dropdown

### PR-FORMS: แก้ปัญหาฟอร์ม
- [ ] F1: แก้ raw checkbox ใน ConsentPage, MemberRegisterPage, GuestRegisterPage
- [ ] F2/F3: เพิ่ม required indicator และ standardize error display
- [ ] B1: แก้ raw button ที่ขาด focus ring

### PR-BTNS: แก้ปัญหาปุ่ม
- [ ] B2: เพิ่ม aria-label ทุก icon-only button
- [ ] B3: เพิ่ม minimum touch target บน mobile
- [ ] B4/B5: standardize disabled/loading state

### PR-TYPO: แก้ปัญหา Typography
- [ ] T1: กำหนด heading scale ชัดเจน
- [ ] T2: standardize error text style
- [ ] T3: standardize section label style
- [ ] T8: แทน `text-[11px]` ด้วย `text-xs`

### PR-LAYOUT: แก้ปัญหา Layout
- [ ] L1: standardize max-width
- [ ] L2: standardize page padding
- [ ] L3: standardize card padding

---

## QA Checklist

### Typography
- [ ] Page title ทุกหน้าใช้ `text-2xl font-bold text-gray-900`
- [ ] Section heading ใช้ `text-lg font-semibold text-gray-800`
- [ ] Body text ใช้ `text-sm text-gray-700` หรือ `text-base text-gray-700`
- [ ] Helper/error text ใช้ `text-sm` เสมอ
- [ ] ไม่มี `text-[11px]` hardcode

### Buttons
- [ ] ทุก button มี focus ring (`focus:ring-2 focus:ring-blue-500`)
- [ ] ทุก icon-only button มี `aria-label`
- [ ] Touch target ≥ 44px บน mobile
- [ ] Disabled state ชัดเจน (`disabled:opacity-60 disabled:cursor-not-allowed`)

### Forms
- [ ] ทุก input มี `<label>` ที่ associate ด้วย `htmlFor`
- [ ] Required field มี `*` สีแดงและ `aria-required="true"`
- [ ] Error message ชัดเจน บอกวิธีแก้
- [ ] Error text ใช้ `text-sm text-red-600` เสมอ
- [ ] ไม่มี raw `<input>`, `<select>`, `<textarea>` นอก shared components

### Accessibility (WCAG 2.1 AA)
- [ ] Contrast ratio ≥ 4.5:1 สำหรับ normal text
- [ ] Contrast ratio ≥ 3:1 สำหรับ large text และ UI components
- [ ] ทุก interactive element ใช้ keyboard ได้
- [ ] Modal มี focus trap
- [ ] Skip navigation link มีใน TopBar
- [ ] Screen reader ประกาศ status message ได้
- [ ] ไม่ใช้สีเป็น sole indicator

---

*รายงานนี้จัดทำโดย Cascade AI — อ้างอิง WCAG 2.1 AA และ Tailwind CSS best practices*
