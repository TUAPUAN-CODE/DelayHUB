import { Table2, Snowflake, Radio, History, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "ตารางวัตถุดิบ", icon: Table2, href: "/coldStorage/RoomTable/RoomTableCSSupOnly" },
      { name: "ห้องเย็น", icon: Snowflake, href: "/coldStorage/Room" },
      { name: "ส่งออกอัตโนมัติ (RFID)", icon: Radio, href: "/coldStorage/EmptyTrolley/RFIDCSCheckOutPage" },
      { name: "ประวัติ", icon: History, href: "/coldStorage/HisInput/HisInputPage" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarCS = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น" sections={SECTIONS} />;

export default SidebarCS;
