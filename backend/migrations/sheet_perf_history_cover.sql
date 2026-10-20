-- ทำให้ดัชนี History ตอบ "วันที่ของแถวล่าสุด" ได้เองโดยไม่ต้องอ่านแถวกว้างของ History (หน้า Sheet ตรวจวันที่ของ mapping ที่ค้างหลักแสนแถวทุกครั้งที่โหลด)
-- รันใน database PFCMv2 นอกเวลาผลิต (สร้างดัชนีใหม่บน History ~7.6 แสนแถว) — คีย์เหมือนเดิมทุกอย่าง แค่เพิ่มคอลัมน์ INCLUDE ถ้าไม่มีดัชนีเดิมจะสร้างใหม่
CREATE NONCLUSTERED INDEX IX_History_mapping_id_hist_id
    ON dbo.History (mapping_id, hist_id DESC)
    INCLUDE (cooked_date, rmit_date, come_cold_date, out_cold_date, sc_pack_date)
    WITH (DROP_EXISTING = ON);
