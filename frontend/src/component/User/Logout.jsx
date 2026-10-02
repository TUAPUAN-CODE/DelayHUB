import React, { useEffect } from "react";
import { clearUserLocalStorage } from "../../services/localStorageUtil";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // ล้างข้อมูลทั้งหมดใน localStorage
    clearUserLocalStorage(); // ล้างของผู้ใช้เดิม แต่คงค่าประจำเครื่อง (เช่น สวิตช์พิมพ์สลิปอัตโนมัติ) ไว้
    // นำทางกลับไปหน้า login
    navigate("/login");
  }, [navigate]);

  return null;
};

export default Logout;
