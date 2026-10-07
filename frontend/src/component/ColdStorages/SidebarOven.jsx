import { Snowflake, Warehouse, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  { items: [{ name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/ColdStorages/Sheet" }] },
  {
    title: "RM ไม่แปรรูป",
    items: [{ name: "Time Stamp วัตถุดิบ", icon: Snowflake, href: "/ColdStorages/SapSheet" }],
  },
  {
    title: "RM แปรรูป",
    items: [{ name: "ห้องเย็นใหญ่", icon: Warehouse, href: "/ColdStorages/LargeRooms" }],
  },
  { items: [{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }] },
];

const SidebarOven = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น v2" sections={SECTIONS} />;

export default SidebarOven;
