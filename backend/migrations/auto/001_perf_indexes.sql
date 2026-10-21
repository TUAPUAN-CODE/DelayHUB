-- ดัชนีที่ query ของหลายหน้าใช้ร่วมกัน (Sheet, Pack, Cold storage, QC, Prep) — รันอัตโนมัติทุกครั้งที่ backend เปิด (lib/dbTuning.js)
-- ทุกคำสั่งรันซ้ำได้: สร้างเฉพาะเมื่อตาราง/คอลัมน์มีจริง และยังไม่มีดัชนีที่ขึ้นต้นด้วยคอลัมน์เดียวกัน (มีแล้ว = ข้าม ไม่สร้างซ้ำ)
-- ไม่แก้/ลบข้อมูล ไม่ลบดัชนีเดิม · {{INDEX_OPTIONS}} = ONLINE = ON (Enterprise) หรือ OFF + SORT_IN_TEMPDB + MAXDOP 2 (ตั้งให้โดย lib/dbTuning.js)
-- แต่ละช่วงคั่นด้วย GO = 1 คำสั่ง (ล้มเหลวช่วงไหนข้ามไปช่วงถัดไป) · รันเองใน SSMS: แทน {{INDEX_OPTIONS}} ด้วย ONLINE = OFF, SORT_IN_TEMPDB = ON

-- History: แถวล่าสุดของ mapping (OUTER APPLY ... ORDER BY hist_id DESC) + 5 วันที่ที่หน้า Sheet ใช้กรอง — ดัชนีตอบเองได้โดยไม่อ่านแถวกว้างของ History
IF COL_LENGTH(N'dbo.History', N'mapping_id') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'hist_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'cooked_date') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'rmit_date') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'sc_pack_date') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.History') AND ic.key_ordinal = 1 AND c.name = N'mapping_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_History_mapping_id_hist_id ON dbo.History (mapping_id, hist_id DESC)
            INCLUDE (cooked_date, rmit_date, come_cold_date, out_cold_date, sc_pack_date) WITH ({{INDEX_OPTIONS}})');
GO

-- Batch: batch_after ของ mapping (STRING_AGG ต่อ mapping_id)
IF COL_LENGTH(N'dbo.Batch', N'mapping_id') IS NOT NULL AND COL_LENGTH(N'dbo.Batch', N'batch_after') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.Batch') AND ic.key_ordinal = 1 AND c.name = N'mapping_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_Batch_mapping_id ON dbo.Batch (mapping_id) INCLUDE (batch_after) WITH ({{INDEX_OPTIONS}})');
GO

-- Slot: ช่องของรถเข็น (ห้องเย็นทุกหน้า + Sheet)
IF COL_LENGTH(N'dbo.Slot', N'tro_id') IS NOT NULL AND COL_LENGTH(N'dbo.Slot', N'cs_id') IS NOT NULL AND COL_LENGTH(N'dbo.Slot', N'slot_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.Slot') AND ic.key_ordinal = 1 AND c.name = N'tro_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_Slot_tro_id ON dbo.Slot (tro_id) INCLUDE (cs_id, slot_id) WITH ({{INDEX_OPTIONS}})');
GO

-- RM_EmuMixed: อิมัลชันของแผน (rmfp_id)
IF COL_LENGTH(N'dbo.RM_EmuMixed', N'rmfp_id') IS NOT NULL AND COL_LENGTH(N'dbo.RM_EmuMixed', N'rmfemu_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.RM_EmuMixed') AND ic.key_ordinal = 1 AND c.name = N'rmfp_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_RM_EmuMixed_rmfp_id ON dbo.RM_EmuMixed (rmfp_id) INCLUDE (rmfemu_id) WITH ({{INDEX_OPTIONS}})');
GO

-- PackTrolley: สถานะ/ไลน์ของรถเข็นที่บรรจุ
IF COL_LENGTH(N'dbo.PackTrolley', N'tro_id') IS NOT NULL AND COL_LENGTH(N'dbo.PackTrolley', N'pack_tro_status') IS NOT NULL
   AND COL_LENGTH(N'dbo.PackTrolley', N'line_tro') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.PackTrolley') AND ic.key_ordinal = 1 AND c.name = N'tro_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_PackTrolley_tro_id_status ON dbo.PackTrolley (tro_id, pack_tro_status) INCLUDE (line_tro) WITH ({{INDEX_OPTIONS}})');
GO

