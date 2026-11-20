# ส่งรายงาน Delay F3PFPF67 ให้ DocHUB (อ่านอย่างเดียว)

DocHUB ดึงแถวที่ **บรรจุเสร็จ** ของ 3 วันล่าสุดทุกวันเวลา 05:00 ไปเก็บในไฟล์ "รายงาน Delay F3PFPF67" — ดูข้อมูล / แดชบอร์ด / ออก PDF F3PFPF67 และ Excel F3PFPV04
ได้จาก DocHUB โดยไม่ต้องเปิดหน้าดำเนินการเสร็จสิ้นของ DelayHUB (ไม่ query หนักกลางกะ)

## ตั้งค่า (ครั้งเดียว)

1. `backend/.env` ของ DelayHUB: `EXPORT_API_KEY=<กุญแจยาว ≥ 16 ตัว>` แล้ว `pm2 reload PFCMv2-backend`
   (สร้างกุญแจ: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)
2. `server/.env` ของ DocHUB: `DELAYHUB_URL=http://<ip ของ DelayHUB>:<port>` และ `DELAYHUB_EXPORT_KEY=<กุญแจเดียวกัน>` แล้ว `pm2 restart dochub`

## API

| | |
|---|---|
| `GET /api/export/f3pfpf67?days=3` | แถวที่บรรจุเสร็จใน 3 วันล่าสุด (1–62) — query เดียวกับตาราง Done (`buildMappingQuery("done")`) |
| `GET /api/export/f3pfpf67?date_from=2026-11-01&date_to=2026-11-30` | ช่วงวันที่ (ไม่เกิน 62 วัน) |
| `GET /api/export/f3pfpf67/template.xlsx` | ไฟล์ต้นฉบับ Excel F3PFPV04 (DocHUB เก็บสำเนาไว้ออก Excel แบบเดียวกัน) |

- ต้องส่ง header `x-export-key: <EXPORT_API_KEY>` · ไม่ตั้งกุญแจ = API ปิด (503) · กุญแจผิด = 403
- อยู่ใน `PUBLIC_ROUTES` (`lib/authMiddleware.js`) เพราะไม่ใช้ token ของผู้ใช้ — กุญแจตรวจใน `routes/ExportRoutes.js`
- คำขอช่วงเดียวกันภายใน 5 นาทีใช้ผลเดิม
- ค่าทุกช่องของแบบฟอร์มคำนวณด้วยไฟล์เดียวกับหน้าเว็บ (`delayReportCore.js`, `fishBatch.js` → Remark, `shiftTime.js` → กะ / วันทำงาน) ผ่าน `lib/delayExport.js`
  → ตัวเลขตรงกับ PDF / Excel ที่ออกจากหน้าดำเนินการเสร็จสิ้นเสมอ (แก้สูตรที่หน้าเว็บ = API เปลี่ยนตาม)

แต่ละแถว: `mapping_id` (คีย์) · `work_day` · `shift` · `line` · `code` · `production` · `mat` · `mat_name` · `batch` · `weight` · `group_no` ·
`prep_date` · `hist` · `color` / `odor` / `texture` · `time_a` … `time_f` (เตรียมเสร็จ / เข้า–ออกห้องเย็น 1, 2 / บรรจุเสร็จ) · `special` ·
`dbs1`…`dbs4` (ข้อความแบบ PDF) · `dbs1_h`…`dbs4_h` (ชั่วโมง แบบ Excel) · `std1_h`…`std4_h` (มาตรฐาน) · `over1`…`over4`, `over_any` (เกินมาตรฐาน) · `remark`


## ข้อมูลรายการตามสลีป (สำหรับ DocHUB ใบตรวจ F3QCPF06)

`GET /api/export/mapping/:mapping_id` (header `x-export-key` เดียวกัน, อ่านอย่างเดียว) → `{ success, data: { mapping_id, code, mat, mat_name, mat_2x, batch, batch_2x } }` · `code` = โค้ดสินค้าของแผน (Production.code) · `batch` = Batch ตั้งต้น · `batch_2x` = Batch 2X · ไม่พบ → 404 · DocHUB เรียกตอนผู้ตรวจสแกน QR สลีป (ช่อง 4 ของ QR = mapping_id)
