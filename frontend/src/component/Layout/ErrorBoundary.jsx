import { Component } from "react";
import { Box, Button, Typography } from "@mui/material";

/**
 * กันหน้าขาวทั้งระบบ: ถ้า component ใด throw ตอน render (หรือโหลด chunk หลัง deploy ไม่สำเร็จ) จะแสดงข้อความ + ปุ่มลองใหม่แทน
 * `resetKey` เปลี่ยน (เช่น เปลี่ยนหน้า) = ล้าง error อัตโนมัติ
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 1.5, p: 3, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>หน้านี้แสดงผลไม่สำเร็จ</Typography>
        <Typography variant="body2" color="text.secondary">
          ข้อมูลที่บันทึกไว้แล้วไม่เสียหาย · ลองโหลดใหม่ หากยังเป็นอยู่ให้แจ้งทีมพัฒนา พร้อมข้อความ: {String(this.state.error?.message || this.state.error)}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" onClick={() => this.setState({ error: null })}>ลองใหม่</Button>
          <Button variant="contained" onClick={() => window.location.reload()}>โหลดหน้าใหม่</Button>
        </Box>
      </Box>
    );
  }
}

export default ErrorBoundary;
