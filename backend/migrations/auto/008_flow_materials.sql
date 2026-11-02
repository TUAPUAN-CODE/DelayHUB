-- วัตถุดิบ (RawMat) ของ flow Tuna scrap / CK bone + ประเภทใหม่ + ผูกวัตถุดิบกับกลุ่ม (RawMatCookedGroup) — เพิ่มอย่างเดียว ไม่แก้ / ลบแถวเดิม
-- รันซ้ำได้ (มีแล้ว = ข้าม) · ต้องรันหลัง 007_flow_groups.sql (ชื่อไฟล์เรียงลำดับ)
-- หมายเหตุ: ผู้ใช้เห็นวัตถุดิบตามประเภทที่ผูกกับ Workplace (WorkplaceUsers.rm_type_id) — ประเภทใหม่ต้องเพิ่มให้ผู้ใช้ที่ต้องเห็นในหน้า Master
DECLARE @tuna_type INT, @ck_type INT, @tuna_grp INT, @ck_grp INT;

IF NOT EXISTS (SELECT 1 FROM dbo.RawMatType WHERE rm_type_name = N'Tuna scrap') INSERT INTO dbo.RawMatType (rm_type_name) VALUES (N'Tuna scrap');
IF NOT EXISTS (SELECT 1 FROM dbo.RawMatType WHERE rm_type_name = N'CK bone') INSERT INTO dbo.RawMatType (rm_type_name) VALUES (N'CK bone');
SELECT @tuna_type = MIN(rm_type_id) FROM dbo.RawMatType WHERE rm_type_name = N'Tuna scrap';
SELECT @ck_type = MIN(rm_type_id) FROM dbo.RawMatType WHERE rm_type_name = N'CK bone';

-- กลุ่มที่ 007 สร้างไว้ใช้ประเภทชั่วคราว (7 / 2): ย้ายมาประเภทใหม่ เฉพาะที่ยังเป็นค่าเดิมนั้น (ถ้าผู้ใช้แก้ประเภทเองแล้ว = ไม่แตะ)
UPDATE dbo.RawMatGroup SET rm_type_id = @tuna_type WHERE rm_group_name = N'Tuna scrap' AND rm_type_id = 7 AND @tuna_type IS NOT NULL;
UPDATE dbo.RawMatGroup SET rm_type_id = @ck_type WHERE rm_group_name = N'CK bone' AND rm_type_id = 2 AND @ck_type IS NOT NULL;

SELECT @tuna_grp = MIN(rm_group_id) FROM dbo.RawMatGroup WHERE rm_group_name = N'Tuna scrap';
SELECT @ck_grp = MIN(rm_group_id) FROM dbo.RawMatGroup WHERE rm_group_name = N'CK bone';

DECLARE @m TABLE (mat VARCHAR(50), mat_name NVARCHAR(200), grp INT);
INSERT INTO @m (mat, mat_name, grp) VALUES
    ('2XA131TN0001', N'Tuna scrap (RM)', @tuna_grp),
    ('2XP10BTN0001', N'Tuna paste SC', @tuna_grp),
    ('2XP825CK0002', N'CK bone after cooked (กระดูกหลังสกัด)', @ck_grp),
    ('2XP825CK0006', N'Chicken paste CKB', @ck_grp);

INSERT INTO dbo.RawMat (mat, mat_name)
SELECT m.mat, m.mat_name FROM @m m WHERE NOT EXISTS (SELECT 1 FROM dbo.RawMat r WHERE r.mat = m.mat);

INSERT INTO dbo.RawMatCookedGroup (mat, rm_group_id, rm_type_id)
SELECT m.mat, m.grp, g.rm_type_id
FROM @m m JOIN dbo.RawMatGroup g ON g.rm_group_id = m.grp
WHERE m.grp IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.RawMatCookedGroup c WHERE c.mat = m.mat AND c.rm_group_id = m.grp);
