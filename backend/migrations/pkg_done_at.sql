-- UsePKG: เก็บเวลาที่เอกสารถูกปิด (กด Done เอง หรือ pkgAutoDoneWorker ตัดอัตโนมัติ)
-- รันก่อน deploy ได้เลย (โค้ดเช็คเองว่ามีคอลัมน์หรือยัง)
USE PFCMv2;
IF COL_LENGTH('dbo.PackagingUsageReport', 'done_at') IS NULL
  ALTER TABLE dbo.PackagingUsageReport ADD done_at DATETIME NULL;
