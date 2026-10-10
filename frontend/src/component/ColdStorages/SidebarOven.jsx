import { Warehouse, LogOut, Table2, CheckCircle2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  { items: [{ name: "กำลังดำเนินการ", icon: Table2, href: "/ColdStorages/Sheet" },
      { name: "ดำเนินการเสร็จสิ้น", icon: CheckCircle2, href: "/ColdStorages/Sheet?view=done" }] },
  {
    title: "RM แปรรูป",
    items: [{ name: "ห้องเย็นใหญ่", icon: Warehouse, href: "/ColdStorages/LargeRooms" }],
  },
  { items: [{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }] },
];

const SidebarOven = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น v2" sections={SECTIONS} />;

export default SidebarOven;
