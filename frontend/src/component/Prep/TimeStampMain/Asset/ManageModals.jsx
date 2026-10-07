import React, { forwardRef, useImperativeHandle, useState } from 'react';
import Modal1 from './manage/Modal1';
import Modal2 from './manage/Modal2';
import Modal3 from './manage/Modal3';
import ModalEditPD from './manage/ModalEditPD';
import ModalSuccess from './manage/ModalSuccess';
import ModalDelete from './manage/ModalDelete';
import ModalSlip from './manage/ModalSlip';
import ModalSlip2 from './manage/ModalSlip2';
import ModalSlip3 from './manage/ModalSlip3';
import ModalSlipPrint from './manage/ModalSlipPrint';

/**
 * The dialogs of "จัดการวัตถุดิบ" (trolley / slip / complete / change production plan), moved unchanged out of the old MatManage page.
 * The page opens them through the ref:  ref.current.openCart(rmfpRow) · openSlip · openComplete · openEdit · openDelete
 * `onRefresh` is called after a dialog saved something.
 */
const ManageModals = forwardRef(function ManageModals({ onRefresh }, ref) {
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
  const [openSlipModal, setOpenSlipModal] = useState(false);
  const [dataForSlipModal, setDataForSlipModal] = useState(null);
  const [openSlipModal2, setOpenSlipModal2] = useState(false);
  const [dataForSlipModal2, setDataForSlipModal2] = useState(null);
  const [openSlipModal3, setOpenSlipModal3] = useState(false);
  const [dataForSlipModal3, setDataForSlipModal3] = useState(null);
  const [openSlipPrintModal, setOpenSlipPrintModal] = useState(false);
  const [dataForSlipPrintModal, setDataForSlipPrintModal] = useState(null);

  const clearData = () => {
    setDataForModal1(null);
    setDataForModal2(null);
    setDataForModal3(null);
  };
  
    const handleOpenModal1 = (data) => {
      if (!data) {
        console.error("Data for Modal1 is null");
        return;
      }

      const formattedData = {
        ...data,
        rm_type_id: data.rm_type_id,
        mat: data.mat,
        mat_name: data.mat_name,
        CookedDateTime: data.CookedDateTime,
        batchArray: data.batchArray,
        withdraw_date: data.withdraw_date,
        production: data.production, // ส่งค่า production ไปด้วย
        level_eu: data.level_eu
      };

      setDataForModal1(formattedData);
      setOpenModal1(true);
    };

    const handleOpenModal2 = (data) => {
  if (!data || !dataForModal1) {
    console.error("Data for Modal2 is null or missing required fields");
    return;
  }

  const formattedData = {
    ...data,
    batch: data.batch,
    batchArray: data.batchArray,
    rmfp_id: dataForModal1.rmfp_id,
    CookedDateTime: dataForModal1.CookedDateTime,
    dest: dataForModal1.dest,
    rm_type_id: dataForModal1.rm_type_id,
    mat: dataForModal1.mat,
    mat_name: dataForModal1.mat_name,
    withdraw_date: dataForModal1.withdraw_date,
    production: dataForModal1.production,
    level_eu: dataForModal1.level_eu,

    // ✅ เพิ่มบรรทัดนี้
    batchAfterArray: data.batchAfterArray || [], 
  };

  setDataForModal2(formattedData);
  setOpenModal2(true);
  setOpenModal1(false);
};
//----------------------------------------------------------------------------------
const handleOpenSlipModal = (data) => {
  if (!data) {
    console.error("Data for SlipModal is null");
    return;
  }

  const formattedData = {
    batch: data.batch,
    batchArray: data.batchArray || [],
    rm_type_id: data.rm_type_id,
    mat: data.mat,
    mat_name: data.mat_name,
    production: data.production,
    rmfp_id: data.rmfp_id,
    CookedDateTime: data.CookedDateTime || "",
    withdraw_date: data.withdraw_date || "",
    level_eu: data.level_eu || "",  // ✅ เพิ่มบรรทัดนี้
  };

  setDataForSlipModal(formattedData);
  setOpenSlipModal(true);
};

const handleConfirmSlip = async (batchAfterArray) => {
  console.log("Batch After Array:", batchAfterArray);
  
 try {
    // สร้างข้อมูลสำหรับ ModalSlip2 โดยรวม batchAfterArray เข้าไป
    const updatedData = {
      ...dataForSlipModal, // ข้อมูลจาก ModalSlip
      batchAfterArray: batchAfterArray, // batch ที่เปลี่ยนแล้ว
      CookedDateTime: dataForSlipModal?.CookedDateTime || "",
      level_eu: dataForSlipModal?.level_eu || "",  // ✅ เพิ่มบรรทัดนี้
    };

    console.log("Opening ModalSlip2 with data:", updatedData);
    
    setDataForSlipModal2(updatedData);
    setOpenSlipModal(false); // ปิด ModalSlip
    setOpenSlipModal2(true); // เปิด ModalSlip2
    
  } catch (error) {
    console.error("Error updating batch:", error);
  }
};
//-------------------------------------------------------------------------------------
// 3. แก้ไข function สำหรับ ModalSlip2 เมื่อกดยืนยัน
const handleConfirmSlip2 = async (data) => {
  console.log("Data from ModalSlip2:", data);
  
  try {
    // เตรียมข้อมูลสำหรับ ModalSlip3
    const updatedData = {
      ...data,
      mat_name: dataForSlipModal?.mat_name || data?.mat_name,
      withdraw_date: dataForSlipModal?.withdraw_date || data?.withdraw_date,
      production: dataForSlipModal?.production || data?.production,
      mat: dataForSlipModal?.mat || data?.mat,
      level_eu: dataForSlipModal?.level_eu || data?.level_eu || "",  // ✅ เพิ่มบรรทัดนี้
    };

    console.log("Opening ModalSlip3 with data:", updatedData);
    
    setDataForSlipModal3(updatedData);
    setOpenSlipModal2(false); // ปิด ModalSlip2
    setOpenSlipModal3(true);  // เปิด ModalSlip3
    
  } catch (error) {
    console.error("Error preparing data for ModalSlip3:", error);
  }
};
//---------------------------------------------------------------------------------------
// ✅ เพิ่มฟังก์ชันใหม่สำหรับจัดการหลังกดยืนยันใน ModalSlip3
  const handleConfirmSlip3 = async (data) => {
   console.log("✅ Confirmed from ModalSlip3");
   console.log("📦 Data from ModalSlip3:", data);
   console.log("📦 dataForSlipModal:", dataForSlipModal);
   console.log("📦 dataForSlipModal2:", dataForSlipModal2);
    
    try {
      // ✅ รวมข้อมูลจากทุก state ให้ครบถ้วน
      const completeData = {
        // ข้อมูลจาก ModalSlip3 (data ที่ส่งมา)
        ...data,
        
        // ข้อมูลจาก ModalSlip (รอบแรก)
        mat: data?.mat || dataForSlipModal?.mat,
        mat_name: data?.mat_name || dataForSlipModal?.mat_name,
        production: data?.production || dataForSlipModal?.production,
        withdraw_date: data?.withdraw_date || dataForSlipModal?.withdraw_date,
        level_eu: data?.level_eu || dataForSlipModal?.level_eu,
        CookedDateTime: data?.CookedDateTime || dataForSlipModal?.CookedDateTime,
        rmfp_id: data?.rmfp_id || dataForSlipModal?.rmfp_id,
        rm_type_id: data?.rm_type_id || dataForSlipModal?.rm_type_id,
        
        // ข้อมูล Batch
        batchArray: data?.batchArray || dataForSlipModal?.batchArray || [],
        batchAfterArray: data?.batchAfterArray || dataForSlipModal2?.batchAfterArray || [],
        
        // ข้อมูลจากฟอร์ม input2
        input2: data?.input2 || {},
        
        // เวลาต่างๆ
        cookedDateTimeNew: data?.cookedDateTimeNew,
        preparedDateTimeNew: data?.preparedDateTimeNew,
      };

      console.log("📄 Complete data for print slip:", completeData);
      
      // ✅ ตรวจสอบว่าข้อมูลครบหรือไม่
      if (!completeData.mat_name) {
        console.error("❌ Missing mat_name!");
      }
      if (!completeData.input2?.weightPerCart) {
        console.error("❌ Missing weightPerCart!");
      }
      
      // เก็บข้อมูลสำหรับแสดงในสลิป (✅ เปลี่ยนจาก data เป็น completeData)
      setDataForSlipPrintModal(completeData);
      setOpenSlipModal3(false);
      
      // เปิดสลิปพิมพ์ (✅ ลบ setTimeout ออก - ไม่จำเป็น)
      setOpenSlipPrintModal(true);
      
    } catch (error) {
      console.error("Error showing print slip:", error);
    }
  };
//-------------------------------------------------------------------------------------
    const handleOpenModal3 = (data) => {
      if (!data) {
        console.error("Data for Modal3 is null");
        return;
      }

      if (!data.CookedDateTime) {
        console.warn("CookedDateTime is missing in data for Modal3");
      }

      const formattedData = {
        ...data,
        CookedDateTime: data.CookedDateTime,
        mat: dataForModal2?.mat || data.mat,
        mat_name: dataForModal2?.mat_name || data.mat_name,
        withdraw_date: dataForModal2?.withdraw_date || data.withdraw_date,
        production: dataForModal2?.production || data.production, // ส่งค่า production ไปด้วย
        level_eu: dataForModal2?.level_eu || data.level_eu
      };

      setDataForModal3(formattedData);
      setOpenModal3(true);
      setOpenModal2(false);
    };

    const handleOpenEditModal = (data) => {
      if (!data) {
        console.error("Data for EditModal is null");
        return;
      }

      const formattedData = {
        batch: data.batch,
        batchArray: data.batchArray,
    mat: data.mat, // ต้องส่งค่า mat ไปด้วย
    mat_name: data.mat_name,
    production: data.production,
    mapping_id: data.mapping_id,
    rmfp_id: data.rmfp_id, // ต้องส่งค่า rmfp_id ไปด้วย
    line_name: data.line_name // ต้องส่งค่า line_name ไปด้วย
      };

      setDataForEditModal(formattedData);
      setOpenEditModal(true);
    };

    const handleOpenDeleteModal = (data) => {
      if (!data) {
        console.error("Data for DeleteModal is null");
        return;
      }

      const formattedData = {
        batch: data.batch,
        batchArray: data.batchArray,
        mat: data.mat,
        mat_name: data.mat_name,
        production: data.production,
        rmfp_id: data.rmfp_id,
        withdraw_date: data.withdraw_date,
        level_eu: data.level_eu
      };

      setDataForDeleteModal(formattedData);
      setOpenDeleteModal(true);
    };

    const handleOpenSuccess = (data) => {
      if (!data) {
        console.error("Data for SuccessModal is null");
        return;
      }

      const formattedData = {
        batch: data.batch,
        batchArray: data.batchArray,
        mat: data.mat,
        mat_name: data.mat_name,
        production: data.production,
        rmfp_id: data.rmfp_id,
        level_eu: data.level_eu,
        newBatch: data.newBatch,
        withdraw_date: data.withdraw_date
      };

      setDataForSuccessModal(formattedData);
      setOpenSuccessModal(true);
    };

    const handleEditSuccess = async (updatedData) => {
      setOpenEditModal(false);
      if (!updatedData) {
        console.error("Updated data is null");
        return;
      }
      onRefresh?.();

      // try {
      //   await axios.put(`${API_URL}/api/oven/toCold/updateProduction`, updatedData);
      //   fetchData();
      //   setOpenEditModal(false);
      // } catch (error) {
      //   console.error("Error updating data:", error);
      // }
    };


  useImperativeHandle(ref, () => ({
    openCart: handleOpenModal1,
    openSlip: handleOpenSlipModal,
    openComplete: handleOpenSuccess,
    openEdit: handleOpenEditModal,
    openDelete: handleOpenDeleteModal,
  }));

  return (
    <>
        {dataForModal1 && (
          <Modal1
            open={openModal1}
            onClose={() => setOpenModal1(false)}
            onNext={handleOpenModal2}
            data={dataForModal1}
            mat={dataForModal1.mat}
            mat_name={dataForModal1.mat_name}
            batch={dataForModal1.batch}
            batchArray={dataForModal1.batchArray}
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
            batchArray={dataForModal2.batchArray}
            batch_before={dataForModal2.batch_before}
            batchAfterArray={dataForModal2.batchAfterArray}
            rm_type_id={dataForModal2.rm_type_id}
            mat_name={dataForModal2.mat_name}
            withdraw_date={dataForModal2.withdraw_date}
            production={dataForModal2.production} // ส่งค่า production ไปด้วย
            level_eu={dataForModal2.level_eu}
            onClose={() => {
              setOpenModal2(false);
              clearData();
            }}
            onNext={handleOpenModal3}
            data={dataForModal2}
            clearData={clearData}
          />
        )}

        {dataForModal3 && (
          <Modal3
            open={openModal3}
            CookedDateTime={dataForModal3.CookedDateTime}
            onClose={() => {
              setOpenModal3(false);
              clearData();
            }}
            data={dataForModal3}
            mat_name={dataForModal3.mat_name}
            mat={dataForModal3.mat} // ส่งค่า mat ไปด้วย
            withdraw_date={dataForModal3.withdraw_date}
            production={dataForModal3.production}
            level_eu={dataForModal3.level_eu}
            onEdit={() => {
              setOpenModal2(true);
              setOpenModal3(false);
            }}
            clearData={clearData}
          />
        )}

        {dataForEditModal && (
          <ModalEditPD
            open={openEditModal}
            onClose={() => setOpenEditModal(false)}
            data={dataForEditModal}
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
            batchArray={dataForSuccessModal.batchArray}
            production={dataForSuccessModal.production}
            rmfp_id={dataForSuccessModal.rmfp_id}
            selectedPlans={dataForSuccessModal.selectedPlans}
            level_eu={dataForSuccessModal.level_eu}
            newBatch={dataForSuccessModal.newBatch}
            withdraw_date={dataForSuccessModal.withdraw_date}
            onSuccess={onRefresh}
          />
        )}

        {dataForDeleteModal && (
          <ModalDelete
            open={openDeleteModal}
            onClose={() => setOpenDeleteModal(false)}
            mat={dataForDeleteModal.mat}
            mat_name={dataForDeleteModal.mat_name}
            batch={dataForDeleteModal.batch}
            batchArray={dataForDeleteModal.batchArray}
            production={dataForDeleteModal.production}
            rmfp_id={dataForDeleteModal.rmfp_id}
            selectedPlans={dataForDeleteModal.selectedPlans}
            withdraw_date={dataForDeleteModal.withdraw_date}
            onSuccess={onRefresh}
          />
        )}
        {dataForSlipModal && (
         <ModalSlip
           open={openSlipModal}
           onClose={() => setOpenSlipModal(false)}
           onConfirm={handleConfirmSlip}
           oldBatch={dataForSlipModal.batch || ""}
           batchArray={dataForSlipModal.batchArray || []}
           rm_type_id={dataForSlipModal.rm_type_id || 3}
         />
        )}

        {dataForSlipModal2 && (
         <ModalSlip2
           open={openSlipModal2}
           onClose={() => setOpenSlipModal2(false)}
           onNext={handleConfirmSlip2}
           data={dataForSlipModal2}
           CookedDateTime={dataForSlipModal2?.CookedDateTime || ""}
           batchAfterArray={dataForSlipModal2?.batchAfterArray || []}
           batchArray={dataForSlipModal2?.batchArray || []}
           rm_type_id={dataForSlipModal2?.rm_type_id || 3}
          />
          )}

          {dataForSlipModal3 && (
          <ModalSlip3
           open={openSlipModal3}
           onClose={() => setOpenSlipModal3(false)}
           onConfirm={handleConfirmSlip3}  
           data={dataForSlipModal3}
           mat_name={dataForSlipModal3?.mat_name}
           withdraw_date={dataForSlipModal3?.withdraw_date}
           production={dataForSlipModal3?.production}
           mat={dataForSlipModal3?.mat}
           onEdit={() => {
           setOpenSlipModal2(true);
           setOpenSlipModal3(false);
          }}
        />
        )}
        
        {dataForSlipPrintModal && (
        <ModalSlipPrint
          open={openSlipPrintModal}
          onClose={() => {
            setOpenSlipPrintModal(false);
            setDataForSlipPrintModal(null);
          }}
          data={dataForSlipPrintModal}
        />
      )}
    </>
  );
});

export default ManageModals;
