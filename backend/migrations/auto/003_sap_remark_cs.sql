-- Remark CS ของ HU (กรอกตอนจุดเตรียมรับเข้าวัตถุดิบจากห้องเย็นใหญ่ /prep/Sheet) แสดงในทุกสลีป — เพิ่มคอลัมน์อย่างเดียว ไม่แก้ / ลบของเดิม
-- รันซ้ำได้ (มีคอลัมน์แล้ว = ข้าม) · backend/lib/remarkCs.js ก็เพิ่มให้เองตอนใช้ครั้งแรก
IF OBJECT_ID(N'dbo.SAP_Receive', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SAP_Receive', N'remark_cs') IS NULL
    ALTER TABLE dbo.SAP_Receive ADD remark_cs NVARCHAR(500) NULL;
