-- ข้อมูลเสริมของส่วนผสม (Ingredient) ที่หัวหน้า (Supervisor / Master) บันทึกเองในหน้า /sup/Ingredient: ชื่อเรียก + หมายเหตุ
-- คีย์คือ IngdntCode ของฐาน WC (IV.TUNA) — ไม่เขียนอะไรลงฐาน WC เลย ตารางนี้อยู่ใน PFCMv2 เท่านั้น
-- ให้ DBA รันครั้งเดียวก่อนใช้งานการบันทึก (ยังไม่ได้รัน = หน้าเมนูยังเปิดดูข้อมูลได้ แต่ปุ่มบันทึกจะแจ้งว่ายังไม่มีตาราง ไม่พัง)
-- ไม่อยู่ใน migrations/auto เพราะเป็นการเพิ่มตาราง ต้องให้ DBA รันเองนอกกะผลิต
-- Rollback:  DROP TABLE dbo.IngredientNote;   (ไม่มี FK เข้าตารางอื่น ลบได้โดยไม่กระทบข้อมูลการผลิต)
IF OBJECT_ID(N'dbo.IngredientNote', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IngredientNote (
        ingdnt_code  NVARCHAR(50)   NOT NULL,
        alias_name   NVARCHAR(200)  NULL,
        remark       NVARCHAR(1000) NULL,
        updated_by   NVARCHAR(100)  NULL,
        updated_at   DATETIME       NOT NULL CONSTRAINT DF_IngredientNote_updated DEFAULT (GETDATE()),
        CONSTRAINT PK_IngredientNote PRIMARY KEY (ingdnt_code)
    );
END
