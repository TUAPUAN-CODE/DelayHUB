import { Route, Routes } from "react-router-dom";

import Sidebar from "./SidebarOven";

import OverviewPage from "./Main/MainPage";
import ProductsPage from "./ScanSAP/ScanSAPPage";

import SalesPage from "./MatCold/MatColdPage";
import HistoryBakingPrep from "./HistoryBaking/HistoryBakingPage";
import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import BatchSAPPage from "./BatchSAP/BatchSAPPage.jsx";
const API_URL = import.meta.env.VITE_API_URL;

function AppOven() {
	return (
		<div className='flex flex-col h-screen overflow-hidden'>
			{/* BG */}
			<div className='fixed inset-0 z-0'>
				<div className='absolute inset-0 bg-gradient-to-b from-[#EAF1FF] via-[#F4F7FD] to-white' />
			</div>

			<Sidebar />
			<Routes>
				<Route path='/' element={<OverviewPage />} />
				<Route path='/products' element={<ProductsPage />} />
				<Route path='/sales' element={<SalesPage />} />
				<Route path='/analytics' element={<HistoryBakingPrep />} />
				<Route path='/WorkplaceSelector' element={<WorkplaceSelector />} />
				<Route path='/manageOven' element={<BatchSAPPage />} />
			</Routes>
		</div>
	);
}

export default AppOven;
