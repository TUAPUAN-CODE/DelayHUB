import { Route, Routes } from "react-router-dom";

import SidebarPack from "./SidebarPack.jsx";
import Report from "./Report/ManagePage.jsx"


function AppMaster() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EAF1FF] via-[#F4F7FD] to-white" />
      </div>

      <SidebarPack />
      <Routes>
        <Route path="/report" element={<Report />} />
      </Routes>
    </div>
  );
}

export default AppMaster;
