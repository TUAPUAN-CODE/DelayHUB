import React, { useState, useEffect } from 'react';
import TableMainPrep from './TableMainPrep';
import Modal1 from './Modal1';
import Modal2 from './Modal2';
import Modal3 from './Modal3';
import ModalEditPD from './ModalEditPD';
import ModalSuccess from './ModalSuccess';
import ModalEditRemark from './ModalEditRemark';   
import io from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
    const [modalState, setModalState] = useState({
        modal1: { open: false, data: null },
        modal2: { open: false, data: null },
        modal3: { open: false, data: null },
        editModal: { open: false, data: null },
        successModal: { open: false, data: null },
        editRemarkModal: { open: false, data: null },   // ✅ ใหม่
    });

    const [socket, setSocket] = useState(null);
    const [tableData, setTableData] = useState([]);

    const fetchData = async () => {
        try {
            const response = await fetch(`${API_URL}/api/coldstorages/scan/sap`, {
                credentials: "include",
            });
            const data = await response.json();
            if (Array.isArray(data)) {
                setTableData(data);
            } else if (data.success) {
                setTableData(data.data);
            } else {
                console.error("API Error:", data.message || "Unknown error");
                setTableData([]);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setTableData([]);
        }
    };

    const handleOpenModal = (modal, data) => {
        setModalState(prevState => ({
            ...prevState,
            [modal]: { open: true, data }
        }));
    };

    const handleCloseModal = (modal) => {
        setModalState(prevState => ({
            ...prevState,
            [modal]: { open: false, data: null }
        }));

        // ✅ ปิด successModal หรือ editRemarkModal → fetch ใหม่
        if (modal === "successModal" || modal === "editRemarkModal") {
            fetchData();
        }
    };

    const handleRowClick = (rowData) => {
        console.log("Row clicked:", rowData);
    };

    useEffect(() => {
        const newSocket = io(API_URL, {
            transports: ["websocket"],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            autoConnect: true
        });
        setSocket(newSocket);
        newSocket.emit('joinRoom', 'QcCheckRoom');

        newSocket.on('qcUpdated', (data) => {
            console.log('QC data updated:', data);
            fetchData();
        });

        return () => {
            newSocket.off('qcUpdated');
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div>
            <TableMainPrep
                handleOpenModal={handleOpenModal}
                handleOpenEditRemark={(data) => handleOpenModal('editRemarkModal', data)}   // ✅ ส่ง handler
                handleOpenSuccess={(data) => handleOpenModal('successModal', data)}
                data={tableData}
                handleRowClick={handleRowClick}
            />

            <Modal1
                open={modalState.modal1.open}
                onClose={() => handleCloseModal('modal1')}
                onNext={(data) => handleOpenModal('modal2', data)}
                data={modalState.modal1.data}
            />

            <Modal2
                open={modalState.modal2.open}
                onClose={() => handleCloseModal('modal2')}
                onNext={(data) => handleOpenModal('modal3', data)}
                data={modalState.modal2.data}
            />

            <Modal3
                open={modalState.modal3.open}
                onClose={() => handleCloseModal('modal3')}
                data={modalState.modal3.data}
                onEdit={() => handleOpenModal('modal2', modalState.modal3.data)}
            />

            <ModalEditPD
                open={modalState.editModal.open}
                onClose={() => handleCloseModal('editModal')}
                onNext={(updatedData) => {
                    setModalState(prevState => ({
                        ...prevState,
                        editModal: { open: false, data: updatedData }
                    }));
                }}
                data={modalState.editModal.data}
            />

            <ModalSuccess
                open={modalState.successModal.open}
                onClose={() => handleCloseModal('successModal')}
                mat={modalState.successModal.data?.mat}
                batch={modalState.successModal.data?.batch}
                hu={modalState.successModal.data?.hu}
                sap_re_id={modalState.successModal.data?.sap_re_id}
            />

            {/* ✅ Modal ใหม่: Edit Remark */}
            <ModalEditRemark
                open={modalState.editRemarkModal.open}
                onClose={() => handleCloseModal('editRemarkModal')}
                data={modalState.editRemarkModal.data}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default ParentComponent;