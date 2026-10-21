-- ดัชนีที่หน้า Sheet (กำลังดำเนินการ / ดำเนินการเสร็จสิ้น) ใช้ค้นหา — ให้ DBA รันบนฐานข้อมูลจริง (ตรวจ sys.indexes ก่อน: ถ้ามีดัชนีที่ขึ้นต้นด้วยคอลัมน์เดียวกันอยู่แล้ว ไม่ต้องสร้างซ้ำ)
-- หน้านี้อ่านอย่างเดียว ดัชนีไม่เปลี่ยนข้อมูล แต่เพิ่มงานตอน INSERT/UPDATE เล็กน้อย; ใช้ ONLINE = ON (Enterprise) หรือรันนอกเวลาผลิต

-- History: หาแถวล่าสุดของ mapping_id (OUTER APPLY ... ORDER BY hist_id DESC)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_mapping_id_hist_id' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_mapping_id_hist_id ON dbo.History (mapping_id, hist_id DESC);

-- Batch: รวม batch_after ต่อ mapping_id
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Batch_mapping_id' AND object_id = OBJECT_ID(N'dbo.Batch'))
    CREATE NONCLUSTERED INDEX IX_Batch_mapping_id ON dbo.Batch (mapping_id) INCLUDE (batch_after);

-- Slot: หาช่องของรถเข็น
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Slot_tro_id' AND object_id = OBJECT_ID(N'dbo.Slot'))
    CREATE NONCLUSTERED INDEX IX_Slot_tro_id ON dbo.Slot (tro_id) INCLUDE (cs_id, slot_id);

-- RM_EmuMixed: อิมัลชันของแผน (rmfp_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RM_EmuMixed_rmfp_id' AND object_id = OBJECT_ID(N'dbo.RM_EmuMixed'))
    CREATE NONCLUSTERED INDEX IX_RM_EmuMixed_rmfp_id ON dbo.RM_EmuMixed (rmfp_id) INCLUDE (rmfemu_id);

-- PackTrolley: สถานะของรถเข็น
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackTrolley_tro_id_status' AND object_id = OBJECT_ID(N'dbo.PackTrolley'))
    CREATE NONCLUSTERED INDEX IX_PackTrolley_tro_id_status ON dbo.PackTrolley (tro_id, pack_tro_status) INCLUDE (line_tro);

-- TrolleyRMMapping: สถานะ/ปลายทาง (ตารางดำเนินการเสร็จสิ้นกรองด้วย dest/rm_status) และ rmfp_id
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TrolleyRMMapping_rmfp_id' AND object_id = OBJECT_ID(N'dbo.TrolleyRMMapping'))
    CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_rmfp_id ON dbo.TrolleyRMMapping (rmfp_id);

-- History: วันที่ที่ตารางดำเนินการเสร็จสิ้นใช้กรองช่วงวัน (DONE_RANGE_SQL ใน routes/SheetRoutes.js) — ทำให้ค้นด้วยช่วงวันที่แบบ seek ได้ แทนการไล่ทั้งตาราง
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_sc_pack_date' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_sc_pack_date ON dbo.History (sc_pack_date) INCLUDE (mapping_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_out_cold_date' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_out_cold_date ON dbo.History (out_cold_date) INCLUDE (mapping_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_come_cold_date' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_come_cold_date ON dbo.History (come_cold_date) INCLUDE (mapping_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_rmit_date' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_rmit_date ON dbo.History (rmit_date) INCLUDE (mapping_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_History_cooked_date' AND object_id = OBJECT_ID(N'dbo.History'))
    CREATE NONCLUSTERED INDEX IX_History_cooked_date ON dbo.History (cooked_date) INCLUDE (mapping_id);
