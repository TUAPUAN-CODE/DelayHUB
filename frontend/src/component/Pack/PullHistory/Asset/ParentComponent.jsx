import React, { useState, useEffect, useRef, useCallback } from 'react';
import TableMainPrep from './Table';
import PaperPDFViewer from './Table';   
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalInputRM from './ModalInputRM';
import ModalSuccess from './ModalSuccess';
import ModalDelete from './ModalDelete';
import ModalEditLine from './ModalEditLine';
import axios from "axios";
axios.defaults.withCredentials = true;
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

// ── Tab icons ──────────────────────────────────────────────────────
const IconTable = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

const IconPDF = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

// ── Tab bar ────────────────────────────────────────────────────────
const TabBar = ({ activeTab, onChange }) => {
  const tabs = [
    { key: 'table', label: 'ตารางควบคุมเวลา', icon: <IconTable /> },
    { key: 'pdf',   label: 'ประวัติ PDF',      icon: <IconPDF />   },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '12px 24px 0',
      background: 'linear-gradient(135deg, #0F3FC4 0%, #1552F0 100%)',
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 22px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: active ? '700' : '500',
              fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif",
              background: active ? '#fff' : 'rgba(255,255,255,0.15)',
              color: active ? '#0F3FC4' : 'rgba(255,255,255,0.9)',
              transition: 'all 0.2s ease',
              boxShadow: active ? '0 -2px 8px rgba(0,0,0,0.08)' : 'none',
              borderBottom: active ? '2px solid #fff' : 'none',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

// ── Main ParentComponent ───────────────────────────────────────────
const ParentComponent = () => {
  const [activeTab, setActiveTab] = useState('table');   // ← state ของ tab

  const [modals, setModals] = useState({
    modal2: false,
    modal3: false,
    editModal: false,
    ModalInputRM: false,
    editLineModal: false,
    deleteModal: false,
    successModal: false
  });

  const [modalData, setModalData] = useState({
    modal2: null,
    modal3: null,
    editModal: null,
    ModalInputRM: null,
    editLineModal: null,
    deleteModal: null,
    successModal: null
  });

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lineId = localStorage.getItem("line_id");
      const [resLine, resMix] = await Promise.all([
        axios.get(`${API_URL}/api/pack/manage/all/line`, { params: { line_id: lineId } }),
        axios.get(`${API_URL}/api/pack/manage/mixed/all/line`, { params: { line_id: lineId } })
      ]);
      if (!resLine.data.success || !resMix.data.success) throw new Error("Failed to fetch data");

      const mergedData = [...(resLine.data.data || []), ...(resMix.data.data || [])];
      const transformedData = mergedData.map(item => ({
        ...item,
        production: item.code,
        weight_RM: item.weight_RM,
        weight_per_tray: item.weight_in_trolley / (item.tray_count || 1)
      }));
      setTableData(transformedData);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => fetchData(), 300);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    if (!socketRef.current) {
      const newSocket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 1000, autoConnect: true });
      socketRef.current = newSocket;

      const handleDataUpdated = (updatedData) => {
        setTableData(prev => {
          if (updatedData.isMixed && updatedData.groupItems) {
            return prev.map(group => group.mix_code === updatedData.mix_code ? updatedData : group);
          }
          return prev.map(item => item.mapping_id === updatedData.mapping_id ? updatedData : item);
        });
        fetchDataDebounced();
      };

      const handleDataDelete = (deleteData) => {
        setTableData(prev => {
          if (deleteData.isMixed) return prev.filter(group => group.mix_code !== deleteData.mix_code);
          return prev.filter(item => item.mapping_id !== deleteData.mapping_id);
        });
        fetchDataDebounced();
      };

      newSocket.on('dataUpdated', handleDataUpdated);
      newSocket.on('dataDelete', handleDataDelete);
      newSocket.on('connect_error', (err) => console.error('Socket error:', err));

      return () => {
        newSocket.off('dataUpdated', handleDataUpdated);
        newSocket.off('dataDelete', handleDataDelete);
        newSocket.disconnect();
        socketRef.current = null;
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      };
    }
  }, [fetchData, fetchDataDebounced]);

  // ── Modal helpers ──────────────────────────────────────────────
  const openModal  = (name, data = null) => { setModals(p => ({ ...p, [name]: true }));  if (data) setModalData(p => ({ ...p, [name]: data })); };
  const closeModal = (name)              => { setModals(p => ({ ...p, [name]: false })); setModalData(p => ({ ...p, [name]: null })); };

  const handleModalFlow = (cur, next, data = null) => {
    setModals(p => ({ ...p, [cur]: false, [next]: true }));
    if (data) setModalData(p => ({ ...p, [next]: { ...p[cur], ...data } }));
  };

  const hasTroId = (data) => {
    if (data.isMixed) return data.groupItems.every(item => !!item.tro_id);
    return !!data.tro_id;
  };

  const handleOpenModal3        = (data) => handleModalFlow('modal2', 'modal3', data);
  const handleOpenEditModal     = (data) => openModal('editModal',    { ...data, production: data.code, rm_cold_status: data.rm_status, ...(data.come_cold_date && { ComeColdDateTime: data.come_cold_date }), ...(data.out_cold_date && { cold: data.out_cold_date }) });
  const handleOpenModalInputRM  = (data) => openModal('ModalInputRM', { ...data, production: data.code, rm_cold_status: data.rm_status, ...(data.come_cold_date && { ComeColdDateTime: data.come_cold_date }), ...(data.out_cold_date && { cold: data.out_cold_date }) });
  const handleOpenEditLineModal = (data) => openModal('editLineModal', { ...data, mat: data.mat_id || data.mat, batch: data.batch_after || data.batch, rmfp_id: data.rmfp_id, production: data.code, line_name: data.line_name });
  const handleOpenDeleteModal   = (data) => openModal('deleteModal',  { ...data, production: data.code, weight_RM: data.weight_in_trolley || data.weight_per_tro, qccheck: data.qccheck, mdcheck: data.mdcheck, defectcheck: data.defectcheck, WorkAreaCode: data.WorkAreaCode, ...(data.cooked_date && { CookedDateTime: data.cooked_date }), ...(data.withdraw_date && { withdraw_date: data.withdraw_date }) });
  const handleOpenSuccess       = (data) => openModal('successModal', { batch: data.batch_after, mat: data.mat, mat_name: data.mat_name, production: data.code, rmfp_id: data.rmfp_id });

  const handleConfirmRow = async (payload) => {
    try {
      const res = await axios.post(`${API_URL}/api/pack/mixed/delay-time/test`, payload);
      if (res.data.success) fetchData();
    } catch (err) {
      console.error("Confirm error:", err);
      alert("เกิดข้อผิดพลาดในการยืนยันข้อมูล");
    }
  };

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef5350' }}>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={fetchData} style={{ padding: '10px 24px', borderRadius: '10px', background: '#1552F0', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '15px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif" }}>

      {/* ── Tab Bar ── */}
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {/* ── Tab Content ── */}
      {activeTab === 'table' ? (
        <div>
          {loading && (
            <div style={{ padding: '8px 24px', background: '#EAF0FF', color: '#0F3FC4', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid #BBDEFB', borderTop: '2px solid #1552F0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              กำลังโหลดข้อมูล...
            </div>
          )}
          <TableMainPrep
            handleOpenEditModal={handleOpenEditModal}
            handleOpenModalInputRM={handleOpenModalInputRM}
            handleOpenDeleteModal={handleOpenDeleteModal}
            handleOpenEditLineModal={handleOpenEditLineModal}
            handleOpenSuccess={handleOpenSuccess}
            onConfirmRow={handleConfirmRow}
            data={tableData}
            loading={loading}
            checkTroId={hasTroId}
          />
        </div>
      ) : (
        // ── PaperPDFViewer fetch เองทั้งหมด ไม่ต้องส่ง props ──
        <PaperPDFViewer />
      )}

      {/* ── Modals (render เสมอ ไม่ขึ้นกับ tab) ── */}
      <Modal2
        open={modals.modal2}
        onClose={() => closeModal('modal2')}
        onNext={handleOpenModal3}
        data={modalData.modal2}
      />
      <Modal3
        open={modals.modal3}
        onSuccess={fetchData}
        onClose={() => closeModal('modal3')}
        data={modalData.modal3}
        onEdit={() => handleModalFlow('modal3', 'modal2')}
      />
      <ModalEditPD
        open={modals.editModal}
        onClose={() => closeModal('editModal')}
        data={modalData.editModal}
        onSuccess={fetchData}
      />
      <ModalInputRM
        open={modals.ModalInputRM}
        onClose={() => closeModal('ModalInputRM')}
        data={modalData.ModalInputRM}
        onSuccess={fetchData}
      />
      <ModalSuccess
        open={modals.successModal}
        onClose={() => closeModal('successModal')}
        data={modalData.successModal}
        onSuccess={fetchData}
      />
      <ModalEditLine
        open={modals.editLineModal}
        onClose={() => closeModal('editLineModal')}
        data={modalData.editLineModal}
        onSuccess={fetchData}
      />
      <ModalDelete
        open={modals.deleteModal}
        onClose={() => closeModal('deleteModal')}
        data={modalData.deleteModal}
        onSuccess={fetchData}
      />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default ParentComponent;