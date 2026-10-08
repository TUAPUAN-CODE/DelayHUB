import { forwardRef } from "react";
import MixFlows from "./MixFlows";
// each old page has its own copy of the modals (their save endpoints differ), so each variant imports its own set
import EmCamera from "../../../Prep/Emulsion/Asset/ModalScanSAP";
import EmReview from "../../../Prep/Emulsion/Asset/ModalConfirmSAP";
import EmM1 from "../../../Prep/Emulsion/Asset/Modal1";
import EmM2 from "../../../Prep/Emulsion/Asset/Modal2";
import EmM3 from "../../../Prep/Emulsion/Asset/Modal3";
import EmM4 from "../../../Prep/Emulsion/Asset/Modal4";
import EmEdit from "../../../Prep/Emulsion/Asset/ModalEditPD";
import EmSuccess from "../../../Prep/Emulsion/Asset/ModalSuccess";
import EmDelete from "../../../Prep/Emulsion/Asset/ModalDelete";
import BaCamera from "../../../Prep/BatchMIX/Asset/ModalScanSAP";
import BaReview from "../../../Prep/BatchMIX/Asset/ModalConfirmSAP";
import BaM1 from "../../../Prep/BatchMIX/Asset/Modal1";
import BaM2 from "../../../Prep/BatchMIX/Asset/Modal2";
import BaM3 from "../../../Prep/BatchMIX/Asset/Modal3";
import BaM4 from "../../../Prep/BatchMIX/Asset/Modal4";
import BaEdit from "../../../Prep/BatchMIX/Asset/ModalEditPD";
import BaSuccess from "../../../Prep/BatchMIX/Asset/ModalSuccess";
import BaDelete from "../../../Prep/BatchMIX/Asset/ModalDelete";
import MpCamera from "../../../Prep/IncludeRawmat/Asset/ModalScanSAP";
import MpReview from "../../../Prep/IncludeRawmat/Asset/ModalConfirmSAP";
import MpM1 from "../../../Prep/IncludeRawmat/Asset/Modal1";
import MpM2 from "../../../Prep/IncludeRawmat/Asset/Modal2";
import MpM3 from "../../../Prep/IncludeRawmat/Asset/Modal3";
import MpM4 from "../../../Prep/IncludeRawmat/Asset/Modal4";
import MpEdit from "../../../Prep/IncludeRawmat/Asset/ModalEditPD";
import MpSuccess from "../../../Prep/IncludeRawmat/Asset/ModalSuccess";
import MpDelete from "../../../Prep/IncludeRawmat/Asset/ModalDelete";
import LfCamera from "../../../Prep/IncludeRawmatOtherPlant/Asset/ModalScanSAP";
import LfReview from "../../../Prep/IncludeRawmatOtherPlant/Asset/ModalConfirmSAP";
import LfM1 from "../../../Prep/IncludeRawmatOtherPlant/Asset/Modal1";
import LfM2 from "../../../Prep/IncludeRawmatOtherPlant/Asset/Modal2";
import LfM3 from "../../../Prep/IncludeRawmatOtherPlant/Asset/Modal3";
import LfM4 from "../../../Prep/IncludeRawmatOtherPlant/Asset/Modal4";
import LfEdit from "../../../Prep/IncludeRawmatOtherPlant/Asset/ModalEditPD";
import LfSuccess from "../../../Prep/IncludeRawmatOtherPlant/Asset/ModalSuccess";
import LfDelete from "../../../Prep/IncludeRawmatOtherPlant/Asset/ModalDelete";

const mk = (modals, idField) => {
  const V = forwardRef((props, ref) => <MixFlows ref={ref} modals={modals} idField={idField} {...props} />);
  V.displayName = `MixFlows(${idField})`;
  return V;
};

export const EmulsionFlows = mk({ Modal1: EmM1, Modal2: EmM2, Modal3: EmM3, Modal4: EmM4, ModalEditPD: EmEdit, ModalSuccess: EmSuccess, ModalDelete: EmDelete, CameraActivationModal: EmCamera, DataReviewSAP: EmReview }, "rmfemu_id");
export const BatchFlows = mk({ Modal1: BaM1, Modal2: BaM2, Modal3: BaM3, Modal4: BaM4, ModalEditPD: BaEdit, ModalSuccess: BaSuccess, ModalDelete: BaDelete, CameraActivationModal: BaCamera, DataReviewSAP: BaReview }, "rmfbatch_id");
export const MixPackFlows = mk({ Modal1: MpM1, Modal2: MpM2, Modal3: MpM3, Modal4: MpM4, ModalEditPD: MpEdit, ModalSuccess: MpSuccess, ModalDelete: MpDelete, CameraActivationModal: MpCamera, DataReviewSAP: MpReview }, "mixtp_id");
export const LoafFlows = mk({ Modal1: LfM1, Modal2: LfM2, Modal3: LfM3, Modal4: LfM4, ModalEditPD: LfEdit, ModalSuccess: LfSuccess, ModalDelete: LfDelete, CameraActivationModal: LfCamera, DataReviewSAP: LfReview }, "mixtp_id");

/** the four mixing lists: endpoint (rows of the old page's table), id field and labels */
export const MIX_KINDS = {
  emu: { label: "ผสมวัตถุดิบ", status: "รอผสม (ผสมวัตถุดิบ)", url: "/api/prep/getRMForEmuList", idField: "rmfemu_id" },
  batch: { label: "ผสม Batch", status: "รอผสม (Batch)", url: "/api/prep/getRMMixBatch", idField: "rmfbatch_id" },
  pack: { label: "ผสมเตรียม", status: "รอผสม (ผสมเตรียม)", url: "/api/prep/getMixToPack", idField: "mixtp_id" },
  loaf: { label: "ผสม loaf สุก", status: "รอผสม (loaf สุก)", url: "/api/prep/getMixToPack/loaf", idField: "mapping_id" },
};
