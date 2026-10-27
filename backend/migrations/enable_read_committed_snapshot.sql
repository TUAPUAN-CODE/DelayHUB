-- เปิด READ_COMMITTED_SNAPSHOT (RCSI) ที่ฐาน PFCMv2 — ให้ DBA รันเองนอกกะผลิต (ไม่อยู่ใน migrations/auto จึงไม่ถูกรันอัตโนมัติ)
--
-- ทำไม: ช่วงคนใช้เยอะ query อ่านหนัก (หน้า Sheet, ตรวจ QC, รายการส่งออกห้องเย็น) ต้องรอล็อกของคนบันทึก (TrolleyRMMapping / Slot)
--       และบันทึกที่ชนกันเกิด deadlock (error 1205) — ใน log เห็น UPDATE แถวเดียวหมดเวลา 30 วินาที และ SELECT ถูกเลือกเป็นเหยื่อ deadlock
--       RCSI ทำให้ SELECT อ่านข้อมูลเวอร์ชันล่าสุดที่ commit แล้วโดยไม่ขอล็อกอ่าน → คนอ่านไม่ขวางคนเขียน และไม่ถูกขวางโดยคนเขียน
--
-- สิ่งที่ไม่เปลี่ยน: คนเขียนยังรอคนเขียนด้วยกันตามเดิม (UPDLOCK/HOLDLOCK ใน route จองช่อง/ย้ายรถเข็นยังทำงานเหมือนเดิม) และ RCSI ไม่ลดการใช้ CPU
-- ผลข้างเคียง: เก็บเวอร์ชันของแถวใน tempdb เพิ่มขึ้น → ตรวจพื้นที่ว่างของไดรฟ์ที่ tempdb อยู่ก่อน และดู CPU/IO หลังเปิด 1–2 วัน
--
-- วิธีใช้:
--   1) รันส่วน "ตรวจสถานะ" ก่อน (อ่านอย่างเดียว) — ถ้า is_read_committed_snapshot_on = 1 อยู่แล้ว ไม่ต้องทำอะไรต่อ
--   2) ช่วงที่ไม่มีคนใช้งาน (หรือแจ้งผู้ใช้ก่อน): หยุด backend (pm2 stop PFCMv2-backend ฯลฯ ตามแผนหยุดชั่วคราว) แล้วรันคำสั่ง ALTER ด้านล่าง
--      WITH ROLLBACK IMMEDIATE จะตัดทุก connection ในฐานและ rollback transaction ที่ค้างอยู่ — เอา comment ออกเฉพาะบรรทัดที่ตั้งใจจะรัน
--   3) pm2 start/reload ให้ backend ต่อใหม่ แล้วตรวจสถานะซ้ำ
--
-- ย้อนกลับ: ใช้คำสั่ง "ปิด" ด้านล่าง (ต้องหยุด backend แบบเดียวกัน)

-- ===== ตรวจสถานะ (อ่านอย่างเดียว) =====
SELECT name, is_read_committed_snapshot_on, snapshot_isolation_state_desc
FROM sys.databases
WHERE name = N'PFCMv2';

-- ===== เปิด =====
-- ALTER DATABASE [PFCMv2] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;

-- ===== ปิด (ย้อนกลับ) =====
-- ALTER DATABASE [PFCMv2] SET READ_COMMITTED_SNAPSHOT OFF WITH ROLLBACK IMMEDIATE;
