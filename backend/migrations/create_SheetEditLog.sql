-- ประวัติการแก้ไขข้อมูลในตาราง Sheet โดย Supervisor (backend สร้างให้เองถ้ามีสิทธิ์; ไฟล์นี้สำหรับ DBA)
IF OBJECT_ID(N'dbo.SheetEditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SheetEditLog (
        edit_id      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SheetEditLog PRIMARY KEY,
        mapping_id   INT           NOT NULL,
        hist_id      INT           NULL,
        table_name   NVARCHAR(40)  NOT NULL,
        column_name  NVARCHAR(60)  NOT NULL,
        old_value    NVARCHAR(600) NULL,
        new_value    NVARCHAR(600) NULL,
        reason       NVARCHAR(300) NULL,
        user_id      INT           NULL,
        username     NVARCHAR(100) NULL,
        edited_at    DATETIME      NOT NULL CONSTRAINT DF_SheetEditLog_at DEFAULT (GETDATE())
    );
    CREATE INDEX IX_SheetEditLog_mapping ON dbo.SheetEditLog (mapping_id, edit_id DESC);
END
