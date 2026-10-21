-- หน้า "ประวัติ" ของห้องเย็น (GET /api/coldstorage/history): เลือกแถวของหน้าด้วยเวลาเข้า/ออกห้องเย็นล่าสุด (6 คอลัมน์ของ History)
-- ดัชนีแคบนี้ให้ขั้นเลือกแถวไม่ต้องอ่านแถวกว้างของ History ทั้งตาราง — รันซ้ำได้ (มีชื่อนี้แล้ว = ข้าม) · {{INDEX_OPTIONS}} ตั้งโดย lib/dbTuning.js
IF COL_LENGTH(N'dbo.History', N'mapping_id') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'hist_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'come_cold_date_two') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date_three') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'out_cold_date_two') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date_three') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.History') AND name = N'IX_History_cold_dates')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_History_cold_dates ON dbo.History (mapping_id, hist_id)
            INCLUDE (come_cold_date, come_cold_date_two, come_cold_date_three, out_cold_date, out_cold_date_two, out_cold_date_three)
            WITH ({{INDEX_OPTIONS}})');
GO
