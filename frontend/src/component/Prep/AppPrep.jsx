import { Navigate, Route, Routes } from "react-router-dom";

import SidebarPrep from "./SidebarPrep";
import MainProduction from "./Main/MainPage";
import HistoryCookedPage from "./HistoryCooked/HistoryCookedPage";
import MatReworkPage from "./MatRework/MatReworkPage";
import ScanSAPPage from "./ScanSAP/ScanSAPPage";
import HistoryTranform from "./HistoryTransform/HistoryTransformPage";
import ManageSelect from "../User/ManageSelect";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import EmulsionPage from "./Emulsion/EmusionPage.jsx";
import RM_EMU from "./RMEmu/MainPage.jsx";
import BatchMIXPage from "./BatchMIX/BatchMIXPage.jsx";
import EditDataTrolley from "./EditDataTrolley/EditDataTrolley.jsx";
import IncludeRawmatPage from "./IncludeRawmat/IncludeRawmatPage.jsx";
import CheckInPagePrep from "./CheckIn/CheckInPage.jsx";
import IncludeRawmatPageotherplant from "./IncludeRawmatOtherPlant/IncludeRawmatPage.jsx";
import Timestamp from "./Timestampbroth/Timestampborth.jsx";
import TimeStampMainPage from "./TimeStampMain/TimeStampMainPage.jsx";


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
        <Route path="/" element={<TimeStampMainPage />} />
        <Route
          path="/HistoryCooked/HistoryCookedPage"
          element={<HistoryCookedPage />}
        />
        <Route path="/MatRework/MatReworkPage" element={<MatReworkPage />} />
        <Route path="/ScanSAP/ScanSAPPage" element={<ScanSAPPage />} />
        <Route path="/MatImport/MatImportPage" element={<Navigate to="/prep/MatRework/MatReworkPage?tab=import" replace />} />
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        <Route path="/HistoryTranform/HistoryTranformPage"element={<HistoryTranform />}/>
        <Route path="/User/SelectWP" element={<ManageSelect />} />
        <Route path="/RM_EMU" element={<RM_EMU/>} />
        <Route path="/Emulsions" element={<EmulsionPage />} />
        <Route path="/BatchMIX" element={<BatchMIXPage />} />
        <Route path="/EditDataTrolley" element={<EditDataTrolley />} />
        <Route path="/IncludeRawmat" element={<IncludeRawmatPage />} />
        <Route path="/checkinpage" element={<CheckInPagePrep />} />
        <Route path="/IncludeRawmatPageotherplant" element={<IncludeRawmatPageotherplant />} />
        {/* addresses of the pages that were merged into the Time Stamp page keep working (bookmarks, old links) */}
        {["/manageprep", "/managepreps", "/pd/checkout", "/MatManage/MatManagePage", "/ColdCheck", "/RMInclude", "/TraceBack_HU", "/history"].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/prep" replace />} />
        ))}
        <Route path="/timestamp" element={<Timestamp />} />
      </Routes>
    </div>
  );
}

export default AppPrep;
