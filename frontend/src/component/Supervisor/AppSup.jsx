import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";

import Sidebar from "./SidebarSup";

import SheetPage from "../Sheet/SheetPage";
// ใช้ Lazy Loading เพื่อลดขนาดไฟล์ที่โหลดตอนแรก
const TableUserPage = lazy(() => import("./TableUser/TableUserPage"));

// Rawmat
const RawmatTypeTable = lazy(() => import("./TableRawmat/RawmatType/RawmatTypeTable"));
const RawmatTable = lazy(() => import("./TableRawmat/Rawmat/RawmatTable"));
const ProcessingTable = lazy(() => import("./TableRawmat/Processing/ProcessingTable"));
const CookGroupTable = lazy(() => import("./TableRawmat/CookGroup/CookGroupTable"));
const RawmatGroupTable = lazy(() => import("./TableRawmat/RawmatGroup/RawmatGroupTable"));

// Production
const ProdRawmatTable = lazy(() => import("./TableProduction/ProdRawmat/ProdRawmatTable"));
const ProductionTable = lazy(() => import("./TableProduction/Production/ProductionTable"));


const MDmanagepage = lazy(() => import("./MDmanage/MDmanagepage"));



const LineTable = lazy(() => import("./TableLine/AddLine/LineTable"));

const LineNameTable = lazy(() => import("./TableLine/AddLineName/LineNameTable"));

const CartTable = lazy(() => import("./CartTable/CartTable"));

const WorkplaceSelector = lazy(() => import("../User/WorkplaceSelector.jsx"));



const WorkplacePage = lazy(() => import("./Workplace/WorkplacePage"));

const TrackTrolleyQC = lazy(() => import("./TrackTrolley/TrackTrolleyQC.jsx"));
const ReportPage = lazy(() => import("./Report/ReportPage")); // one report: %Tie / Pareto / trend / table (replaces Delay %, Delay SC, Delay IP)


// เก็บเส้นทางทั้งหมดไว้ใน Array เพื่อลดโค้ดซ้ำซ้อน
const routes = [

  // จัดการวัตถุดิบ | Rawmat Management
  { path: "/RawmatType", element: <RawmatTypeTable /> },
  { path: "/Rawmat", element: <RawmatTable /> },
  { path: "/RawmatGroup", element: <RawmatGroupTable /> },
  { path: "/Processing", element: <ProcessingTable /> },
  // { path: "/CookGroup", element: <CookGroupTable /> },

  // จัดการการผลิต
  { path: "/ProdRawmat", element: <ProdRawmatTable /> },
  { path: "/Production", element: <ProductionTable /> },

  // จัดการพนักงาน
  { path: "/TableUserPage", element: <TableUserPage /> },

  // จัดการการรถเข็นรอเข้าห้องเย็น


// จัดการ Metal Detector
{ path: "/MDmanage", element: <MDmanagepage /> },


{ path: "/AddLine", element: <LineTable /> },
{ path: "/AddLineName", element: <LineNameTable /> },

{ path: "/CartMange", element: <CartTable /> },




{ path: "/WorkplaceSelector", element: <WorkplaceSelector /> },
{ path: "/WorkplacePage", element: <WorkplacePage /> },
{ path: "/TrackTrolley", element: <TrackTrolleyQC/> },
{ path: "/Report", element: <ReportPage /> },
  // // จัดการการทำงาน
  // { path: "/Table/WorkPlace", element: <TableWorkPlaceSup /> },
  // { path: "/Table/Role", element: <TableRoleSup /> },
  // { path: "/Table/Activity", element: <TableActivitySup /> },
  // { path: "/Table/PD", element: <TablePDSup /> },
];

function AppSup() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br opacity-80" />
        <div className="absolute inset-0 " />
      </div>

      <Sidebar />

      {/* ใช้ Suspense เพื่อรองรับ Lazy Loading */}
      <Suspense
        fallback={
          <div className="text-center mt-10 text-white">Loading...</div>
        }
      >
        <Routes>
          <Route path="/Sheet" element={<SheetPage role="sup" />} />
          {/* the three old delay reports became one: old links go to the report */}
          {["/DelayTimepercentage_tie", "/DelayTimeTrackingRM", "/TrackTrolley/inprocess"].map((p) => (
            <Route key={p} path={p} element={<Navigate to="/sup/Report" replace />} />
          ))}
          {/* pages that were removed: old links go to the sheet */}
          {["/", "/TableMainSupv", "/TableToCold", "/HisInput", "/ipscvF", "/AddPKG", "/AddIGD", "/DelayTraking", "/import/rm/csv", "/delay/report", "/delay/report/line", "/DelayTimeTrackingRMinprocess"].map((p) => (
            <Route key={p} path={p} element={<Navigate to="/sup/Sheet" replace />} />
          ))}
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
    </div>
  );
}

export default AppSup;
