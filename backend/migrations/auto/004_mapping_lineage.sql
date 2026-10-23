-- หน้า "ค้นหา mapping_id": รายการนี้ถูกนำไปเป็น mapping_id ใหม่อะไรบ้าง (lib/mappingLineage.js) — รันซ้ำได้ (มีแล้ว = ข้าม)
-- 1) ตาราง MappingLineage: เก็บ "รายการเดิม -> รายการใหม่" ของงานที่ไม่มีที่เก็บเอง (กลับมาเตรียม ลบรายการเดิมทิ้ง, ย้ายวัตถุดิบไปรถเข็นอื่นในห้องเย็น)
--    backend สร้างเองตอนบันทึกครั้งแรกด้วย (คำสั่งเดียวกัน) ไฟล์นี้แค่ทำให้มีตั้งแต่ backend เปิด
IF OBJECT_ID(N'dbo.MappingLineage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MappingLineage (
        lineage_id      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MappingLineage PRIMARY KEY,
        from_mapping_id INT           NOT NULL,
        to_mapping_id   INT           NOT NULL,
        kind            NVARCHAR(20)  NOT NULL,
        created_by      NVARCHAR(100) NULL,
        created_at      DATETIME      NOT NULL CONSTRAINT DF_MappingLineage_created_at DEFAULT (GETDATE())
    );
    CREATE NONCLUSTERED INDEX IX_MappingLineage_from ON dbo.MappingLineage (from_mapping_id);
    CREATE NONCLUSTERED INDEX IX_MappingLineage_to ON dbo.MappingLineage (to_mapping_id);
END
GO
-- 2) TrolleyRMMapping.from_mapping_id: หา "รายการที่สร้างต่อจากรายการนี้" ด้วยดัชนีแคบ แทนการอ่านทั้งตาราง · {{INDEX_OPTIONS}} ตั้งโดย lib/dbTuning.js
IF COL_LENGTH(N'dbo.TrolleyRMMapping', N'from_mapping_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.TrolleyRMMapping') AND ic.key_ordinal = 1 AND c.name = N'from_mapping_id')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_TrolleyRMMapping_from_mapping_id ON dbo.TrolleyRMMapping (from_mapping_id) WITH ({{INDEX_OPTIONS}})');
GO
