import { Box, Typography } from "@mui/material";
import "./HamsterLoader.css";

// หน้าโหลดของตาราง (ตอนเข้าครั้งแรก / รีเฟรช ระหว่างที่ยังไม่มีข้อมูล)
const HamsterLoader = ({ text = "กำลังโหลดข้อมูล..." }) => (
  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
    <div aria-label="กำลังโหลดข้อมูล" role="img" className="wheel-and-hamster">
      <div className="wheel" />
      <div className="hamster">
        <div className="hamster__body">
          <div className="hamster__head">
            <div className="hamster__ear" />
            <div className="hamster__eye" />
            <div className="hamster__nose" />
          </div>
          <div className="hamster__limb hamster__limb--fr" />
          <div className="hamster__limb hamster__limb--fl" />
          <div className="hamster__limb hamster__limb--br" />
          <div className="hamster__limb hamster__limb--bl" />
          <div className="hamster__tail" />
        </div>
      </div>
      <div className="spoke" />
    </div>
    <Typography sx={{ color: "#5B6B8C", fontWeight: 600 }}>{text}</Typography>
  </Box>
);

export default HamsterLoader;
