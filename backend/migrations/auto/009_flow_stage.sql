-- ขั้นตอนของ flow Tuna scrap / CK bone (เข้า-ออกห้องเย็น petfood, Freeze ครั้งที่ 1-2, Grinding เสร็จ) บันทึกที่แถวแผนผลิต (RMForProd) — ตารางใหม่ ไม่แก้ของเดิม
-- รันซ้ำได้ (มีตารางแล้ว = ข้าม) · backend/lib/flowDelay.js ก็สร้างให้เองตอนใช้ครั้งแรก
IF OBJECT_ID(N'dbo.FlowStage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FlowStage (
        flow_stage_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowStage PRIMARY KEY,
        rmfp_id       INT           NOT NULL,
        stage         NVARCHAR(30)  NOT NULL,
        stamped_at    DATETIME      NOT NULL,
        created_by    NVARCHAR(100) NULL,
        created_at    DATETIME      NOT NULL CONSTRAINT DF_FlowStage_created_at DEFAULT (GETDATE())
    );
    CREATE UNIQUE INDEX UX_FlowStage_rmfp_stage ON dbo.FlowStage (rmfp_id, stage);
END
