import React, { useState, useEffect, useRef } from 'react';
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
    modal2: false,
    modal3: false,
    editModal: false,
    editLineModal: false,
    deleteModal: false,
    successModal: false
  });

  const [modalData, setModalData] = useState({
    modal2: null,
    modal3: null,
    editModal: null,
    editLineModal: null,
    deleteModal: null,
    successModal: null
  });

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);

  const socketRef = useRef(null);
  const fetchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 3,
        reconnectionDelay: 3000,
        autoConnect: true,
      });

      socketRef.current = newSocket;

      newSocket.on('dataUpdated', (updatedData) => {
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
      });

      newSocket.on('dataDelete', (deleteData) => {
        setTableData(prev => {
          if (deleteData.isMixed) {
            return prev.filter(group => group.mix_code !== deleteData.mix_code);
          }
          return prev.filter(item => item.mapping_id !== deleteData.mapping_id);
        });
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
      });

      return () => {
        newSocket.disconnect();
        socketRef.current = null;
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      };
    }
  }, []);

  const openModal = (modalName, data = null) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
    if (data) {
      setModalData(prev => ({ ...prev, [modalName]: data }));
    }
  };

  const closeModal = (modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
    setModalData(prev => ({ ...prev, [modalName]: null }));
  };

  const handleModalFlow = (currentModal, nextModal, data = null) => {
    setModals(prev => ({
      ...prev,
      [currentModal]: false,
      [nextModal]: true
    }));

    if (data) {
      setModalData(prev => ({
        ...prev,
        [nextModal]: {
          ...prev[currentModal],
          ...data
        }
      }));
    }
  };

  const hasTroId = (data) => {
    if (data.isMixed) {
      return data.groupItems.every(item => !!item.tro_id);
    }
    return !!data.tro_id;
  };

  const handleOpenModal2 = (data) => {};

  const handleOpenModal3 = (data) => {
    handleModalFlow('modal2', 'modal3', data);
  };

  const handleOpenEditModal = (data) => {
    const editData = {
      ...data,
      production: data.code,
      rm_cold_status: data.rm_status,
      ...(data.come_cold_date && { ComeColdDateTime: data.come_cold_date }),
      ...(data.out_cold_date && { cold: data.out_cold_date })
    };
    openModal('editModal', editData);
  };

  const handleOpenEditLineModal = (data) => {
    const editLineData = {
      ...data,
      mat: data.mat_id || data.mat,
      batch: data.batch_after || data.batch,
      rmfp_id: data.rmfp_id,
      production: data.code,
      line_name: data.line_name
    };
    openModal('editLineModal', editLineData);
  };

  const handleOpenDeleteModal = (data) => {
    const deleteData = {
      ...data,
      production: data.code,
      weight_RM: data.weight_in_trolley || data.weight_per_tro,
      qccheck: data.qccheck,
      mdcheck: data.mdcheck,
      defectcheck: data.defectcheck,
      WorkAreaCode: data.WorkAreaCode,
      ...(data.cooked_date && { CookedDateTime: data.cooked_date }),
      ...(data.withdraw_date && { withdraw_date: data.withdraw_date })
    };
    openModal('deleteModal', deleteData);
  };

  const handleOpenSuccess = (data) => {
    openModal('successModal', {
      batch: data.batch_after,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.code,
      rmfp_id: data.rmfp_id
    });
  };

  const handleConfirmRow = async (payload) => {
    try {
      console.log("Confirm payload scp:", payload);
      const res = await axios.post(
        `${API_URL}/api/pack/mixed/delay-time/test`,
        payload
      );
      if (!res.data.success) {
        console.error("Confirm failed:", res.data);
      }
    } catch (error) {
      console.error("Confirm error:", error);
      alert("เกิดข้อผิดพลาดในการยืนยันข้อมูล");
    }
  };

  return (
    <div>
      {loading && <div className="loading-indicator">Loading...</div>}

      <TableMainPrep
        handleOpenEditModal={handleOpenEditModal}
        handleOpenDeleteModal={handleOpenDeleteModal}
        handleOpenEditLineModal={handleOpenEditLineModal}
        handleOpenSuccess={handleOpenSuccess}
        onConfirmRow={handleConfirmRow}
        data={tableData}
        loading={loading}
        checkTroId={hasTroId}
      />

      <Modal2
        open={modals.modal2}
        onClose={() => closeModal('modal2')}
        onNext={handleOpenModal3}
        data={modalData.modal2}
      />

      <Modal3
        open={modals.modal3}
        onSuccess={() => closeModal('modal3')}
        onClose={() => closeModal('modal3')}
        data={modalData.modal3}
        onEdit={() => handleModalFlow('modal3', 'modal2')}
      />

      <ModalEditPD
        open={modals.editModal}
        onClose={() => closeModal('editModal')}
        data={modalData.editModal}
        onSuccess={() => closeModal('editModal')}
      />

      <ModalSuccess
        open={modals.successModal}
        onClose={() => closeModal('successModal')}
        data={modalData.successModal}
        onSuccess={() => closeModal('successModal')}
      />

      <ModalEditLine
        open={modals.editLineModal}
        onClose={() => closeModal('editLineModal')}
        data={modalData.editLineModal}
        onSuccess={() => closeModal('editLineModal')}
      />

      <ModalDelete
        open={modals.deleteModal}
        onClose={() => closeModal('deleteModal')}
        data={modalData.deleteModal}
        onSuccess={() => closeModal('deleteModal')}
      />
    </div>
  );
};

export default ParentComponent;