-- TrolleyRMMapping: mapping ของแผน (rmfp_id) — ใช้มากกว่า 100 จุดใน routes
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'rmfp_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.TrolleyRMMapping') AND ic.key_ordinal = 1 AND c.name = N'rmfp_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_rmfp_id ON dbo.TrolleyRMMapping (rmfp_id) WITH ({{INDEX_OPTIONS}})');
GO

-- TrolleyRMMapping: ของบนรถเข็น (tro_id = @...) — ใช้มากกว่า 250 จุด (ห้องเย็น, Pack, QC, Prep)
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'tro_id') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rmfp_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'dest') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rm_status') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'stay_place') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.TrolleyRMMapping') AND ic.key_ordinal = 1 AND c.name = N'tro_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_tro_id ON dbo.TrolleyRMMapping (tro_id)
            INCLUDE (rmfp_id, dest, rm_status, stay_place) WITH ({{INDEX_OPTIONS}})');
GO

-- TrolleyRMMapping: กรองตามปลายทาง + สถานะ (rmm.dest = ... AND rmm.rm_status = ...) — ใช้มากกว่า 150 จุด ทุกหน้ารายการ
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'dest') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rm_status') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'stay_place') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'tro_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rmfp_id') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rmm_line_name') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'weight_RM') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.TrolleyRMMapping') AND ic.key_ordinal = 1 AND c.name = N'dest')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_dest_status ON dbo.TrolleyRMMapping (dest, rm_status)
            INCLUDE (stay_place, tro_id, rmfp_id, rmm_line_name, weight_RM) WITH ({{INDEX_OPTIONS}})');
GO

-- TrolleyRMMapping: ขั้นกรองของหน้า Sheet อ่านดัชนีแคบแทนแถวกว้างทั้งตาราง (คีย์ mapping_id มี clustered อยู่แล้ว จึงตรวจด้วยชื่อ)
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'mapping_id') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rmfp_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'dest') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'stay_place') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'rm_status') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'weight_RM') IS NOT NULL
   AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'tro_id') IS NOT NULL AND COL_LENGTH(N'dbo.TrolleyRMMapping', N'created_at') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TrolleyRMMapping') AND name = N'IX_TrolleyRMMapping_sheet_filter')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_sheet_filter ON dbo.TrolleyRMMapping (mapping_id DESC)
            INCLUDE (rmfp_id, dest, stay_place, rm_status, weight_RM, tro_id, created_at) WITH ({{INDEX_OPTIONS}})');
GO

-- DatatoPDF: รายการของเอกสาร (หน้าประวัติ PDF ของ Pack: d.paper_id IN (...))
IF COL_LENGTH(N'dbo.DatatoPDF', N'paper_id') IS NOT NULL AND COL_LENGTH(N'dbo.DatatoPDF', N'mapping_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.DatatoPDF', N'dtp_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.DatatoPDF') AND ic.key_ordinal = 1 AND c.name = N'paper_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_DatatoPDF_paper_id ON dbo.DatatoPDF (paper_id) INCLUDE (mapping_id, dtp_id) WITH ({{INDEX_OPTIONS}})');
GO

-- DatatoPDF: เอกสารของ mapping (d.mapping_id = ...)
IF COL_LENGTH(N'dbo.DatatoPDF', N'mapping_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.DatatoPDF') AND ic.key_ordinal = 1 AND c.name = N'mapping_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_DatatoPDF_mapping_id ON dbo.DatatoPDF (mapping_id) WITH ({{INDEX_OPTIONS}})');
GO

-- RMForProd: แผนที่รอใส่รถเข็น (stay_place IN (...)) — หน้า Sheet (plans) + หน้าเตรียม
IF COL_LENGTH(N'dbo.RMForProd', N'stay_place') IS NOT NULL AND COL_LENGTH(N'dbo.RMForProd', N'dest') IS NOT NULL
   AND COL_LENGTH(N'dbo.RMForProd', N'hist_id_rmfp') IS NOT NULL AND COL_LENGTH(N'dbo.RMForProd', N'prod_rm_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.RMForProd', N'rm_group_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.RMForProd') AND ic.key_ordinal = 1 AND c.name = N'stay_place')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_RMForProd_stay_place ON dbo.RMForProd (stay_place)
            INCLUDE (dest, hist_id_rmfp, prod_rm_id, rm_group_id) WITH ({{INDEX_OPTIONS}})');
GO
