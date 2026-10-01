-- ============================================================
-- เพิ่มคอลัมน์ printer_host / printer_share ให้ RFIDReaderConfig
-- สำหรับระบบพิมพ์สลิปแบบ RAW ESC/POS จากส่วนกลาง (print-agent ตัวเดียว
-- รันที่เซิร์ฟเวอร์หลัก แล้วส่ง byte ดิบข้าม network ไปที่เครื่องพิมพ์ที่แชร์ไว้
-- ในแต่ละสถานี ผ่าน \\<printer_host>\<printer_share> แทนการรัน print-agent
-- แยกทุกเครื่อง)
--
-- printer_host   = ชื่อเครื่อง หรือ IP ของคอมที่แชร์เครื่องพิมพ์นั้นไว้ (เช่น STATION-PC-01)
-- printer_share  = ชื่อ share ของเครื่องพิมพ์บนเครื่องนั้น (ตั้งจาก Printer properties > Sharing)
-- ถ้าทั้งสองค่านี้ว่าง ระบบจะ fallback ไปใช้วิธีเดิม (print-agent local + kiosk-printing)
-- ============================================================

IF COL_LENGTH(N'dbo.RFIDReaderConfig', N'printer_host') IS NULL
    ALTER TABLE dbo.RFIDReaderConfig ADD printer_host NVARCHAR(255) NULL;
GO

IF COL_LENGTH(N'dbo.RFIDReaderConfig', N'printer_share') IS NULL
    ALTER TABLE dbo.RFIDReaderConfig ADD printer_share NVARCHAR(255) NULL;
GO

-- ความกว้างของแถบพิมพ์เป็นจำนวนจุด (dots) — ค่ามาตรฐานเครื่องพิมพ์ความร้อน 80mm ที่ 203dpi คือ 576
-- ปรับได้ต่อเครื่องถ้าพิมพ์ครั้งแรกแล้วภาพล้นขอบ/เล็กเกินไป
IF COL_LENGTH(N'dbo.RFIDReaderConfig', N'printer_dot_width') IS NULL
    ALTER TABLE dbo.RFIDReaderConfig ADD printer_dot_width INT NULL;
GO

PRINT N'add_printer_network_target.sql เรียบร้อย (printer_host, printer_share, printer_dot_width)';
GO
