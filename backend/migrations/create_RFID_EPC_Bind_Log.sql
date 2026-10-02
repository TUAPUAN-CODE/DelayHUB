-- ============================================================
-- ตาราง audit log การผูก/แก้ไข/ยกเลิกการผูก EPC กับ tro_id (RFID_to_Trolley)
-- ให้ DBA รันก่อน deploy — endpoint bind/rebind/delete ของ EPC จะเขียน log ในธุรกรรมเดียวกับการแก้ข้อมูล
-- ============================================================
IF OBJECT_ID(N'dbo.RFID_EPC_Bind_Log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RFID_EPC_Bind_Log (
        log_id      INT IDENTITY(1,1) PRIMARY KEY,
        epc         VARCHAR(50)  NOT NULL,
        action      VARCHAR(10)  NOT NULL,   -- BIND / REBIND / UNBIND
        old_tro_id  VARCHAR(10)  NULL,
        new_tro_id  VARCHAR(10)  NULL,
        user_id     VARCHAR(50)  NOT NULL,
        client_ip   VARCHAR(64)  NULL,
        created_at  DATETIME     NOT NULL DEFAULT GETDATE()
    );
END
GO
