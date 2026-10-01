-- ============================================================
-- ตารางเก็บ EPC ที่ reader สแกนเจอแต่ยังไม่มี tro_id ใน RFID_to_Trolley
-- RFIDc1.js จะ upsert ลงตารางนี้ และหน้า RFIDCSCheckOutPage ใช้ดึงมาให้ผูก tro_id
-- (ไม่แก้ตาราง RFID_to_Trolley เดิม) — ให้ DBA รันก่อน deploy
-- ============================================================
IF OBJECT_ID(N'dbo.RFID_Unknown_EPC', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RFID_Unknown_EPC (
        epc           VARCHAR(50) NOT NULL PRIMARY KEY,
        reader_no     INT         NULL,
        scan_count    INT         NOT NULL DEFAULT 1,
        first_seen    DATETIME    NOT NULL DEFAULT GETDATE(),
        last_seen     DATETIME    NOT NULL DEFAULT GETDATE()
    );
END
GO
