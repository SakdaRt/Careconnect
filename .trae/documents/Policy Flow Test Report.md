# Test Report: Policy Acceptance Flow

## สรุปเคสทดสอบ
- สมัครครั้งแรก → ยอมรับ Policy แล้ว redirect ไป Dashboard/Home ตามบทบาท
- ล็อกอินใหม่แล้วยังไม่ยอมรับ Policy → redirect ไปหน้า Policy
- ล็อกอินใหม่แล้วยอมรับ Policy แล้ว → เข้า Dashboard/Home ได้ตามบทบาท

## หลักฐานการทดสอบ (Commands & Results)

### Frontend Tests
```
docker.exe exec careconnect-frontend npm test -- --run
```
ผลลัพธ์:
- Test Files: 4 passed
- Tests: 40 passed
- Warning: WebSocket server error: Port is already in use
- Warning: React Router future flags (ไม่กระทบผลเทส)

### Backend Tests
```
docker.exe exec careconnect-backend npm test
```
ผลลัพธ์:
- Test Suites: 5 passed
- Tests: 13 passed

### Lint
```
docker.exe exec careconnect-backend npm run lint
docker.exe exec careconnect-frontend npm run lint
```
ผลลัพธ์:
- Backend lint ผ่าน
- Frontend lint ผ่าน
