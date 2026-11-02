-- Delay ของ flow หลายช่วง (Tuna scrap, CK bone): เกณฑ์เพิ่มของกลุ่มวัตถุดิบ + เวลาจบ Cooking — เพิ่มคอลัมน์อย่างเดียว ไม่แก้ / ลบของเดิม
-- รันซ้ำได้ (มีคอลัมน์แล้ว = ข้าม) · backend/lib/flowDelay.js ก็เพิ่มให้เองตอนใช้ครั้งแรก
IF COL_LENGTH(N'dbo.RawMatGroup', N'cs_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cs_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'cook_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cook_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'freeze_to_prep') IS NULL ALTER TABLE dbo.RawMatGroup ADD freeze_to_prep DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.History', N'cook_end_date') IS NULL ALTER TABLE dbo.History ADD cook_end_date DATETIME NULL;
