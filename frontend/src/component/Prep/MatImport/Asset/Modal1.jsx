// เลือกรถเข็นของ "กลับมาเตรียม": สแกนอย่างเดียว (กล้องสลับได้ / เครื่องสแกน) — ดู Sheet/Asset/prep/ScanTrolleyModal.jsx
import ScanTrolleyModal from "../../../Sheet/Asset/prep/ScanTrolleyModal";

const Modal1 = ({ open, onClose, onNext, mapping_id, batch, tro_id }) => (
  <ScanTrolleyModal open={open} onClose={onClose} onConfirm={(value) => onNext({ inputValues: [value], mapping_id, batch, tro_id })} />
);

export default Modal1;
