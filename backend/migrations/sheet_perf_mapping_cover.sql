-- ทำให้ขั้นกรองของ query mappings (หน้า Sheet) อ่านดัชนีแคบๆ แทนการสแกนแถวกว้างของ TrolleyRMMapping (~5 แสนแถว) ทุกครั้งที่โหลด
-- รันใน database PFCMv2 นอกเวลาผลิต (สร้างดัชนีใหม่ ไม่แก้/ลบข้อมูลเดิม) ถ้ามีอยู่แล้วจะข้าม
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TrolleyRMMapping_sheet_filter' AND object_id = OBJECT_ID(N'dbo.TrolleyRMMapping'))
    CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_sheet_filter
        ON dbo.TrolleyRMMapping (mapping_id DESC)
        INCLUDE (rmfp_id, dest, stay_place, rm_status, weight_RM, tro_id, created_at);
