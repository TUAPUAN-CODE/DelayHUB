import { useEffect, useState, useSyncExternalStore } from "react";
import LinearProgress from "@mui/material/LinearProgress";
import { getPendingMutations, subscribeMutations } from "../../services/mutationProgress";

const SHOW_AFTER_MS = 300; // การบันทึกที่เร็วกว่านี้ไม่ต้องกะพริบแถบ

/** แถบบางๆ ด้านบนจอ ขึ้นเมื่อมีการบันทึกข้อมูลค้างอยู่เกิน 0.3 วินาที (ไม่บังและไม่รับการคลิก) */
const MutationProgressBar = () => {
  const pending = useSyncExternalStore(subscribeMutations, getPendingMutations, getPendingMutations);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pending === 0) { setShow(false); return undefined; }
    const t = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [pending]);

  if (!show) return null;
  return (
    <LinearProgress
      aria-label="กำลังบันทึกข้อมูล"
      sx={{ position: "fixed", top: 0, left: 0, right: 0, height: 4, zIndex: 20000, pointerEvents: "none" }}
    />
  );
};

export default MutationProgressBar;
