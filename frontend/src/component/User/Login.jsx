import { useState, useEffect } from "react";
import { clearUserLocalStorage } from "../../services/localStorageUtil";
import { setToken } from "../../services/authClient";
import { WORKPLACE_ROUTES } from "../../services/roleRoutes";
import axios from "axios";
axios.defaults.withCredentials = true; 
import {
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  InputAdornment,
  CssBaseline,
  Link,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import FloatingLanguageSwitcher from "../Layout/FloatingLanguageSwitcher";
import { useNavigate } from "react-router-dom"; // นำเข้า useNavigate
const API_URL = import.meta.env.VITE_API_URL;

// ช่องกรอกบนการ์ดสีขาว — ใช้ร่วมกันทั้งสองช่อง
const whiteField = {
  "& .MuiInputLabel-root": { color: "#5b6b82" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#1770b8" },
  "& .MuiOutlinedInput-root": {
    color: "#1e3c72",
    borderRadius: "10px",
    background: "#fff",
    "& fieldset": { borderColor: "#c9d6e6" },
    "&:hover fieldset": { borderColor: "#8fb0d6" },
    "&.Mui-focused fieldset": { borderColor: "#1770b8" },
  },
};
const linkSx = { color: "#1770b8", fontWeight: 700 };

// Schema ตรวจสอบข้อมูล
const schema = yup.object().shape({
  user_id: yup.string().required("กรุณากรอกรหัสพนักงาน"),
  password: yup
    .string()
    .min(4, "กรุณากรอกรหัสผ่าน")
    .required("Password is required"),
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    // ล้างข้อมูลทั้งหมดใน localStorage ก่อน เพื่อเคลียร์ข้อมูลของ user ก่อนหน้า
    clearUserLocalStorage(); // ล้างของผู้ใช้เดิม แต่คงค่าประจำเครื่อง (เช่น สวิตช์พิมพ์สลิปอัตโนมัติ) ไว้
  });

  const onSubmit = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/api/login`, data);

    if (response.data && response.data.user) {
      const user = response.data.user;
      console.log("Login Success: user", user.user_id); // ไม่ log response ทั้งก้อน เพราะมี token

      // token ยืนยันตัวตน — authClient ส่งไปกับทุก request หลังจากนี้
      setToken(response.data.token || null);

      // เก็บข้อมูลผู้ใช้ลงใน localStorage
      const userInfo = [
        ["user_id", user.user_id],
        ["first_name", user.first_name],
        ["last_name", user.last_name],
        ["birthday", user.birthday],
        ["leader", user.leader],
        ["pos_id", user.pos_id],
        ["wp_id", user.wp_id],
        ["rm_type_id", user.rm_type_id] // เพิ่ม rm_type_id
      ];

      userInfo.forEach(([key, value]) => localStorage.setItem(key, value));

      // ถ้า rm_type_id เป็น array ให้บันทึกเป็น JSON string
      if (Array.isArray(user.rm_type_id)) {
        localStorage.setItem('rm_type_id', JSON.stringify(user.rm_type_id));
      }

      // ตรวจสอบสถานที่ทำงานของ user และนำทางไปยังหน้าที่เกี่ยวข้อง
      // Role ทั้งหมดของบัญชี (ปุ่มสลับ Role ที่ header ใช้)
      localStorage.setItem("roles", JSON.stringify(Array.isArray(user.roles) ? user.roles : []));
      // สิทธิ์พิเศษรายบัญชี (เช่น manual_trolley = คีย์เลขรถเข็นเองได้) — ตั้งในหน้าการจัดการพนักงาน
      localStorage.setItem("perms", JSON.stringify(Array.isArray(user.permissions) ? user.permissions : []));
      const workplaceRoutes = WORKPLACE_ROUTES;

      workplaceRoutes[user.wp_id]
        ? navigate(workplaceRoutes[user.wp_id], { replace: true })
        : setErrorMessage("ไม่มีสถานที่ทำงานของรหัสพนักงานนี้ !!");
    } else {
      setErrorMessage("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  } catch (error) {
    setErrorMessage(
      error.response?.data?.error || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    );
  }
};

  return (
    <>
    <FloatingLanguageSwitcher />
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: { xs: "center", md: "flex-end" },
        px: { xs: 2, md: 8, lg: 14 },
        overflow: "hidden",
        bgcolor: "#06183c",
      }}
    >
      <CssBaseline />
      {/* วิดีโอพื้นหลัง (public/bg.mp4) — ถ้าโหลดไม่ได้จะแสดงรูป Cat.jpg แทน */}
      <Box
        component="video"
        src="/bg.mp4"
        poster="/Cat.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      <Box
        component="section"
        aria-labelledby="login-title"
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          px: { xs: 3, sm: 4.5 },
          py: { xs: 4.5, sm: 5.5 },
          borderRadius: "24px",
          color: "#1e3c72",
          background: "#fff",
          boxShadow: "0 24px 60px -12px rgba(15,39,64,.35)",
          animation: "pageIn .6s cubic-bezier(.22,1,.36,1) both",
        }}
      >
        <Box sx={{ textAlign: "center", mb: 3.5, mt: 1 }}>
          <Typography id="login-title" variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: ".02em", color: "#1e3c72" }}>
            เข้าสู่ระบบ
          </Typography>
          <Typography variant="body2" sx={{ mt: .75, color: "#5b6b82" }}>
            ยินดีต้อนรับกลับมา กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ
          </Typography>
        </Box>

        {errorMessage && (
          <Typography role="alert" sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 2, fontSize: ".85rem", color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca" }}>
            {errorMessage}
          </Typography>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            fullWidth
            id="user_id"
            label="รหัสพนักงาน"
            variant="outlined"
            margin="normal"
            autoComplete="username"
            {...register("user_id")}
            error={!!errors.user_id}
            helperText={errors.user_id?.message}
            sx={whiteField}
          />
          <TextField
            fullWidth
            id="password"
            label="รหัสผ่าน"
            variant="outlined"
            margin="normal"
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
            error={!!errors.password}
            helperText={errors.password?.message}
            sx={whiteField}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    sx={{ color: "#5b6b82" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            sx={{
              mt: 2.5,
              py: 1.4,
              borderRadius: "12px",
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "none",
              color: "#fff",
              background: "#1770b8",
              boxShadow: "0 8px 18px rgba(23,112,184,.35)",
              "&:hover": { background: "#125f9e", boxShadow: "0 10px 22px rgba(23,112,184,.45)" },
            }}
          >
            เข้าสู่ระบบ
          </Button>
        </form>

        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 2.5, fontSize: ".85rem" }}>
          <Link href="/forgot-password" underline="hover" sx={linkSx}>ลืมรหัสผ่าน?</Link>
          <Typography component="span" sx={{ fontSize: "inherit", color: "#5b6b82" }}>
            ยังไม่มีบัญชี?{" "}
            <Link href="/signup" underline="hover" sx={linkSx}>ลงทะเบียน</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
    </>
  );
};

export default Login;