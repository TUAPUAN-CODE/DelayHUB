import React, { useState, useEffect } from 'react';
// Update this import path to match your project structure
import TableMainPrep from './TableOvenToCold';
import axios from "axios";
axios.defaults.withCredentials = true;
import ExportExcelButton from "./ExportExcelButton";
import ModalEditPD from './ModalEditPD';
import ModalEditHU from './ModalEditHU';
import WeightSummaryCard from "./WeightSummaryCard"; // นำเข้าคอมโพเนนต์การ์ดสรุปน้ำหนัก
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [openModal1, setOpenModal1] = useState(false);
  const [openModal2, setOpenModal2] = useState(false);
  const [openModal3, setOpenModal3] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false); // ✅ เพิ่ม state สำหรับ ModalDelete
  const [dataForModal1, setDataForModal1] = useState(null);
  const [dataForModal2, setDataForModal2] = useState(null);
  const [dataForModal3, setDataForModal3] = useState(null);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForSuccessModal, setDataForSuccessModal] = useState(null);
  const [dataForDeleteModal, setDataForDeleteModal] = useState(null); // ✅ เพิ่ม state สำหรับข้อมูล ModalDelete
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSummaryCard, setShowSummaryCard] = useState(false); // เพิ่มสถานะสำหรับเปิด/ปิดการ์ดสรุป

  // เพิ่มสถานะสำหรับการค้นหาตามช่วงเวลา
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);



  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/coldstorages/table/out`);
      const raw = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
      setTableData(raw);
      setFilteredData(raw);
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // เรียกใช้ฟังก์ชันดึงข้อมูลเมื่อ component โหลด
  useEffect(() => {
    fetchData();
  }, []);

  // ฟังก์ชันกรองข้อมูลตามช่วงเวลา
  const filterDataByDateRange = () => {
    if (!startDate && !endDate) {
      // ถ้าไม่ได้ระบุวันที่ให้แสดงข้อมูลทั้งหมด
      setFilteredData(tableData);
      setIsFiltering(false);
      return;
    }

    setIsFiltering(true);

    const filtered = tableData.filter(item => {
      if (!item.qc_datetime) return false;

      const itemDate = new Date(item.qc_datetime);
      let isInRange = true;

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        isInRange = isInRange && itemDate >= start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        isInRange = isInRange && itemDate <= end;
      }

      return isInRange;
    });

    setFilteredData(filtered);
  };

  // ฟังก์ชันรีเซ็ตการกรอง
  const resetFilter = () => {
    setStartDate('');
    setEndDate('');
    setFilteredData(tableData);
    setIsFiltering(false);
  };

  const clearData = () => {
    setDataForModal1(null);
    setDataForModal2(null);
    setDataForModal3(null);
  };

  const handleOpenSuccess = (data) => {
    setDataForSuccessModal({
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      rmfp_id: data.rmfp_id,
    });
    setOpenSuccessModal(true);
  };

  // ฟังก์ชันที่จะถูกเรียกเมื่อคลิกที่ไอคอนตา
  const handleRowClick = (rowId) => {
    console.log("Row clicked with ID:", rowId);

    // ค้นหาข้อมูลแถวจาก rowId
    const rowData = filteredData.find(item => item.mapping_id === rowId);
  };

  // สร้างฟังก์ชันเพื่อให้ส่งให้ TableMainPrep
  const handleOpenModal = (data) => {
    console.log("Selected row data:", data);
    // ไม่ต้องเปิด Modal แล้ว เพียงแค่ log ข้อมูล
  };

  const handleOpenEditModal = (data) => {
    setDataForEditModal(data);
    setOpenEditModal(true);
  };

  const handleCloseEditModal = () => {
    setOpenEditModal(false);
    setDataForEditModal(null);
  };

  // ✅ ฟังก์ชันเปิด ModalDelete
  const handleOpenDeleteModal = (data) => {
    setDataForDeleteModal(data);
    setOpenDeleteModal(true);
  };

  // ✅ ฟังก์ชันปิด ModalDelete
  const handleCloseDeleteModal = () => {
    setOpenDeleteModal(false);
    setDataForDeleteModal(null);
  };

  // ฟังก์ชันสลับการแสดง/ซ่อนการ์ดสรุป
  const toggleSummaryCard = () => {
    setShowSummaryCard(!showSummaryCard);
  };

  return (
    <div>
      {/* ส่วนค้นหาตามช่วงเวลา */}
     

      {/* การ์ดสรุปน้ำหนัก - แสดงเมื่อ showSummaryCard เป็น true */}
      {!loading && showSummaryCard && <WeightSummaryCard data={filteredData} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 150px)' }}>
          <p style={{ color: '#787878', fontSize: '16px' }}>กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <TableMainPrep
          handleOpenModal={handleOpenModal}
          handleOpenEditModal={handleOpenEditModal}
          handleOpenSuccess={handleOpenSuccess}
          handleOpenDeleteModal={handleOpenDeleteModal} // ✅ ส่ง handler ไปให้ TableMainPrep
          data={filteredData || []}
          handleRowClick={handleRowClick}
        />
      )}

      {/* ✅ ModalEditPD */}
      {dataForEditModal && (
        <ModalEditPD
          open={openEditModal}
          onClose={handleCloseEditModal}
          data={dataForEditModal}
          onSuccess={() => {
            handleCloseEditModal();
            fetchData();
          }}
        />
      )}

      {/* ✅ ModalEditHU */}
      <ModalEditHU
        open={openDeleteModal}
        onClose={handleCloseDeleteModal}
        data={dataForDeleteModal}
        onSuccess={() => {
          handleCloseDeleteModal();
          fetchData();
        }}
      />
    </div>
  );
};

export default ParentComponent;