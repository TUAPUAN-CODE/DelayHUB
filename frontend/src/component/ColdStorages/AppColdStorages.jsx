// ─── AppColdStorages.jsx (updated routes) ────────────────────────────────────
// Replace the old per-room imports/routes (Chill2, CSR3, Chill4, etc.)
// with a single UniversalColdStoragePage for all cs_id >= 10

import { Route, Routes, Navigate } from "react-router-dom";

import Sidebar from "./SidebarOven.jsx";


import ParentComponent from "./CheckIn/4C/ParentComponent4C";
import CSAntePageCI from "./CheckIn/AntePage/AntePage";
import CS4CPageCI from "./CheckIn/4C/4CPage";

// ▼ cs_id 1–8: ยังคงเป็นไฟล์เดิม (เพราะสร้างก่อน)
import CSChill2PageCI from "./CheckIn/Chill2/Chill2Page";
import CSCSR3PageCI from "./CheckIn/CSR3/CSR3Page";
import CSChill4PageCI from "./CheckIn/Chill4/Chill4Page";
import CSChill5PageCI from "./CheckIn/Chill5/Chill5Page";
import CSChill6PageCI from "./CheckIn/Chill6/Chill6Page";
import CSLargePageCI from "./CheckIn/LargeColdRoom/LargePage";

// ▼ cs_id >= 10: ไฟล์ universal ไฟล์เดียว

import CSAntePageCO from "./Room/AntePage/AntePage";
import CS4CPageCO from "./Room/4C/4CPage";
import CSChill2PageCO from "./Room/Chill2/Chill2Page";
import CSCSR3PageCO from "./Room/CSR3/CSR3Page";
import CSChill4PageCO from "./Room/Chill4/Chill4Page";
import CSChill5PageCO from "./Room/Chill5/Chill5Page";
import CSChill6PageCO from "./Room/Chill6/Chill6Page";
import CSLargePageCO from "./Room/LargeColdRoom/LargePage";

import Modal4C from "./Room/Modals/Modal4C";
import ModalAnte from "./Room/Modals/ModalAnte";
import Modalchill6 from "./Room/Modals/Modalchill6";
import Modalchill2 from "./Room/Modals/Modalchill2";
import Modalchill4 from "./Room/Modals/Modalchill4";
import Modalchill5 from "./Room/Modals/Modalchill5";
import ModalCSR3 from "./Room/Modals/ModalCSR3";

import SalesPage from "./MatCold/MatColdPage.jsx";
import HistoryBakingPrep from "./HistoryBaking/HistoryBakingPage.jsx";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import SapSheetPage from "./SapSheet/SapSheetPage.jsx";
import MasterSheetPage from "../Sheet/SheetPage";
import RoomTableCSSupOnly from "./RoomTablerminprocess/RoomTable.jsx";
import RoomTableCSSupOnlysend from "./RoomMonitor/RoomTable.jsx";
import ScanSAPPageComeAnti from "./ScanSAPComeAnti/ScanSAPPage.jsx";
import ScanSAPPageOutCS from "./ScanSAPOutCS/ScanSAPPage.jsx";
import Dashboardrmoutprocess from "./Dashboardrmoutprocess/RoomTable.jsx";
import Dashboardrminprocess from "./dashboardrminprocess/RoomTable.jsx";


function AppColdStorages() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-80" />
        <div className="absolute inset-0 backdrop-blur-sm" />
      </div>

      <Sidebar />
      <Routes>
        <Route path="/" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/SapSheet" element={<SapSheetPage />} />
        <Route path="/Sheet" element={<MasterSheetPage role="cs2" />} />
        <Route path="/LargeRooms" element={<RoomTableCSSupOnlysend />} />
        {/* หน้าเดิมที่รวมเข้าตารางเดียวแล้ว */}
        <Route path="/products" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/ScanSAPPage/defrost" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/ScanSAPPageEDF/end/defrost" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/Checkin/rm/in/line/not/inprocess" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/table/rm" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/RoomTableCS" element={<Navigate to="/ColdStorages/SapSheet" replace />} />
        <Route path="/CheckIn/rooms" element={<Navigate to="/ColdStorages/LargeRooms" replace />} />
        <Route path="/CheckOut/CheckOutPage" element={<Navigate to="/ColdStorages/LargeRooms" replace />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/analytics" element={<HistoryBakingPrep />} />
        <Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
        <Route
          path="/CheckIn/ParentComponent"
          element={<ParentComponent />}
        />
        <Route path="/CheckIn/4C/4CPage" element={<CS4CPageCI />} />
        <Route
          path="/CheckIn/AntePage/AntePage"
          element={<CSAntePageCI />}
        />

        {/* ── cs_id 1–8 (legacy per-room pages) ── */}
        <Route
          path="/CheckIn/Chill2/Chill2Page"
          element={<CSChill2PageCI />}
        />
        <Route path="/CheckIn/CSR3/CSR3Page" element={<CSCSR3PageCI />} />
        <Route
          path="/CheckIn/Chill4/Chill4Page"
          element={<CSChill4PageCI />}
        />
        <Route
          path="/CheckIn/Chill5/Chill5Page"
          element={<CSChill5PageCI />}
        />
        <Route
          path="/CheckIn/Chill6/Chill6Page"
          element={<CSChill6PageCI />}
        />
        <Route
          path="/CheckIn/Large/LargePage"
          element={<CSLargePageCI />}
        />

        {/* ── cs_id >= 10: single universal page ── */}

        <Route
          path="/RoomTable/RoomTable"
          element={<RoomTableCSSupOnly />}
        />
        <Route path="/RoomTable/RoomTable/send" element={<Navigate to="/ColdStorages/LargeRooms" replace />} />
        <Route
          path="/ScanSAPPageEDF/come/cs/after/defrost"
          element={<ScanSAPPageComeAnti />}
        />
        <Route
          path="/ScanSAPPageOUTcs/out/cs"
          element={<ScanSAPPageOutCS />}
        />

        <Route
          path="/dashboardrminprocess"
          element={<Dashboardrminprocess />}
        />

        <Route
          path="/dashboardrmoutprocess"
          element={<Dashboardrmoutprocess />}
        />
      </Routes>
    </div>
  );
}

export default AppColdStorages;