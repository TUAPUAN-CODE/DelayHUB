import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import SidebarOther from "./SidebarOther";

// Role "Other": Delay control of lots outside the trolley system + the chicken broth time stamp (moved here from the Prep Role)
const DelayControlPage = lazy(() => import("./DelayControl/DelayControlPage"));
const Timestamp = lazy(() => import("../Prep/Timestampbroth/Timestampborth.jsx"));

function AppOther() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br opacity-80" />
      </div>
      <SidebarOther />
      <Suspense fallback={<div className="text-center mt-10 text-white">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/other/delay" replace />} />
          <Route path="/delay" element={<DelayControlPage />} />
          <Route path="/timestamp" element={<Timestamp />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default AppOther;
