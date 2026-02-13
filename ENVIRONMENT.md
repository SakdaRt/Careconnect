# Environment Variables

## Frontend (Vite)

สร้างไฟล์ `frontend/.env.local` และกำหนดค่าตัวแปรต่อไปนี้

```
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### Google Maps API Key

1. สร้าง API Key ที่ Google Cloud Console
2. เปิดใช้งาน Places API ให้กับโปรเจ็กต์
3. ตั้งค่า API Key restriction ให้เหมาะสม
   - Web app: จำกัดด้วย HTTP referrer เช่น http://localhost:5173/*
   - Server/Dev: จำกัดด้วย IP address ตามสภาพแวดล้อม

หลังตั้งค่าแล้วให้ restart dev server เพื่อให้ค่าใหม่ถูกโหลด
