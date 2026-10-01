-- ============================================================
-- RFID + Cold Storage Round 2 - รันครั้งเดียวบน PFCMv2
-- ครอบคลุม: History columns, Reader, ReaderScanLog, TrolleyRMMapping.confirmed_location
-- ทุกบล็อกมี guard (IF NOT EXISTS / IF COL_LENGTH) ไม่ error ถ้ามีอยู่แล้ว
--
-- หมายเหตุ:
--   * RFIDReaderConfig จัดการโดยไฟล์ create_RFIDReaderConfig.sql (แยกไฟล์) - ห้ามรันซ้ำ
--   * pd_remark_1/2/3, at_pd_storage_purpose*, at_pd_histamine* มีใน PFCMv2 อยู่แล้ว
--     (โค้ด main ใช้อยู่) - ไฟล์นี้จึงไม่เกี่ยวข้อง
--   * ตาราง anomaly_flags / fix_audit_log / fix_login_log / fix_users / login_log /
--     SystemConfig ไม่ใช่ส่วนของ merge RFID นี้
-- ============================================================

USE [PFCMv2];
GO

-- 1) History - คอลัมน์ RFID + วันที่หมดอายุรอบ 2/3 (RFIDc1.js + PUT /coldstorage/input/coldstorage)
IF COL_LENGTH(N'dbo.History', N'reader_ip') IS NULL
    ALTER TABLE dbo.History ADD reader_ip VARCHAR(50) NULL;
IF COL_LENGTH(N'dbo.History', N'reader_scan_time') IS NULL
    ALTER TABLE dbo.History ADD reader_scan_time DATETIME2 NULL;
IF COL_LENGTH(N'dbo.History', N'reader_name') IS NULL
    ALTER TABLE dbo.History ADD reader_name NVARCHAR(100) NULL;
IF COL_LENGTH(N'dbo.History', N'at_pd_expiry_date') IS NULL
    ALTER TABLE dbo.History ADD at_pd_expiry_date DATE NULL;
IF COL_LENGTH(N'dbo.History', N'at_pd_expiry_date_2') IS NULL
    ALTER TABLE dbo.History ADD at_pd_expiry_date_2 DATE NULL;
IF COL_LENGTH(N'dbo.History', N'at_pd_expiry_date_3') IS NULL
    ALTER TABLE dbo.History ADD at_pd_expiry_date_3 DATE NULL;
GO

-- 2) Reader - เครื่องอ่าน RFID (RFIDc1.js JOIN เพื่ออัปเดต History.reader_ip/reader_name)
IF OBJECT_ID(N'dbo.Reader', N'U') IS NULL
BEGIN
    CREATE TABLE Reader (
        reader_id          INT IDENTITY(1,1) PRIMARY KEY,
        reader_ip          VARCHAR(50)  NOT NULL,
        reader_description NVARCHAR(255) NULL,
        reader_port        INT          NULL,
        delay_minutes      INT          NULL,
        is_enabled         BIT          DEFAULT 1
    );

    -- seed เครื่องอ่านที่ RFIDc1.js ใช้ (READER_NO=1) - ต้องใช้ IDENTITY_INSERT
    SET IDENTITY_INSERT Reader ON;
    IF NOT EXISTS (SELECT 1 FROM Reader WHERE reader_id = 1)
        INSERT INTO Reader (reader_id, reader_ip, reader_description, reader_port, delay_minutes, is_enabled)
        VALUES (1, '192.168.1.100', N'RFID_READER_1', 49152, 1, 1);
    SET IDENTITY_INSERT Reader OFF;
END
GO

-- 3) ReaderScanLog - ประวัติการสแกน (RFIDc1.js INSERT, rfidScanTrigger.js SELECT)
IF OBJECT_ID(N'dbo.ReaderScanLog', N'U') IS NULL
BEGIN
    CREATE TABLE ReaderScanLog (
        log_id    INT IDENTITY(1,1) PRIMARY KEY,
        hist_id   INT      NULL,
        reader_id INT      NULL,
        scan_time DATETIME DEFAULT GETDATE()
    );
END
GO

-- 4) TrolleyRMMapping.confirmed_location - ใช้โดย PUT /trolley/confirm-location / reset-location
--    และ PUT /coldstorage/input/coldstorage (reset เป็น NULL)
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'confirmed_location') IS NULL
    ALTER TABLE dbo.TrolleyRMMapping ADD confirmed_location NVARCHAR(50) NULL;
GO

PRINT N'rfid_additions.sql เรียบร้อย (History RFID cols, Reader+seed, ReaderScanLog, confirmed_location)';
GO