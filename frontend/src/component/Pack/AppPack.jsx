import { Route, Routes, Navigate } from "react-router-dom";

import SidebarPack from "./SidebarPack";
// import MainPack from "./Main/MainPage";
import CheckStatusPage from "./CheckStatus/CheckStatusPage";
import WorkplacePage from "./Workplace/WorkplacePage";
import LineSelectWP from "../User/LineSelectWP";
import ManagePack from "./Manage/ManagePage";
import MixRMPage from "./MixRM/MixRMPage";
import RequestRawmat from "./RequestRawmat/RequestrawmatPage";
import OrderRequestRawmat from "./OrderRequestrawmat/RequestrawmatPage";
import ManageRequestOrder from "./ManageRequestOrder/ManagePage";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import ScanBarcodePage from "./ScanSAP/ScanBatcodePage.jsx"
import ReportDelay from "./ReportDelay/ManagePage.jsx"
import Pull_History from "./PullHistory/ManagePage.jsx";
import PrintMasterPage from "./PrintMaster/CheckInPage.jsx";
import Printpackandroid from  "./PrintMasters/CheckInPage.jsx";
import PrintMasterPages from "./PrintMasters/CheckInPage.jsx";
import UsePKGPage from "./UsePKG/CheckInPage.jsx";
import ReportHubPage from "./Reports/ReportHubPage.jsx";

import SheetPage from "../Sheet/SheetPage";
function AppPack() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-80" />
        <div className="absolute inset-0 backdrop-blur-sm" />
      </div>

      <SidebarPack />
      <Routes>
        

        <Route path="/Sheet" element={<SheetPage role="pack" />} />
        <Route path="/CheckStatus/CheckStatusPage" element={<CheckStatusPage />} />
        <Route path="/" element={<Navigate to="/packaging/Sheet" replace />} />
        {/* <Route path="/manage/ManagePage" element={<ManagePack />} /> */}
        <Route path="/Workplace/WorkplacePage" element={<WorkplacePage />} />
        <Route path="/Mixed/Trolley" element={<MixRMPage />} />
        <Route path="/Request/Rawmat" element={<RequestRawmat />} />
        <Route path="/Order/Request/Rawmat" element={<OrderRequestRawmat />} />
        <Route path="/manage/Order/Request/Rawmat" element={<ManageRequestOrder />} />
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        {/* <Route path="/" element={<MainPack />} /> */}
        {/* เลือกสถานที่ไลน์ผลิต */}
        <Route path="/User/LineSelectWP" element={<LineSelectWP />} />
        <Route path="/ScanBarcodePage" element={<ScanBarcodePage />} />
        {/* ตารางจัดการ Delay / เพิ่ม RM / Check In รวมอยู่ในตารางรวมวัตถุดิบแล้ว — ลิงก์เดิมยังเปิดได้และพาไปที่ Sheet */}
        <Route path="/ManageRawmatPack" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/Report/sup" element={<ReportHubPage initialView="sup" />} />
        <Route path="/ReportDelay" element={<ReportDelay />} />
        <Route path="/Managedelaymaster" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/CheckInPagePack" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/Pull_History" element={<Pull_History />} />
        <Route path="/ReportPull" element={<ReportHubPage initialView="history" />} />
        <Route path="/ReportRawmatPackuser" element={<ReportHubPage initialView="report" />} />
        {/* หน้าเดิมที่รวมเข้าตาราง Delay แล้ว */}
        <Route path="/TrackTrolley" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/CheckOut" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/IncludeRawmatPagePack" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/PackTro/PackTroPage" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/History/HistoryPage" element={<Navigate to="/packaging/Sheet" replace />} />
        <Route path="/PrintMaster" element={<PrintMasterPage />} />
        <Route path="/Printpackandroid" element={<Printpackandroid />} />
        <Route path="/UsePKG" element={<UsePKGPage />} />

      </Routes>
    </div>
  );
}

export default AppPack;
