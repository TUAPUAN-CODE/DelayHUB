import { Route, Routes } from "react-router-dom";


import Login from "../User/Login";
import React from "react";
// import SelectWp from "./component/User/SelectWorkplace";

function AppLogin() {
	return (
		<div className='flex h-screen overflow-hidden'>
			{/* BG */}
			<div className='fixed inset-0 z-0'>
				<div className='absolute inset-0 bg-gradient-to-b from-[#EAF1FF] via-[#F4F7FD] to-white' />
			</div>

			<Sidebar />
			<Routes>
				<Route path='/' element={<Login />} />
				<Route path='/Login' element={<Login />} />
		
			</Routes>
		</div>
	);
}

export default AppLogin;
