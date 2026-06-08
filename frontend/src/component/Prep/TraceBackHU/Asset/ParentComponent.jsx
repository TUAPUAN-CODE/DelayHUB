import React, { useState, useEffect, useRef, useCallback } from 'react';
import TableMainPrep from './TableOvenToCold';
import Modal1 from './Modal1';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import axios from "axios";
axios.defaults.withCredentials = true; 
import io from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [openModal1, setOpenModal1] = useState(false);
  const [openModal2, setOpenModal2] = useState(false);
  const [openModal3, setOpenModal3] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [dataForModal1, setDataForModal1] = useState(null);
  const [dataForModal2, setDataForModal2] = useState(null);
  const [dataForModal3, setDataForModal3] = useState(null);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForSuccessModal, setDataForSuccessModal] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [socket, setSocket] = useState(null);
  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // ✅ Define fetchData globally (not inside useEffect)
 const fetchData = useCallback(async () => {
  try {
    const response = await axios.get(`${API_URL}/api/prep/getRMTraceback`, {
      withCredentials: true,
    });

    // ✅ Handle both wrapped and raw array formats
    if (Array.isArray(response.data)) {
      setTableData(response.data);
    } else if (response.data.success && response.data.data) {
      setTableData(response.data.data);
    } else {
      console.error("⚠️ Unexpected API format:", response.data);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}, [API_URL]);


  // ✅ Debounced fetchData
  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300);
  }, [fetchData]);

  // ✅ Socket.IO setup
  useEffect(() => {
    if (!API_URL) {
      console.error("❌ API_URL is not defined.");
      return;
    }

    let isTabActive = true;
    let reconnectTimer = null;
    let reconnectDelay = 2000;
    const MAX_DELAY = 60000;

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (isTabActive && !newSocket?.connected) {
        console.log("🔄 Tab active, trying reconnect...");
        manualReconnect();
      }
    };

    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnection: false,
      autoConnect: false,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    const handleDataUpdate = () => {
      console.log("📡 Data updated event received");
      fetchDataDebounced();
    };

    const manualReconnect = () => {
      if (!newSocket.connected && isTabActive) {
        console.log(`🔁 Reconnecting... wait ${reconnectDelay / 1000}s`);
        newSocket.connect();
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!document.hidden) newSocket.connect();

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      reconnectDelay = 2000;
      fetchDataDebounced();
    });

    newSocket.emit('joinRoom', 'saveRMForProdRoom');
    newSocket.emit('joinRoom', 'trolleyUpdatesRoom');
    newSocket.emit('joinRoom', 'QcCheckRoom');

    newSocket.on('dataUpdated', handleDataUpdate);
    newSocket.on('dataDelete', handleDataUpdate);
    newSocket.on('rawMaterialSaved', handleDataUpdate);
    newSocket.on('trolleyUpdated', handleDataUpdate);

    newSocket.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected:", reason);
      if (isTabActive) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      if (isTabActive) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    });

    newSocket.on("slotUpdated", async (updatedSlot) => {
      console.log("🔄 Slot update received:", updatedSlot);
      await fetchDataDebounced();
    });

    newSocket.on("reservationError", (error) => {
      console.error("❌ Reservation error:", error.message);
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(reconnectTimer);
      if (newSocket) {
        newSocket.off();
        newSocket.disconnect();
      }
    };
  }, [API_URL, fetchDataDebounced]);

  // ✅ Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearData = () => {
    setDataForModal1(null);
    setDataForModal2(null);
    setDataForModal3(null);
  };

  const handleOpenModal1 = (data) => {
    setDataForModal1(data);
    setOpenModal1(true);
  };

  const handleOpenModal2 = (data) => {
    setDataForModal2({
      ...data,
      rmfp_id: dataForModal1?.rmfp_id
    });
    setOpenModal2(true);
    setOpenModal1(false);
  };

  const handleOpenModal3 = (data) => {
    setDataForModal3(data);
    setOpenModal3(true);
    setOpenModal2(false);
  };

  const handleOpenEditModal = (data) => {
    setDataForEditModal({
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      rmfp_id: data.rmfp_id
    });
    setOpenEditModal(true);
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

  return (
    <div>
      <TableMainPrep
        handleOpenModal={handleOpenModal1}
        handleOpenEditModal={handleOpenEditModal}
        handleOpenSuccess={handleOpenSuccess}
        data={tableData}
      />
      <Modal1
        open={openModal1}
        onClose={() => setOpenModal1(false)}
        onNext={handleOpenModal2}
        data={dataForModal1}
      />
      <Modal2
        open={openModal2}
        onClose={() => {
          setOpenModal2(false);
          clearData();
        }}
        onNext={handleOpenModal3}
        data={dataForModal2}
        clearData={clearData}
      />
      <Modal3
        open={openModal3}
        onClose={() => {
          setOpenModal3(false);
          clearData();
        }}
        data={dataForModal3}
        onEdit={() => {
          setOpenModal2(true);
          setOpenModal3(false);
        }}
        clearData={clearData}
      />
      <ModalEditPD
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        onNext={() => setOpenEditModal(false)}
        data={dataForEditModal}
      />
      <ModalSuccess
        open={openSuccessModal}
        onClose={() => setOpenSuccessModal(false)}
        mat={dataForSuccessModal?.mat}
        mat_name={dataForSuccessModal?.mat_name}
        batch={dataForSuccessModal?.batch}
        production={dataForSuccessModal?.production}
        rmfp_id={dataForSuccessModal?.rmfp_id}
        selectedPlans={dataForSuccessModal?.selectedPlans}
      />
    </div>
  );
};

export default ParentComponent;
