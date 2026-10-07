-- ตั้งค่าตารางรวม (Master Delay Sheet) ต่อ user: คอลัมน์ที่แสดง / ลำดับ / กลุ่มที่ย่อ
-- ให้ DBA รันครั้งเดียวก่อนใช้งานการบันทึกการตั้งค่าลงฐานข้อมูล
-- (ถ้ายังไม่ได้รัน หน้าตารางจะเก็บการตั้งค่าไว้ใน browser ชั่วคราวและแจ้งเตือน ไม่พัง)
-- Rollback:  DROP TABLE dbo.SheetUserPrefs;   (ตารางนี้ไม่มี FK เข้าตารางอื่น ลบได้โดยไม่กระทบข้อมูลการผลิต)
IF OBJECT_ID(N'dbo.SheetUserPrefs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SheetUserPrefs (
        user_id     INT            NOT NULL,
        sheet_key   NVARCHAR(50)   NOT NULL,
        config      NVARCHAR(MAX)  NOT NULL,
        updated_at  DATETIME       NOT NULL CONSTRAINT DF_SheetUserPrefs_updated DEFAULT (GETDATE()),
        CONSTRAINT PK_SheetUserPrefs PRIMARY KEY (user_id, sheet_key)
    );
END
