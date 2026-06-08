import { Route, Routes } from "react-router-dom";

import SidebarPrep from "./SidebarPrep";
import MainProduction from "./Main/MainPage";
import HistoryCookedPage from "./HistoryCooked/HistoryCookedPage";
import MatManagePage from "./MatManage/MatManagePage";
import MatReworkPage from "./MatRework/MatReworkPage";
import ScanSAPPage from "./ScanSAP/ScanSAPPage";
import HistoryTranform from "./HistoryTransform/HistoryTransformPage";
import MatImportPage from "./MatImport/MatImportPage";
import ManageSelect from "../User/ManageSelect";
import HistoryPage from "./History/HistoryPage";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import BatchSAPPage from "./BatchSAP/BatchSAPPage.jsx";
import EmulsionPage from "./Emulsion/EmusionPage.jsx";
import RM_EMU from "./RMEmu/MainPage.jsx";
import BatchMIXPage from "./BatchMIX/BatchMIXPage.jsx";
import TraceBack_HU from "./TraceBackHU/MainPage.jsx";
import EditDataTrolley from "./EditDataTrolley/EditDataTrolley.jsx";
import ColdCheck from "./ColdCheck/ColdCheck.jsx";
import IncludeRawmatPage from "./IncludeRawmat/IncludeRawmatPage.jsx";
import CheckInPagePrep from "./CheckIn/CheckInPage.jsx";
import RMInclude from "./RMInclude/MainPage.jsx";
import TrackTrolley from "./TrackTrolley/TrackTrolley.jsx";
import IncludeRawmatPageotherplant from "./IncludeRawmatOtherPlant/IncludeRawmatPage.jsx";
import BatchSAPPages from "./MaterialReceiveFromCold/BatchSAPPage.jsx";
import Checkout from "./CheckOut/BatchSAPPage.jsx";
import Timestamp from "./Timestampbroth/Timestampborth.jsx";


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
        <Route path="/" element={<TrackTrolley/>} />
        <Route
          path="/HistoryCooked/HistoryCookedPage"
          element={<HistoryCookedPage />}
        />
        <Route path="/MatManage/MatManagePage" element={<MatManagePage />} />
        <Route path="/MatRework/MatReworkPage" element={<MatReworkPage />} />
        <Route path="/ScanSAP/ScanSAPPage" element={<ScanSAPPage />} />
        <Route path="/MatImport/MatImportPage" element={<MatImportPage />} />
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        <Route path="/manageprep" element={<BatchSAPPage />} />
        <Route path="/managepreps" element={<BatchSAPPages />} />
        <Route path="/HistoryTranform/HistoryTranformPage"element={<HistoryTranform />}/>
        <Route path="/User/SelectWP" element={<ManageSelect />} />
        <Route path="/RM_EMU" element={<RM_EMU/>} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/Emulsions" element={<EmulsionPage />} />
        <Route path="/BatchMIX" element={<BatchMIXPage />} />
        <Route path="/TraceBack_HU" element={<TraceBack_HU />} />
        <Route path="/EditDataTrolley" element={<EditDataTrolley />} />
        <Route path="/ColdCheck" element={<ColdCheck />} />
        <Route path="/IncludeRawmat" element={<IncludeRawmatPage />} />
        <Route path="/checkinpage" element={<CheckInPagePrep />} />
        <Route path="/RMInclude" element={<RMInclude />} />
        <Route path="/IncludeRawmatPageotherplant" element={<IncludeRawmatPageotherplant />} />
        <Route path="/pd/checkout" element={<Checkout />} />
        <Route path="/timestamp" element={<Timestamp />} />
      </Routes>
    </div>
  );
}

export default AppPrep;
