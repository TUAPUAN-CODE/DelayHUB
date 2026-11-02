-- กลุ่มวัตถุดิบของ flow หลายช่วง: Tuna scrap และ CK bone — เพิ่มแถวใหม่อย่างเดียว ไม่แก้ / ลบแถวเดิม
-- รันซ้ำได้ (มีชื่อกลุ่มนี้แล้ว = ข้าม, ไม่เขียนทับค่าที่แก้ในหน้ากลุ่มวัตถุดิบ) · ต้องมีคอลัมน์จาก 006_flow_delay.sql ก่อน
-- เกณฑ์ (ชม.): prep_to_cold = DBS1 (Tuna: อบเสร็จ→เข้าห้องเย็น 4 · CK bone: ขั้น 1→Slow freeze 1) · cold_to_pack = DBS3 (เตรียม→บรรจุ 4)
--   cs_to_freeze ออกห้องเย็น→Slow freeze (Tuna 1) · cook_to_freeze จบ Cooking→Slow freeze 1 · freeze_to_prep ออก Slow freeze→เตรียม 1
-- ประเภท rm_type_id: Tuna scrap = 7 (ประเภทเดียวกับ "เลือดทูน่า/เศษทูน่า"), CK bone = 2 (ประเภทเดียวกับเนื้อไก่) — ไม่มีประเภทนั้น = ข้าม
-- ค่าที่ผู้ใช้ไม่ได้กำหนด (cold = เวลาอยู่ห้องเย็น, rework) ใส่ค่าเริ่มต้น แก้ได้ที่หน้ากลุ่มวัตถุดิบ
IF COL_LENGTH(N'dbo.RawMatGroup', N'cook_to_freeze') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.RawMatGroup WHERE rm_group_name = N'Tuna scrap')
       AND EXISTS (SELECT 1 FROM dbo.RawMatType WHERE rm_type_id = 7)
        EXEC (N'INSERT INTO dbo.RawMatGroup (rm_group_name, rm_type_id, prep_to_cold, prep_to_pack, cold, cold_to_pack, rework, cs_to_freeze, cook_to_freeze, freeze_to_prep)
                VALUES (N''Tuna scrap'', 7, 4.00, 8.00, 24.00, 4.00, 2.00, 1.00, 1.00, 1.00)');

    IF NOT EXISTS (SELECT 1 FROM dbo.RawMatGroup WHERE rm_group_name = N'CK bone')
       AND EXISTS (SELECT 1 FROM dbo.RawMatType WHERE rm_type_id = 2)
        EXEC (N'INSERT INTO dbo.RawMatGroup (rm_group_name, rm_type_id, prep_to_cold, prep_to_pack, cold, cold_to_pack, rework, cs_to_freeze, cook_to_freeze, freeze_to_prep)
                VALUES (N''CK bone'', 2, 1.00, 5.00, 24.00, 4.00, 2.00, NULL, 1.00, 1.00)');
END
