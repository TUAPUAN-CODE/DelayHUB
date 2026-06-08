import React, { useState, useEffect, useRef, useCallback } from 'react';
import TableMainPrep from './TableOvenToCold';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import axios from "axios";
import io from 'socket.io-client';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForSuccessModal, setDataForSuccessModal] = useState(null);
  const [tableData, setTableData] = useState({
    trolleys: [],
    summary: {
      totalEmpty: 0,
      totalOccupied: 0,
      totalTrolleys: 0
    }
  });
  
  const fetchTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // Parse rmTypeId from localStorage once on mount
  const [rmTypeId, setRmTypeId] = useState(() => {
    const rmTypeIdRaw = localStorage.getItem("rm_type_id");
    if (!rmTypeIdRaw) return [];
    
    try {
      // Handle both comma-separated string and JSON array
      if (rmTypeIdRaw.startsWith('[')) {
        return JSON.parse(rmTypeIdRaw);
      }
      return rmTypeIdRaw.split(',').map(id => id.trim()).filter(Boolean);
    } catch (error) {
      console.error("Error parsing rm_type_id:", error);
      return [];
    }
  });

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (rmTypeId.length === 0) return;

    try {
      const rmTypeParam = rmTypeId.join(",");
      const response = await axios.get(
        `${API_URL}/api/prep/EditDataTrolley/fetchAllTrolleys?rm_type_id=${rmTypeParam}`
      );

      setTableData(response.data.success ? response.data.data : {
        trolleys: [],
        summary: { totalEmpty: 0, totalOccupied: 0, totalTrolleys: 0 }
      });
    } catch (error) {
      console.error("Error fetching trolley data:", error);
      setTableData({
        trolleys: [],
        summary: { totalEmpty: 0, totalOccupied: 0, totalTrolleys: 0 }
      });
    }
  }, [rmTypeId]);

  // Debounced fetchData
  const fetchDataDebounced = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300);
  }, [fetchData]);

  // Initialize socket connection and fetch data
  useEffect(() => {
    // Wait for rmTypeId to be loaded
    if (rmTypeId.length === 0) return;

    // Initialize socket connection only once
    if (!socketRef.current) {
      const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true
      });

      socketRef.current = newSocket;

      const handleDataUpdate = () => {
        console.log("Data updated event received");
        fetchDataDebounced();
      };

      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('joinRoom', 'trolleyUpdateRoom');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      newSocket.on('trolleyUpdated', handleDataUpdate);
      newSocket.on('trolleyStatusChanged', handleDataUpdate);

      // Initial data fetch
      fetchData();
    }

    return () => {
      // Cleanup when component unmounts
      if (socketRef.current) {
        socketRef.current.off('trolleyUpdated');
        socketRef.current.off('trolleyStatusChanged');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [rmTypeId, fetchData, fetchDataDebounced]);

  // Modal handlers
  const handleOpenEditModal = (data) => {
    setDataForEditModal({
      mapping_id: data.mapping_id,
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      line_name: data.line_name,
      weight_RM: data.weight_RM || 0,
      trolley_number: data.trolley_number,
      tro_id: data.tro_id
    });
    setOpenEditModal(true);
  };

  const handleOpenSuccess = (data) => {
    setDataForSuccessModal({
      mapping_id: data.mapping_id,
      batch: data.batch,
      mat: data.mat,
      mat_name: data.mat_name,
      production: data.production,
      line_name: data.line_name,
      weight_RM: data.weight_RM || 0,
      trolley_number: data.trolley_number,
      tro_id: data.tro_id
    });
    setOpenSuccessModal(true);
  };

  const handleCloseEditModal = () => {
    setOpenEditModal(false);
    setDataForEditModal(null);
  };

  const handleCloseSuccessModal = () => {
    setOpenSuccessModal(false);
    setDataForSuccessModal(null);
  };

  return (
    <div>
      <TableMainPrep
        handleOpenEditModal={handleOpenEditModal}
        handleOpenSuccess={handleOpenSuccess}
        data={tableData}
      />
      
      <ModalEditPD
        open={openEditModal}
        onClose={handleCloseEditModal}
        onNext={handleCloseEditModal}
        data={dataForEditModal}
        onSuccess={fetchData}
      />
      
      <ModalSuccess
        open={openSuccessModal}
        onClose={handleCloseSuccessModal}
        mat={dataForSuccessModal?.mat}
        mat_name={dataForSuccessModal?.mat_name}
        batch={dataForSuccessModal?.batch}
        production={dataForSuccessModal?.production}
        line_name={dataForSuccessModal?.line_name}
        weight_RM={dataForSuccessModal?.weight_RM}
        trolley_number={dataForSuccessModal?.trolley_number}
        tro_id={dataForSuccessModal?.tro_id}
        mapping_id={dataForSuccessModal?.mapping_id}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default ParentComponent;