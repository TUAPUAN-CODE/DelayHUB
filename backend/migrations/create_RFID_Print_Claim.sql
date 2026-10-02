-- ============================================================
-- ตารางจองสิทธิ์ "พิมพ์สลิปของการสแกนครั้งนี้" — กันสลิปออกซ้ำเมื่อมีหลายเบราว์เซอร์/หลายเครื่องเปิดสวิตช์พิมพ์อัตโนมัติ
-- (เบราว์เซอร์ที่ INSERT scan_id สำเร็จเป็นตัวเดียวที่ได้พิมพ์) — ให้ DBA รันก่อน deploy
-- ============================================================
IF OBJECT_ID(N'dbo.RFID_Print_Claim', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RFID_Print_Claim (
        scan_id     VARCHAR(100) NOT NULL PRIMARY KEY,
        claimed_by  VARCHAR(100) NULL,
        claimed_at  DATETIME     NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_RFID_Print_Claim_At ON dbo.RFID_Print_Claim (claimed_at);
END
GO
