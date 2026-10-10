import { useMemo } from "react";
import { Soup, ListChecks, LogOut, Table2, CheckCircle2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarPrep = () => {
  const sections = useMemo(() => [
    {
      title: "Time Stamp",
      items: [
        // รอแก้ไข · กลับมาเตรียม · ผสมวัตถุดิบ / Batch / ผสมเตรียม / loaf สุก อยู่เป็น tool ในตารางนี้
        { name: "กำลังดำเนินการ", icon: Table2, href: "/prep/Sheet" },
      { name: "ดำเนินการเสร็จสิ้น", icon: CheckCircle2, href: "/prep/Sheet?view=done" },
        { name: "Time Stamp น้ำต้มไก่", icon: Soup, href: "/prep/timestamp" },
      ],
    },
    {
      title: "ผสมวัตถุดิบ",
      items: [
        { name: "รายการผสมวัตถุดิบ", icon: ListChecks, href: "/prep/RM_EMU" },
      ],
    },
    { items: [{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }] },
  ], []);

  return <AppSidebar title="DelayHUB" subtitle="จุดเตรียมวัตถุดิบ" sections={sections} />;
};

export default SidebarPrep;
