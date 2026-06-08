import React, { useState, useEffect, useCallback, useRef } from 'react';
import TableMainPrep from './Table';
import Modal1 from './Modal1';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import ModalDelete from './ModalDelete';
import axios from "axios";
axios.defaults.withCredentials = true;
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

// Helper: วันนี้ในรูป YYYY-MM-DD (local time)
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ParentComponent = () => {
  const [openModal1, setOpenModal1] = useState(false);
  const [openModal2, setOpenModal2] = useState(false);
  const [openModal3, setOpenModal3] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [dataForModal1, setDataForModal1] = useState(null);
  const [dataForModal2, setDataForModal2] = useState(null);
  const [dataForModal3, setDataForModal3] = useState(null);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForSuccessModal, setDataForSuccessModal] = useState(null);
  const [dataForDeleteModal, setDataForDeleteModal] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // ✅ วันที่ที่เลือก (default = วันนี้)
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const rmTypeIds = JSON.parse(localStorage.getItem('rm_type_id')) || [];

  const formatDateTime = (dateString) => {
    if (!dateString || dateString === "แสดงข้อมูล") return dateString || "ไม่มีข้อมูล";
    if (typeof dateString === 'string' && dateString.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)) {
      const [datePart, timePart] = dateString.split(' ');
      const [day, month, year] = datePart.split('/');
      return `${day}/${month}/${year} ${timePart}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // ✅ fetchData รับ date param
  const fetchData = useCallback(async (date) => {
    setIsFetching(true);
    try {
      const response = await axios.get(`${API_URL}/api/coldstorages/scan/sap/month`, {
        params: {
          rm_type_ids: rmTypeIds.join(','),
          withdraw_date: date || selectedDate,  // ✅ ส่งวันที่
        }
      });

      const data = response.data;
      const rawData = Array.isArray(data) ? data : (data.success ? data.data : []);
      setTableData(rawData.map(item => ({ ...item })));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedDate, rmTypeIds]);

  // Debounced fetchData
  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => { fetchData(); }, 300);
  }, [fetchData]);

  // ✅ เมื่อเปลี่ยนวันที่ ดึงข้อมูลใหม่
  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });
    socketRef.current = newSocket;
    newSocket.emit('joinRoom', 'saveRMForProdRoom');

    const handleDataUpdate = () => { if (!isFetching) fetchDataDebounced(); };
    newSocket.on('dataUpdated', handleDataUpdate);
    newSocket.on('dataDelete', handleDataUpdate);
    newSocket.on('rawMaterialSaved', handleDataUpdate);

    return () => {
      newSocket.off('dataUpdated');
      newSocket.off('dataDelete');
      newSocket.off('rawMaterialSaved');
      newSocket.disconnect();
      socketRef.current = null;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  const clearData = () => {
    setDataForModal1(null);
    setDataForModal2(null);
    setDataForModal3(null);
  };

  const handleOpenModal1 = (data) => {
    if (!data) return;
    setDataForModal1({
      ...data,
      rm_type_id: data.rm_type_id,
      mat: data.mat,
      mat_name: data.mat_name,
      CookedDateTime: data.CookedDateTime,
      withdraw_date: data.withdraw_date,
      production: data.production,
      level_eu: data.level_eu
    });
    setOpenModal1(true);
  };

  const handleOpenModal2 = (data) => {
    if (!data || !dataForModal1) return;
    setDataForModal2({
      ...data,
      batch: data.batch,
      rmfp_id: dataForModal1.rmfp_id,
      CookedDateTime: dataForModal1.CookedDateTime,
      dest: dataForModal1.dest,
      rm_type_id: dataForModal1.rm_type_id,
      mat: dataForModal1.mat,
      mat_name: dataForModal1.mat_name,
      withdraw_date: dataForModal1.withdraw_date,
      production: dataForModal1.production,
      level_eu: dataForModal1.level_eu
    });
    setOpenModal2(true);
    setOpenModal1(false);
  };

  const handleOpenModal3 = (data) => {
    if (!data) return;
    setDataForModal3({
      ...data,
      CookedDateTime: data.CookedDateTime,
      mat: dataForModal2?.mat || data.mat,
      mat_name: dataForModal2?.mat_name || data.mat_name,
      withdraw_date: dataForModal2?.withdraw_date || data.withdraw_date,
      production: dataForModal2?.production || data.production,
      level_eu: dataForModal2?.level_eu || data.level_eu
    });
    setOpenModal3(true);
    setOpenModal2(false);
  };

  const handleOpenEditModal = (data) => {
    if (!data) return;
    setDataForEditModal({
      sap_re_id: data.sap_re_id,
      batch: data.batch,
      material: data.mat,
      withdraw_date: data.withdraw_date,
      hu: data.hu,
      remark: data.remark
    });
    setOpenEditModal(true);
  };

  const handleOpenDeleteModal = (data) => {
    if (!data) return;
    setDataForDeleteModal({
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      rmfp_id: data.rmfp_id,
      withdraw_date: data.withdraw_date,
      level_eu: data.level_eu
    });
    setOpenDeleteModal(true);
  };

  const handleOpenSuccess = (data) => {
    if (!data) return;
    setDataForSuccessModal({
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      rmfp_id: data.rmfp_id,
      level_eu: data.level_eu,
      newBatch: data.newBatch,
      withdraw_date: data.withdraw_date
    });
    setOpenSuccessModal(true);
  };

  const handleEditSuccess = async (updatedData) => {
    setOpenEditModal(false);
    if (!updatedData) return;
    try { await fetchData(); } catch (error) { console.error("Error updating data:", error); }
  };

  return (
    <div>
      <TableMainPrep
        handleOpenModal={handleOpenModal1}
        handleOpenEditModal={handleOpenEditModal}
        handleOpenDeleteModal={handleOpenDeleteModal}
        handleOpenSuccess={handleOpenSuccess}
        handleopenModal1={handleOpenModal1}
        data={tableData}
        selectedDate={selectedDate}             // ✅ ส่งลงไป
        onDateChange={setSelectedDate}          // ✅ callback เปลี่ยนวัน
      />

      {dataForModal1 && (
        <Modal1
          open={openModal1}
          onClose={() => setOpenModal1(false)}
          onNext={handleOpenModal2}
          data={dataForModal1}
          mat={dataForModal1.mat}
          mat_name={dataForModal1.mat_name}
          batch={dataForModal1.batch}
          production={dataForModal1.production}
          rmfp_id={dataForModal1.rmfp_id}
          CookedDateTime={dataForModal1.CookedDateTime}
          dest={dataForModal1.dest}
          rm_type_id={dataForModal1.rm_type_id}
          withdraw_date={dataForModal1.withdraw_date}
          level_eu={dataForModal1.level_eu}
        />
      )}

      {dataForModal2 && (
        <Modal2
          open={openModal2}
          rmfp_id={dataForModal2.rmfp_id}
          CookedDateTime={dataForModal2.CookedDateTime}
          dest={dataForModal2.dest}
          batch={dataForModal2.batch}
          batch_before={dataForModal2.batch_before}
          rm_type_id={dataForModal2.rm_type_id}
          mat_name={dataForModal2.mat_name}
          withdraw_date={dataForModal2.withdraw_date}
          production={dataForModal2.production}
          level_eu={dataForModal2.level_eu}
          onClose={() => { setOpenModal2(false); clearData(); }}
          onNext={handleOpenModal3}
          data={dataForModal2}
          clearData={clearData}
        />
      )}

      {dataForModal3 && (
        <Modal3
          open={openModal3}
          CookedDateTime={dataForModal3.CookedDateTime}
          onClose={() => { setOpenModal3(false); clearData(); }}
          data={dataForModal3}
          mat_name={dataForModal3.mat_name}
          mat={dataForModal3.mat}
          withdraw_date={dataForModal3.withdraw_date}
          production={dataForModal3.production}
          level_eu={dataForModal3.level_eu}
          onEdit={() => { setOpenModal2(true); setOpenModal3(false); }}
          clearData={clearData}
        />
      )}

      {dataForEditModal && (
        <ModalEditPD
          open={openEditModal}
          onClose={() => { setOpenEditModal(false); fetchData(); }}
          data={dataForEditModal}
          material={dataForEditModal.material}
          batch={dataForEditModal.batch}
          sap_re_id={dataForEditModal.sap_re_id}
          withdraw_date={dataForEditModal.withdraw_date}
          hu={dataForEditModal.hu}
          remark={dataForEditModal.remark}
          onSuccess={handleEditSuccess}
        />
      )}

      {dataForSuccessModal && (
        <ModalSuccess
          open={openSuccessModal}
          onClose={() => setOpenSuccessModal(false)}
          mat={dataForSuccessModal.mat}
          mat_name={dataForSuccessModal.mat_name}
          batch={dataForSuccessModal.batch}
          production={dataForSuccessModal.production}
          rmfp_id={dataForSuccessModal.rmfp_id}
          selectedPlans={dataForSuccessModal.selectedPlans}
          level_eu={dataForSuccessModal.level_eu}
          newBatch={dataForSuccessModal.newBatch}
          withdraw_date={dataForSuccessModal.withdraw_date}
          onSuccess={fetchData}
        />
      )}

      {dataForDeleteModal && (
        <ModalDelete
          open={openDeleteModal}
          onClose={() => setOpenDeleteModal(false)}
          mat={dataForDeleteModal.mat}
          mat_name={dataForDeleteModal.mat_name}
          batch={dataForDeleteModal.batch}
          production={dataForDeleteModal.production}
          rmfp_id={dataForDeleteModal.rmfp_id}
          selectedPlans={dataForDeleteModal.selectedPlans}
          withdraw_date={dataForDeleteModal.withdraw_date}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default React.memo(ParentComponent);