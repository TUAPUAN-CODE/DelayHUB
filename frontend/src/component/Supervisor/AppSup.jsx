import { Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";

import Sidebar from "./SidebarSup";

// ใช้ Lazy Loading เพื่อลดขนาดไฟล์ที่โหลดตอนแรก
const MainSup = lazy(() => import("./Main/MainPage"));
const TableMainSupv = lazy(() => import("./Main/Asset/TableOvenToCold"));
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

const ImportRMCSV = lazy(() => import("./ImportCSVFileRM/mainPage.jsx"));

const HisInputPage = lazy(() => import("./HisInput/HisInputPage"));
const MDmanagepage = lazy(() => import("./MDmanage/MDmanagepage"));

const ImportscVF = lazy(() => import("./ImportCSVFile/mainPage"));

const TableToCold = lazy(() => import("./MainCold/MainPage"));

const LineTable = lazy(() => import("./TableLine/AddLine/LineTable"));

const LineNameTable = lazy(() => import("./TableLine/AddLineName/LineNameTable"));
const PKGTable = lazy(() => import("./TablePKGandIGD/AddLine/LineTable.jsx"));
const IGDTable = lazy(() => import("./TablePKGandIGD/AddLineName/LineNameTable.jsx"));

const CartTable = lazy(() => import("./CartTable/CartTable"));

const WorkplaceSelector = lazy(() => import("../User/WorkplaceSelector.jsx"));


const DelayTimeTrackingPage = lazy(() => import("./DelayTimeTracking/DelayTimeTrackingPage"));

const WorkplacePage = lazy(() => import("./Workplace/WorkplacePage"));

const DelayTimeDBSTrackingPage = lazy(() => import("./DelayTimeTrackingDBS/DelayTimeTrackingPage.jsx"));
const DelayTimeLine = lazy(() => import("./DelayTimeTrackingByLine/DelayTimeTrackingPage.jsx"));
const DelayTimepercentage_tie = lazy(() => import("./DelayTimeTrackingByPercentage/DelayTimeTrackingPage.jsx"));
const DelayTimeTrackingRM = lazy(() => import("./DelayTimeTrackingRM/DelayTimeTrackingPage"));
const DelayTimeTrackingRMinprocess = lazy(() => import("./DelayTimeTrackingRM copy/DelayTimeTrackingPage.jsx"));
const TrackTrolleyQC = lazy(() => import("./TrackTrolley/TrackTrolleyQC.jsx"));
const TrackTrolleyQCinprocess = lazy(() => import("./DelayTimeTrackingRM copy 2/DelayTimeTrackingPage.jsx"));


// เก็บเส้นทางทั้งหมดไว้ใน Array เพื่อลดโค้ดซ้ำซ้อน
const routes = [
  { path: "/", element: <MainSup /> },
  { path: "/TableMainSupv", element: <TableMainSupv /> },

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
  { path: "/TableToCold", element: <TableToCold /> },

  { path: "/HisInput", element: <HisInputPage /> },

// จัดการ Metal Detector
{ path: "/MDmanage", element: <MDmanagepage /> },

{ path: "/ipscvF", element: <ImportscVF /> },

{ path: "/AddLine", element: <LineTable /> },
{ path: "/AddLineName", element: <LineNameTable /> },
{ path: "/AddPKG", element: <PKGTable /> },
{ path: "/AddIGD", element: <IGDTable /> },

{ path: "/CartMange", element: <CartTable /> },

{ path: "/DelayTraking", element: <DelayTimeTrackingPage /> },



{ path: "/WorkplaceSelector", element: <WorkplaceSelector /> },
{ path: "/WorkplacePage", element: <WorkplacePage /> },
{ path: "/import/rm/csv", element: <ImportRMCSV/> },
{ path: "/delay/report", element: <DelayTimeDBSTrackingPage/> },
{ path: "/delay/report/line", element: <DelayTimeLine/> },
{ path: "/DelayTimepercentage_tie", element: <DelayTimepercentage_tie/> },
{ path: "/DelayTimeTrackingRM", element: <DelayTimeTrackingRM/> },
{ path: "/DelayTimeTrackingRMinprocess", element: <DelayTimeTrackingRMinprocess/> },
{ path: "/TrackTrolley", element: <TrackTrolleyQC/> },
{ path: "/TrackTrolley/inprocess", element: <TrackTrolleyQCinprocess/> },
  // // จัดการการทำงาน
  // { path: "/Table/WorkPlace", element: <TableWorkPlaceSup /> },
  // { path: "/Table/Role", element: <TableRoleSup /> },
  // { path: "/Table/Activity", element: <TableActivitySup /> },
  // { path: "/Table/PD", element: <TablePDSup /> },
];

function AppSup() {
  return (
    <div className="flex h-screen overflow-hidden">
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
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
    </div>
  );
}

export default AppSup;
