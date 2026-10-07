import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import CheckoutFlow from "../../../../ColdStorage/RoomTableSupervisor/Asset/flow/CheckoutFlow";
import ModalEditPD from "../../../CheckOut/Asset/ModalEditPD";
import { calculateMaterialDelayTime } from "../../../CheckOut/Asset/delayTime";
import LargeCheckinDialog from "./LargeCheckinDialog";

/** check-in (pick a large cold room) and check-out (quality check + slip + out of the room) for the monitor table. ref: checkin(row) · checkout(row) */
const LargeFlows = forwardRef(function LargeFlows({ onDone }, ref) {
  const [checkinRow, setCheckinRow] = useState(null);
  const [toast, setToast] = useState("");
  const checkoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    checkin: (row) => setCheckinRow(row),
    checkout: (row) => checkoutRef.current?.open(row),
  }));

  return (
    <>
      <LargeCheckinDialog
        open={!!checkinRow}
        row={checkinRow}
        onClose={() => setCheckinRow(null)}
        onDone={(msg) => { setToast(msg); onDone?.(); }}
      />
      <CheckoutFlow ref={checkoutRef} onDone={onDone} apiBase="/api/coldstorages" Modal={ModalEditPD} delayFn={calculateMaterialDelayTime} />
      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </>
  );
});

export default LargeFlows;
