import { Navigate, Route, Routes } from "react-router-dom";

import SidebarPrep from "./SidebarPrep";
import MainProduction from "./Main/MainPage";
import HistoryCookedPage from "./HistoryCooked/HistoryCookedPage";
import HistoryTranform from "./HistoryTransform/HistoryTransformPage";
import ManageSelect from "../User/ManageSelect";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import RM_EMU from "./RMEmu/MainPage.jsx";
import EditDataTrolley from "./EditDataTrolley/EditDataTrolley.jsx";
import CheckInPagePrep from "./CheckIn/CheckInPage.jsx";
import Timestamp from "./Timestampbroth/Timestampborth.jsx";


import SheetPage from "../Sheet/SheetPage";
function AppPrep() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-80" />
        <div className="absolute inset-0 backdrop-blur-sm" />
      </div>

      <SidebarPrep />
      <Routes>
        <Route path="/Sheet" element={<SheetPage role="prep" />} />
        <Route path="/" element={<Navigate to="/prep/Sheet" replace />} />
        <Route
          path="/HistoryCooked/HistoryCookedPage"
          element={<HistoryCookedPage />}
        />
        <Route path="/ScanSAP/ScanSAPPage" element={<Navigate to="/prep/Sheet" replace />} />
        
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        <Route path="/HistoryTranform/HistoryTranformPage"element={<HistoryTranform />}/>
        <Route path="/User/SelectWP" element={<ManageSelect />} />
        <Route path="/RM_EMU" element={<RM_EMU/>} />
        <Route path="/EditDataTrolley" element={<EditDataTrolley />} />
        <Route path="/checkinpage" element={<CheckInPagePrep />} />
        {/* รอแก้ไข / กลับมาเตรียม / ผสมวัตถุดิบ ทั้ง 4 หน้า รวมอยู่ในตารางรวมวัตถุดิบแล้ว (tool ในตาราง) — ลิงก์เดิมพาไปที่ Sheet */}
        {["/MatRework/MatReworkPage", "/MatImport/MatImportPage", "/Emulsions", "/BatchMIX", "/IncludeRawmat", "/IncludeRawmatPageotherplant"].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/prep/Sheet" replace />} />
        ))}
        {/* addresses of the pages that were merged into the Time Stamp page keep working (bookmarks, old links) */}
        {["/manageprep", "/managepreps", "/pd/checkout", "/MatManage/MatManagePage", "/ColdCheck", "/RMInclude", "/TraceBack_HU", "/history"].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/prep/Sheet" replace />} />
        ))}
        <Route path="/timestamp" element={<Timestamp />} />
      </Routes>
    </div>
  );
}

export default AppPrep;
