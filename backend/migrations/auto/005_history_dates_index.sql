-- History: แถวล่าสุดของ mapping + วันที่ทุกรอบที่หน้า Sheet ใช้กรอง (รอบห้องเย็นที่ 2-3 ด้วย) — ดัชนีตอบเองได้โดยไม่อ่านแถวกว้างของ History
-- เพิ่มจาก 001 (ที่ครอบคลุมแค่ 5 วันที่) โดยไม่ลบดัชนีเดิม · รันซ้ำได้: สร้างเฉพาะเมื่อคอลัมน์มีครบและยังไม่มีดัชนีชื่อนี้ · ไม่แก้/ลบข้อมูล
-- {{INDEX_OPTIONS}} ตั้งให้โดย lib/dbTuning.js · รันเองใน SSMS: แทนด้วย ONLINE = OFF, SORT_IN_TEMPDB = ON
IF COL_LENGTH(N'dbo.History', N'mapping_id') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'hist_id') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'cooked_date') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'rmit_date') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date_two') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date_two') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'come_cold_date_three') IS NOT NULL AND COL_LENGTH(N'dbo.History', N'out_cold_date_three') IS NOT NULL
   AND COL_LENGTH(N'dbo.History', N'sc_pack_date') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.History') AND name = N'IX_History_mapping_id_dates_all')
    EXEC (N'CREATE NONCLUSTERED INDEX IX_History_mapping_id_dates_all ON dbo.History (mapping_id, hist_id DESC)
            INCLUDE (cooked_date, rmit_date, come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two,
                     come_cold_date_three, out_cold_date_three, sc_pack_date) WITH ({{INDEX_OPTIONS}})');
GO
