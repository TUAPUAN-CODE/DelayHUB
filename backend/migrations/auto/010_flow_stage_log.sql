-- ประวัติการแก้เวลาของขั้นตอน Flow (Tuna scrap / CK bone) — ตารางใหม่ ไม่แก้ของเดิม
-- รันซ้ำได้ (มีตารางแล้ว = ข้าม) · backend/lib/flowDelay.js ก็สร้างให้เองตอนใช้ครั้งแรก
IF OBJECT_ID(N'dbo.FlowStageLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FlowStageLog (
        log_id     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowStageLog PRIMARY KEY,
        rmfp_id    INT           NOT NULL,
        stage      NVARCHAR(30)  NOT NULL,
        old_at     DATETIME      NULL,
        new_at     DATETIME      NULL,
        reason     NVARCHAR(300) NULL,
        username   NVARCHAR(100) NULL,
        created_at DATETIME      NOT NULL CONSTRAINT DF_FlowStageLog_created_at DEFAULT (GETDATE())
    );
    CREATE INDEX IX_FlowStageLog_rmfp ON dbo.FlowStageLog (rmfp_id, log_id DESC);
END
