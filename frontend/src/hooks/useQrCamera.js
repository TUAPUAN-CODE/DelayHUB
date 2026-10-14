import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

/**
 * เปิดกล้องสแกน QR ใส่ <video> ที่ videoRef
 * - เปิด "กล้องหลัง" (environment) เป็นค่าเริ่มต้นเสมอ
 * - switchCamera() สลับระหว่างกล้องหลัง/กล้องหน้า
 * - onDecode(text) ได้รับข้อความจาก QR/Barcode (ไม่ว่า qr-scanner จะส่งมาเป็น string หรือ object)
 */
const useQrCamera = (videoRef, onDecode) => {
  const scannerRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  const [facing, setFacing] = useState("environment");
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const stop = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    // โมดัลจะ mount <video> หลังเปิด: รอจนกว่า element จะพร้อม (สูงสุดประมาณ 1 วินาที)
    for (let i = 0; i < 20 && !videoRef.current; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!videoRef.current) {
      setCameraError("เปิดกล้องไม่ได้ (ไม่พบพื้นที่แสดงกล้อง)");
      return false;
    }
    stop();
    setCameraError("");
    setFacing("environment");

    const scanner = new QrScanner(
      videoRef.current,
      (result) => onDecodeRef.current?.(result?.data ?? result),
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      }
    );
    scannerRef.current = scanner;

    try {
      await scanner.start();
      // บนเครื่องที่ไม่มีกล้องหลัง เบราว์เซอร์จะใช้กล้องหน้าแทน ให้แจ้งผู้ใช้
      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      const reported = track?.getSettings?.().facingMode;
      if (reported === "user") {
        setCameraError("ไม่พบกล้องหลังบนอุปกรณ์นี้ กำลังใช้กล้องหน้า");
      }
      return true;
    } catch (err) {
      console.error("[useQrCamera] camera error:", err);
      setCameraError("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือใช้เครื่องสแกน/พิมพ์แทน");
      stop();
      return false;
    }
  }, [videoRef, stop]);

  const switchCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = facing === "environment" ? "user" : "environment";
    try {
      await scanner.setCamera(next);
      setFacing(next);
      setCameraError("");
    } catch (err) {
      console.error("[useQrCamera] switch error:", err);
      setCameraError("สลับกล้องไม่ได้");
    }
  }, [facing]);

  useEffect(() => stop, [stop]);

  return { start, stop, switchCamera, facing, cameraError };
};

export default useQrCamera;
