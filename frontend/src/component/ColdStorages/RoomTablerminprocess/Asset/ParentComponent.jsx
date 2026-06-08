import React, { useState, useEffect } from 'react';
import TableMainPrep from './TableOvenToCold';
import axios from "axios";
axios.defaults.withCredentials = true;
import ModalEditPD from './ModalEditPD';
import ModalDelete from './ModalDelete';
const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForDeleteModal, setDataForDeleteModal] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/coldstorages/incold/fetchSlotRawMat`);
      const raw = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setTableData(raw);
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  // เรียกใช้ฟังก์ชันดึงข้อมูลเมื่อ component โหลด
  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (data) => {};
  const handleRowClick = (rowId) => {};

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

  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 150px)' }}>
          <p style={{ color: '#787878', fontSize: '16px' }}>กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <TableMainPrep
          handleOpenModal={handleOpenModal}
          handleOpenEditModal={handleOpenEditModal}
          handleOpenDeleteModal={handleOpenDeleteModal}
          data={tableData}
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

      {/* ✅ ModalDelete */}
      <ModalDelete
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