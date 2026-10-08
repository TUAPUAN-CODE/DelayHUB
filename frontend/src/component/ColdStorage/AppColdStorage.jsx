import { Navigate, Route, Routes } from "react-router-dom";

import Sidebar from "./SidebarCS";

import CSAntePageCO from "./Room/AntePage/AntePage";
import CS4CPageCO from "./Room/4C/4CPage";
import CSChill2PageCO from "./Room/Chill2/Chill2Page";
import CSCSR3PageCO from "./Room/CSR3/CSR3Page";
import CSChill4PageCO from "./Room/Chill4/Chill4Page";
import CSChill5PageCO from "./Room/Chill5/Chill5Page";
import CSChill6PageCO from "./Room/Chill6/Chill6Page";
import CSLargePageCO from "./Room/LargeColdRoom/LargePage"


import CSHisInputPage from "./HisInput/HisInputPage";
import MainCS from "./Main/MainPage";

import Modal4C from "./Room/Modals/Modal4C";
import ModalAnte from "./Room/Modals/ModalAnte";
import Modalchill6 from "./Room/Modals/Modalchill6";
import Modalchill2 from "./Room/Modals/Modalchill2";
import Modalchill4 from "./Room/Modals/Modalchill4";
import Modalchill5 from "./Room/Modals/Modalchill5";
import ModalCSR3 from "./Room/Modals/ModalCSR3";

import WorkplaceSelector from "../User/WorkplaceSelector.jsx";
import EmptyTrolley from "./EmptyTrolley/DeleteTrolleyPage"

import RoomTableCS from "./RoomTable/RoomTable";
import RFIDCSCheckOutPage from "./CheckOutWithRFID/CheckOutPage.jsx"

import SheetPage from "../Sheet/SheetPage";
const API_URL = import.meta.env.VITE_API_URL;


function AppColdStorage() {

	return (
		<div className='flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden'>
			{/* BG */}
			<div className='fixed inset-0 z-0'>
				<div className='absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-80' />
				<div className='absolute inset-0 backdrop-blur-sm' />
			</div>

			<Sidebar />
			<Routes>
				<Route path="/Sheet" element={<SheetPage role="cs1" />} />
				{/* <Route path='/' element={<MainCS />} /> */}
				<Route path='/' element={<Navigate to='/coldStorage/Sheet' replace />} />
				{/* the two pages that were removed (raw material table, room selector) are in the Sheet now: their addresses go there */}
				{['/Room', '/RoomTable/RoomTableCSSupOnly'].map((p) => (
					<Route key={p} path={p} element={<Navigate to='/coldStorage/Sheet' replace />} />
				))}
				{/* check-in / check-out / move were merged into the raw material table: old addresses go there */}
				{['/CheckIn/*', '/CheckOut/*', '/Move/*'].map((p) => (
					<Route key={p} path={p} element={<Navigate to='/coldStorage/Sheet' replace />} />
				))}


				<Route path='/Room/4C/4CPage' element={<CS4CPageCO />} />
				<Route path='/Room/AntePage/AntePage' element={<CSAntePageCO />} />
				<Route path='/Room/Chill2/Chill2Page' element={<CSChill2PageCO />} />
				<Route path='/Room/CSR3/CSR3Page' element={<CSCSR3PageCO />} />
				<Route path='/Room/Chill4/Chill4Page' element={<CSChill4PageCO />} />
				<Route path='/Room/Chill5/Chill5Page' element={<CSChill5PageCO />} />
				<Route path='/Room/Chill6/Chill6Page' element={<CSChill6PageCO />} />
				<Route path='/Room/Large/LargePage' element={<CSLargePageCO />} />
				<Route path='/HisInput/HisInputPage' element={<CSHisInputPage />} />
				<Route path='/RoomTable/RoomTable' element={<RoomTableCS />} />

				<Route path='/Room/Modals/Modal4C' element={<Modal4C />} />
				<Route path='/Room/Modals/ModalAnte' element={<ModalAnte />} />
				<Route path='/Room/Modals/Modalchill6' element={<Modalchill6 />} />
				<Route path='/Room/Modals/Modalchill2' element={<Modalchill2 />} />
				<Route path='/Room/Modals/Modalchill4' element={<Modalchill4 />} />
				<Route path='/Room/Modals/Modalchill5' element={<Modalchill5 />} />
				<Route path='/Room/Modals/ModalCSR3' element={<ModalCSR3 />} />

				
				<Route path='/WorkplaceSelector' element={<WorkplaceSelector />} />

				<Route path='/EmptyTrolley/DeleteTrolleyPage' element={<EmptyTrolley />} />
				<Route path='/EmptyTrolley/RFIDCSCheckOutPage' element={<RFIDCSCheckOutPage />} />
			</Routes>
		</div>
	);
}

export default AppColdStorage;
