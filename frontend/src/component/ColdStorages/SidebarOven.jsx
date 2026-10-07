import { Snowflake, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    title: "RM ไม่แปรรูป",
    items: [
      { name: "0) วัตถุดิบแปรรูป", icon: Snowflake, href: "/coldStorages/table/rm" },
      { name: "1) รับเข้าไม่แปรรูป", icon: Snowflake, href: "/ColdStorages/Checkin/rm/in/line/not/inprocess" },
      { name: "2) เริ่มละลาย", icon: Snowflake, href: "/ColdStorages/ScanSAPPage/defrost" },
      { name: "3) ละลายเสร็จ", icon: Snowflake, href: "/ColdStorages/ScanSAPPageEDF/end/defrost" },
      { name: "4) จ่ายลงไลน์", icon: Snowflake, href: "/ColdStorages/products" },
      { name: "5) Monitor", icon: Snowflake, href: "/ColdStorages/RoomTableCS" },
    ],
  },
  {
    title: "RM แปรรูป",
    items: [
      { name: "0) Monitor", icon: Snowflake, href: "/coldStorages/RoomTable/RoomTable/send" },
      { name: "1) รับเข้า RM แปรรูป", icon: Snowflake, href: "/ColdStorages/CheckIn/rooms" },
      { name: "2) ส่งออก RM แปรรูป", icon: Snowflake, href: "/coldStorages/CheckOut/CheckOutPage" },
    ],
  },
  { items: [{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }] },
];

const SidebarOven = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น v2" sections={SECTIONS} />;

export default SidebarOven;
