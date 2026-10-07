import { useMemo } from "react";
import { Home, Fish, Factory, Package, Rows3, ShoppingCart, Users, Newspaper, ScanEye, FileUp, Timer, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarSup = () => {
  const posId = parseInt(localStorage.getItem("pos_id"), 10);
  const canManageTrolley = [4, 6].includes(posId);   // "จัดการรถเข็น" and "เพิ่ม Line Type/Line name" are for pos 4 and 6 only

  const sections = useMemo(() => [
    {
      items: [
        { name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/sup/Sheet" },
        { name: "หน้าหลัก", icon: Home, href: "/sup" },
        {
          name: "จัดการวัตถุดิบ", icon: Fish,
          submenu: [
            { name: "ตารางวัตถุดิบ", href: "/sup/Rawmat" },
            { name: "ตารางประเภทวัตถุดิบ", href: "/sup/RawmatType" },
            { name: "ตารางกลุ่มเวลาวัตถุดิบ", href: "/sup/RawmatGroup" },
            { name: "ตารางการแปรรูป", href: "/sup/Processing" },
          ],
        },
        {
          name: "จัดการการผลิต", icon: Factory,
          submenu: [
            { name: "ตารางการผลิตวัตถุดิบ", href: "/sup/ProdRawmat" },
            { name: "ตารางแผนการผลิต", href: "/sup/Production" },
          ],
        },
        {
          name: "จัดการ PKG,Ingradiant", icon: Package,
          submenu: [
            { name: "ตารางจัดาร PKG", href: "/sup/AddPKG" },
            { name: "ตารางจัดการ Ingradiant", href: "/sup/AddIGD" },
          ],
        },
        ...(canManageTrolley ? [{
          name: "เพิ่ม Line Type/Line name", icon: Rows3,
          submenu: [
            { name: "เพิ่ม Line Type", href: "/sup/AddLine" },
            { name: "เพิ่ม Line Name", href: "/sup/AddLineName" },
          ],
        }] : []),
        ...(canManageTrolley ? [{
          name: "จัดการรถเข็น", icon: ShoppingCart,
          submenu: [
            { name: "จัดการรถเข็น", href: "/sup/CartMange" },
            { name: "เคลียร์รถเข็น", href: "/sup/TrackTrolley" },
          ],
        }] : []),
        { name: "การจัดการพนักงาน", icon: Users, href: "/sup/TableUserPage" },
        { name: "ประวัติเข้า/ออก ห้องเย็น", icon: Newspaper, href: "/sup/HisInput" },
        { name: "จัดการ Metal Detector", icon: ScanEye, href: "/sup/MDmanage" },
        { name: "นำเข้าแผนการผลิต", icon: FileUp, href: "/sup/ipscvF" },
        { name: "นำเข้าข้อมูลวัตถุดิบ", icon: FileUp, href: "/sup/import/rm/csv" },
        { name: "Delay Time Traking", icon: Timer, href: "/sup/DelayTraking" },
        { name: "Delay Time", icon: Timer, href: "/sup/delay/report" },
        { name: "Delay Time line", icon: Timer, href: "/sup/delay/report/line" },
        { name: "Delay Time Percentage", icon: Timer, href: "/sup/DelayTimepercentage_tie" },
        { name: "Delay Time Tracking SC", icon: Timer, href: "/sup/DelayTimeTrackingRM" },
        { name: "Delay Time Tracking IP", icon: Timer, href: "/sup/TrackTrolley/inprocess" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], [canManageTrolley]);

  return <AppSidebar title="DelayHUB" subtitle="Supervisor" sections={sections} />;
};

export default SidebarSup;
