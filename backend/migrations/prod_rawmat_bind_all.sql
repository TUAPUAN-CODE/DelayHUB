-- ผูก Mat ทุกตัว (RawMat) กับ Code / แผนการผลิตทุกตัว (Production) ใน ProdRawMat — รันครั้งเดียวบนฐานข้อมูลจริง (ให้ DBA หรือผู้ดูแลรัน)
-- หลังจากนี้ระบบผูกให้เองอัตโนมัติ: เพิ่ม Mat ใหม่ (หน้า /sup/Rawmat) = ผูกกับทุก Code, เพิ่ม Code ใหม่ (หน้า /sup/Production) = ผูกกับทุก Mat
--
-- * เพิ่มอย่างเดียว (INSERT) — ไม่ลบ ไม่แก้แถวเดิม; คู่ (mat, prod_id) ที่มีอยู่แล้วจะไม่ถูกเพิ่มซ้ำ (prod_rm_id เดิมที่ RMForProd ใช้อยู่ไม่เปลี่ยน)
-- * รันซ้ำได้ ไม่เกิดแถวซ้ำ
-- * จำนวนแถวที่เพิ่ม = (จำนวน Mat x จำนวน Code) - คู่ที่มีอยู่แล้ว — ดูตัวเลขจากขั้นที่ 1 ก่อน ถ้าเยอะมากให้รันนอกเวลาผลิต
-- * ควร backup ก่อนรัน

USE [PFCMv2];
GO

-- ── 1) ดูก่อนว่าจะเพิ่มกี่แถว (อ่านอย่างเดียว) ─────────────────────────────
SELECT
    (SELECT COUNT(*) FROM dbo.RawMat)      AS mat_count,
    (SELECT COUNT(*) FROM dbo.Production)  AS prod_count,
    (SELECT COUNT(*) FROM dbo.ProdRawMat)  AS prodrawmat_now,
    (SELECT COUNT(*)
       FROM dbo.RawMat rm
       CROSS JOIN dbo.Production p
      WHERE NOT EXISTS (SELECT 1 FROM dbo.ProdRawMat pr WHERE pr.mat = rm.mat AND pr.prod_id = p.prod_id)
    ) AS rows_to_add;
GO

-- ── 2) ดัชนีให้การเช็กคู่ซ้ำเร็ว (ถ้ายังไม่มีดัชนีที่ขึ้นต้นด้วย mat, prod_id) ───────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProdRawMat_mat_prod_id' AND object_id = OBJECT_ID(N'dbo.ProdRawMat'))
    CREATE NONCLUSTERED INDEX IX_ProdRawMat_mat_prod_id ON dbo.ProdRawMat (mat, prod_id);
GO

-- ── 3) เพิ่มทีละ Code (แต่ละรอบเป็น transaction เล็ก ๆ ไม่ล็อกตารางนาน) ──────────
SET NOCOUNT ON;
DECLARE @prod_id INT, @added INT = 0, @n INT;

DECLARE prod_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT p.prod_id FROM dbo.Production p ORDER BY p.prod_id;
OPEN prod_cur;
FETCH NEXT FROM prod_cur INTO @prod_id;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRANSACTION;
        INSERT INTO dbo.ProdRawMat (mat, prod_id)
        SELECT rm.mat, @prod_id
        FROM dbo.RawMat rm
        WHERE NOT EXISTS (SELECT 1 FROM dbo.ProdRawMat pr WHERE pr.mat = rm.mat AND pr.prod_id = @prod_id);
        SET @n = @@ROWCOUNT;
    COMMIT TRANSACTION;
    SET @added += @n;
    FETCH NEXT FROM prod_cur INTO @prod_id;
END
CLOSE prod_cur;
DEALLOCATE prod_cur;

PRINT CONCAT(N'เพิ่ม ProdRawMat แล้ว ', @added, N' แถว');
GO

-- ── 4) ตรวจผล: ทุกคู่ต้องมีครบ (rows_missing = 0) ──────────────────────────────
SELECT COUNT(*) AS rows_missing
FROM dbo.RawMat rm
CROSS JOIN dbo.Production p
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProdRawMat pr WHERE pr.mat = rm.mat AND pr.prod_id = p.prod_id);
GO
