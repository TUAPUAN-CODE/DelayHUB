// เลือกรถเข็นของ "กลับมาเตรียม": สแกนอย่างเดียว (กล้องสลับได้ / เครื่องสแกน USB); batches = Batch ตั้งต้น/แปลงเดิม ให้กรอก Batch แปลงใหม่ด้วย (ปุ่มใส่รถเข็นของแผนผลิตเหมือนกัน)
import ScanTrolleyModal from "../../../Sheet/Asset/prep/ScanTrolleyModal";

const Modal1 = ({ open, onClose, onNext, mapping_id, batch, tro_id, batches }) => (
  <ScanTrolleyModal open={open} onClose={onClose} batches={batches} onConfirm={(value, batchAfterArray) => onNext({ inputValues: [value], mapping_id, batch, tro_id, batchAfterArray })} />
);

export default Modal1;
