import { Navigate, Route, Routes } from "react-router-dom";

import HisCheck from "./HisCheck/HisCheckPage";
import SidebarQC from "./SidebarQC";
import QCMain from "./MainQC/MainPage";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import QCSelectWP from "../User/QCSelectWP"
import TrackTrolleyQC from "./TrackTrolley/TrackTrolleyQC.jsx"

import SheetPage from "../Sheet/SheetPage";
function AppQualityControl() {
	return (
		<div className='flex h-screen text-gray-100 overflow-hidden'>
			{/* BG */}
			<div className='fixed inset-0 z-0'>
				<div className='absolute inset-0 bg-gradient-to-br ' />
				<div className='absolute inset-0 backdrop-blur-sm' />
			</div>

			<SidebarQC />
			<Routes>
				<Route path="/Sheet" element={<SheetPage role="qc" />} />
				<Route path='/TrackTrolleyQC' element={<TrackTrolleyQC />} />
				<Route path='/HisCheck/HisCheckPage' element={<HisCheck />} />
				{/* ตารางตรวจสอบคุณภาพรวมอยู่ในตารางรวมวัตถุดิบแล้ว (tool ตรวจ QC) */}
				<Route path='/' element={<Navigate to='/qualitycontrol/Sheet' replace />} />
				<Route path="/User/SelectWP" element={<QCSelectWP />} />
				<Route path="/WorkplaceSelector" element={<WorkplaceSelector />} />
			</Routes>
		</div>
	);
}

export default AppQualityControl;
