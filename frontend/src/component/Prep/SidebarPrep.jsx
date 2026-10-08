import { useMemo } from "react";
import { Clock, Soup, ScanLine, ListChecks, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const readRmTypeIds = () => {
  try { return JSON.parse(localStorage.getItem("rm_type_id") || "[]") || []; } catch { return []; }
};

const SidebarPrep = () => {
  // "Scan SAP" is hidden for the rm types that do not use it (998, 999)
  const showScanSAP = !readRmTypeIds().some((id) => Number(id) === 998 || Number(id) === 999);

  const sections = useMemo(() => [
    {
      title: "Time Stamp",
      items: [
        // รอแก้ไข · กลับมาเตรียม · ผสมวัตถุดิบ / Batch / ผสมเตรียม / loaf สุก อยู่เป็น tool ในตารางนี้
        { name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/prep/Sheet" },
        { name: "Time Stamp วัตถุดิบ", icon: Clock, href: "/prep", exact: true },
        { name: "Time Stamp น้ำต้มไก่", icon: Soup, href: "/prep/timestamp" },
        ...(showScanSAP ? [{ name: "Scan SAP", icon: ScanLine, href: "/prep/ScanSAP/ScanSAPPage" }] : []),
      ],
    },
    {
      title: "ผสมวัตถุดิบ",
      items: [
        { name: "รายการผสมวัตถุดิบ", icon: ListChecks, href: "/prep/RM_EMU" },
      ],
    },
    { items: [{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }] },
  ], [showScanSAP]);

  return <AppSidebar title="DelayHUB" subtitle="จุดเตรียมวัตถุดิบ" sections={sections} />;
};

export default SidebarPrep;
