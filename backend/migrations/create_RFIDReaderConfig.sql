-- ============================================
-- สร้างตาราง RFIDReaderConfig
-- สำหรับเก็บค่าตั้งค่าเครื่องอ่าน RFID แต่ละจุด
-- ============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RFIDReaderConfig' AND xtype='U')
BEGIN
    CREATE TABLE RFIDReaderConfig (
        id INT IDENTITY(1,1) PRIMARY KEY,
        reader_no INT NOT NULL,
        name NVARCHAR(255) NOT NULL,
        ip NVARCHAR(50) NOT NULL,
        port INT NOT NULL DEFAULT 49152,
        location_name NVARCHAR(255) NOT NULL,
        printer_agent_url NVARCHAR(500) NOT NULL DEFAULT 'http://localhost:9100',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );

    -- ใส่ข้อมูลเริ่มต้น 3 จุด
    INSERT INTO RFIDReaderConfig (reader_no, name, ip, port, location_name, printer_agent_url, is_active)
    VALUES
        (1, N'เครื่องอ่าน RFID จุด A', '192.168.1.100', 49152, N'จุด A', 'http://localhost:9100', 1),
        (2, N'เครื่องอ่าน RFID จุด B', '192.168.1.101', 49152, N'จุด B', 'http://localhost:9100', 0),
        (3, N'เครื่องอ่าน RFID จุด C', '192.168.1.102', 49152, N'จุด C', 'http://localhost:9100', 0);

    PRINT 'ตาราง RFIDReaderConfig สร้างสำเร็จ';
END
ELSE
BEGIN
    PRINT 'ตาราง RFIDReaderConfig มีอยู่แล้ว';
END
GO
