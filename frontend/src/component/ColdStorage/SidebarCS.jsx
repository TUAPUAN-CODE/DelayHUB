import { Truck, ArrowDownToLine, ArrowUpFromLine, Radio, Snowflake, Table2, MoveHorizontal, History, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "ติดตามรถเข็น", icon: Truck, href: "/coldStorage" },
      {
        name: "รับเข้า",
        icon: ArrowDownToLine,
        submenu: [
          { name: "CSR 3", href: "/coldStorage/CheckIn/CSR3/CSR3Page" },
          { name: "Chill 2", href: "/coldStorage/CheckIn/Chill2/Chill2Page" },
          { name: "Chill 4", href: "/coldStorage/CheckIn/Chill4/Chill4Page" },
          { name: "Chill 5", href: "/coldStorage/CheckIn/Chill5/Chill5Page" },
          { name: "Chill 6", href: "/coldStorage/CheckIn/Chill6/Chill6Page" },
          { name: "4C", href: "/coldStorage/CheckIn/4C/4CPage" },
          { name: "Ante", href: "/coldStorage/CheckIn/AntePage/AntePage" },
          { name: "LargeRoom", href: "/coldStorage/CheckIn/Large/LargePage" }
        ],
      },
      { name: "ส่งออก", icon: ArrowUpFromLine, href: "/coldStorage/CheckOut/CheckOutPage" },
      { name: "ส่งออกอัตโนมัติ (RFID)", icon: Radio, href: "/coldStorage/EmptyTrolley/RFIDCSCheckOutPage" },
      {
        name: "ห้องเย็น",
        icon: Snowflake,
        submenu: [
          { name: "CSR 3", href: "/coldStorage/Room/CSR3/CSR3Page" },
          { name: "Chill 2", href: "/coldStorage/Room/Chill2/Chill2Page" },
          { name: "Chill 4", href: "/coldStorage/Room/Chill4/Chill4Page" },
          { name: "Chill 5", href: "/coldStorage/Room/Chill5/Chill5Page" },
          { name: "Chill 6", href: "/coldStorage/Room/Chill6/Chill6Page" },
          { name: "4C", href: "/coldStorage/Room/4C/4CPage" },
          { name: "Ante", href: "/coldStorage/Room/AntePage/AntePage" },
          { name: "LargeRoom", href: "/coldStorage/Room/Large/LargePage" }
        ],
      },
      { name: "ตารางวัตถุดิบ", icon: Table2, href: "/coldStorage/RoomTable/RoomTableCSSupOnly" },
      {
        name: "ย้ายรถเข็น",
        icon: MoveHorizontal,
        submenu: [
          { name: "CSR 3", href: "/coldStorage/Move/CSR3/CSR3Page" },
          { name: "Chill 2", href: "/coldStorage/Move/Chill2/Chill2Page" },
          { name: "Chill 4", href: "/coldStorage/Move/Chill4/Chill4Page" },
          { name: "Chill 5", href: "/coldStorage/Move/Chill5/Chill5Page" },
          { name: "Chill 6", href: "/coldStorage/Move/Chill6/Chill6Page" },
          { name: "4C", href: "/coldStorage/Move/4C/4CPage" },
          { name: "Ante", href: "/coldStorage/Move/AntePage/AntePage" },
          { name: "LargeRoom", href: "/coldStorage/Move/Large/LargePage" }
        ],
      },
      { name: "ประวัติ", icon: History, href: "/coldStorage/HisInput/HisInputPage" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarCS = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น" sections={SECTIONS} />;

export default SidebarCS;
