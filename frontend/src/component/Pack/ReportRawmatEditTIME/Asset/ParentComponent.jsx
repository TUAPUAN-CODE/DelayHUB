import React, { useState, useEffect, useRef, useCallback } from 'react';
import TableMainPrep from './Table';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import ModalDelete from './ModalDelete';
import ModalEditLine from './ModalEditLine';
import axios from "axios";
axios.defaults.withCredentials = true;
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [modals, setModals] = useState({
    modal2: false, modal3: false, editModal: false,
    editLineModal: false, deleteModal: false, successModal: false
  });

  const [modalData, setModalData] = useState({
    modal2: null, modal3: null, editModal: null,
    editLineModal: null, deleteModal: null, successModal: null
  });

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ เพิ่ม state สำหรับ dropdown options (ดึงจาก API แยก)
  const [filterOptions, setFilterOptions] = useState({
    lines: [],
    docNos: [],
    scPackDates: [],
    matNames: []
  });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  // ✅ เพิ่ม state สำหรับเก็บค่า filter ที่ใช้ค้นหา
  const [appliedFilters, setAppliedFilters] = useState(null);

  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // ✅ ดึง dropdown options จาก API แยก (เรียกครั้งเดียวตอน mount)
  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const [linesRes, docNosRes, scPackDatesRes, matNamesRes] = await Promise.all([
        axios.get(`${API_URL}/api/pack/get/line`),
        axios.get(`${API_URL}/api/pack/get/doc_no`),
        axios.get(`${API_URL}/api/pack/get/sc_pack_date`),
        axios.get(`${API_URL}/api/pack/get/mat_name`),
      ]);

      // ดึงเฉพาะวันที่ (ไม่เอาเวลา) จาก sc_pack_date และจัดการ shift logic
      const scPackDateSet = new Set();
      (scPackDatesRes.data?.data || []).forEach(row => {
        const packDate = row.sc_pack_date;
        if (!packDate) return;
        const str = String(packDate).replace('T', ' ').split('.')[0];
        const parts = str.split(' ');
        if (parts.length < 2) {
          if (parts[0]) scPackDateSet.add(parts[0]);
          return;
        }
        const datePart = parts[0];
        const [hh, mm] = parts[1].split(':').map(Number);
        const totalMinutes = (hh || 0) * 60 + (mm || 0);
        if (totalMinutes < 360) {
          // ก่อน 06:00 = night shift ของวันก่อนหน้า
          const [y, mo, d] = datePart.split('-').map(Number);
          const prev = new Date(y, mo - 1, d - 1);
          scPackDateSet.add(
            `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
          );
        } else {
          scPackDateSet.add(datePart);
        }
      });

      setFilterOptions({
        lines: [...new Set((linesRes.data?.data || []).map(r => r.line_name).filter(Boolean))].sort(),
        docNos: [...new Set((docNosRes.data?.data || []).map(r => r.doc_no).filter(Boolean))].sort(),
        scPackDates: [...scPackDateSet].sort((a, b) => new Date(a) - new Date(b)),
        matNames: [...new Set((matNamesRes.data?.data || []).map(r => r.mat_name).filter(Boolean))].sort(),
      });
    } catch (err) {
      console.error("Error fetching filter options:", err);
    } finally {
      setFilterOptionsLoading(false);
    }
  }, []);

  // ✅ ดึงข้อมูลตาราง — เรียกเมื่อ user กดปุ่ม "ค้นหา" เท่านั้น
  const fetchData = useCallback(async (filters = null) => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (filters?.lineName) params.line_name = filters.lineName;
      if (filters?.docNo) params.doc_no = filters.docNo;
      if (filters?.scPackDate) params.sc_pack_date = filters.scPackDate;
      if (filters?.matName) params.mat_name = filters.matName;
      if (filters?.shift) params.shift = filters.shift;
      if (filters?.q) params.q = filters.q;

      const response = await axios.get(
        `${API_URL}/api/pack/report/fetchRM/all/line`,
        { params }
      );

      if (!response.data.success) {
        throw new Error("Failed to fetch data");
      }

      const transformedData = response.data.data.map(item => ({
        ...item,
        production: item.doc_no,
        weight_RM: item.weight_RM,
        weight_per_tray: item.weight_in_trolley / (item.tray_count || 1)
      }));

      setTableData(transformedData || []);
      setAppliedFilters(filters);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData(appliedFilters);
    }, 300);
  }, [fetchData, appliedFilters]);

  // ✅ Mount: โหลดเฉพาะ dropdown options — ยังไม่โหลดข้อมูลตาราง
  useEffect(() => {
    fetchFilterOptions();

    if (!socketRef.current) {
      const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true,
      });

      socketRef.current = newSocket;

      const handleDataUpdated = (updatedData) => {
        setTableData(prev => {
          if (updatedData.isMixed && updatedData.groupItems) {
            return prev.map(group =>
              group.mix_code === updatedData.mix_code ? updatedData : group
            );
          }
          return prev.map(item =>
            item.mapping_id === updatedData.mapping_id ? updatedData : item
          );
        });
        fetchDataDebounced();
      };

      const handleDataDelete = (deleteData) => {
        setTableData(prev => {
          if (deleteData.isMixed) {
            return prev.filter(group => group.mix_code !== deleteData.mix_code);
          }
          return prev.filter(item => item.mapping_id !== deleteData.mapping_id);
        });
        fetchDataDebounced();
      };

      const handleConnectError = (err) => {
        console.error('Socket connection error:', err);
      };

      newSocket.on('dataUpdated', handleDataUpdated);
      newSocket.on('dataDelete', handleDataDelete);
      newSocket.on('connect_error', handleConnectError);

      return () => {
        if (socketRef.current) {
          newSocket.off('dataUpdated', handleDataUpdated);
          newSocket.off('dataDelete', handleDataDelete);
          newSocket.off('connect_error', handleConnectError);
          newSocket.disconnect();
          socketRef.current = null;
        }
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      };
    }
  }, [fetchFilterOptions, fetchDataDebounced]);

  const openModal = (modalName, data = null) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
    if (data) setModalData(prev => ({ ...prev, [modalName]: data }));
  };

  const closeModal = (modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
    setModalData(prev => ({ ...prev, [modalName]: null }));
  };

  const handleModalFlow = (currentModal, nextModal, data = null) => {
    setModals(prev => ({ ...prev, [currentModal]: false, [nextModal]: true }));
    if (data) {
      setModalData(prev => ({
        ...prev,
        [nextModal]: { ...prev[currentModal], ...data }
      }));
    }
  };

  const hasTroId = (data) => {
    if (data.isMixed) return data.groupItems.every(item => !!item.tro_id);
    return !!data.tro_id;
  };

  const handleOpenModal2 = (data) => {};
  const handleOpenModal3 = (data) => handleModalFlow('modal2', 'modal3', data);

  const handleOpenEditModal = (data) => {
    openModal('editModal', {
      ...data,
      production: data.doc_no,
      rm_cold_status: data.rm_status,
      ...(data.come_cold_date && { ComeColdDateTime: data.come_cold_date }),
      ...(data.out_cold_date && { cold: data.out_cold_date })
    });
  };

  const handleOpenEditLineModal = (data) => {
    openModal('editLineModal', {
      ...data,
      mat: data.mat_id || data.mat,
      batch: data.batch_after || data.batch,
      rmfp_id: data.rmfp_id,
      production: data.doc_no,
      line_name: data.line_name
    });
  };

  const handleOpenDeleteModal = (data) => {
    openModal('deleteModal', {
      ...data,
      production: data.doc_no,
      weight_RM: data.weight_in_trolley || data.weight_per_tro,
      qccheck: data.qccheck,
      mdcheck: data.mdcheck,
      defectcheck: data.defectcheck,
      WorkAreaCode: data.WorkAreaCode,
      ...(data.cooked_date && { CookedDateTime: data.cooked_date }),
      ...(data.withdraw_date && { withdraw_date: data.withdraw_date })
    });
  };

  const handleOpenSuccess = (data) => {
    openModal('successModal', {
      batch: data.batch_after, mat: data.mat,
      mat_name: data.mat_name, production: data.doc_no, rmfp_id: data.rmfp_id
    });
  };

  const handleConfirmRow = async (payload) => {
    try {
      const res = await axios.post(`${API_URL}/api/pack/mixed/delay-time/test`, payload);
      if (res.data.success) fetchData(appliedFilters);
    } catch (error) {
      console.error("Confirm error:", error);
      alert("เกิดข้อผิดพลาดในการยืนยันข้อมูล");
    }
  };

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={() => fetchData(appliedFilters)}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <TableMainPrep
        handleOpenEditModal={handleOpenEditModal}
        handleOpenDeleteModal={handleOpenDeleteModal}
        handleOpenEditLineModal={handleOpenEditLineModal}
        handleOpenSuccess={handleOpenSuccess}
        onConfirmRow={handleConfirmRow}
        data={tableData}
        loading={loading}
        checkTroId={hasTroId}
        // ✅ ส่ง dropdown options ลงไป
        filterOptions={filterOptions}
        filterOptionsLoading={filterOptionsLoading}
        // ✅ ส่ง fetch function ลงไป — Table จะเรียกเมื่อ user กดปุ่มค้นหา
        onSearch={fetchData}
        hasFetched={appliedFilters !== null}
      />

      <Modal2 open={modals.modal2} onClose={() => closeModal('modal2')} onNext={handleOpenModal3} data={modalData.modal2} />
      <Modal3 open={modals.modal3} onSuccess={() => fetchData(appliedFilters)} onClose={() => closeModal('modal3')} data={modalData.modal3} onEdit={() => handleModalFlow('modal3', 'modal2')} />
      <ModalEditPD open={modals.editModal} onClose={() => closeModal('editModal')} data={modalData.editModal} onSuccess={() => fetchData(appliedFilters)} />
      <ModalSuccess open={modals.successModal} onClose={() => closeModal('successModal')} data={modalData.successModal} onSuccess={() => fetchData(appliedFilters)} />
      <ModalEditLine open={modals.editLineModal} onClose={() => closeModal('editLineModal')} data={modalData.editLineModal} onSuccess={() => fetchData(appliedFilters)} />
      <ModalDelete open={modals.deleteModal} onClose={() => closeModal('deleteModal')} data={modalData.deleteModal} onSuccess={() => fetchData(appliedFilters)} />
    </div>
  );
};

export default ParentComponent;