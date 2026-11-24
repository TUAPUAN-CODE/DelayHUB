BEGIN TRANSACTION;

DECLARE @ids TABLE (tro_id VARCHAR(50) PRIMARY KEY);

INSERT INTO @ids (tro_id) VALUES
('0224'),
('1158'),
('1198'),
('0228'),
('0033'),
('0974'),
('0010'),
('1116'),
('1081'),
('0984'),
('1102'),
('1103'),
('1114'),
('1163'),
('1165'),
('1122'),
('1115'),
('1110'),
('0763'),
('0898'),
('9083'),
('1152'),
('1143'),
('1125'),
('1076'),
('0107'),
('0993'),
('0907'),
('1099'),
('1022'),
('0757'),
('0909'),
('0867'),
('0754'),
('0674'),
('0881'),
('0987'),
('0817'),
('0791'),
('0918'),
('0495'),
('0997'),
('1096'),
('0779'),
('0009'),
('0910'),
('0952'),
('0777'),
('0843'),
('1052'),
('0902'),
('0934'),
('0903'),
('0792'),
('0828'),
('0675'),
('0758'),
('0714'),
('0689'),
('0633');

-- ตรวจสอบก่อน: จำนวน ID ทั้งหมด และ ID ที่ไม่พบใน Trolley
SELECT COUNT(*) AS total_ids FROM @ids;

SELECT i.tro_id AS not_found_in_trolley
FROM @ids i
LEFT JOIN Trolley t ON t.tro_id = i.tro_id
WHERE t.tro_id IS NULL;

-- 1. TrolleyRMMapping
UPDATE m
SET tro_id = NULL,
    stay_place = N'ลบจากQC',
    dest = N'ลบจากQC',
    updated_at = GETDATE()
FROM TrolleyRMMapping m
JOIN @ids i ON i.tro_id = m.tro_id;

PRINT 'TrolleyRMMapping rows: ' + CAST(@@ROWCOUNT AS VARCHAR);

-- 2. Trolley
UPDATE t
SET tro_status = 1,
    rsrv_timestamp = NULL
FROM Trolley t
JOIN @ids i ON i.tro_id = t.tro_id;

PRINT 'Trolley rows: ' + CAST(@@ROWCOUNT AS VARCHAR);

-- 3. Slot
UPDATE s
SET tro_id = NULL,
    status = 'sql'
FROM Slot s
JOIN @ids i ON i.tro_id = s.tro_id;

PRINT 'Slot rows: ' + CAST(@@ROWCOUNT AS VARCHAR);

-- 4. PackTrolley
DELETE p
FROM PackTrolley p
JOIN @ids i ON i.tro_id = p.tro_id;

PRINT 'PackTrolley rows: ' + CAST(@@ROWCOUNT AS VARCHAR);

 COMMIT TRANSACTION;
-- ROLLBACK TRANSACTION;