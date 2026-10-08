import { forwardRef, useCallback, useImperativeHandle, useState } from "react";

// The four mixing pages of Prep (ผสมวัตถุดิบ / ผสม Batch / ผสมเตรียม / ผสม loaf สุก) had the same screens and differed only in
// their modals' endpoints and the id field of a list row. This component is that screen flow without the table:
//   add()       -> Modal4 (pick the materials) -> scan SAP label -> review & save
//   cart(row)   -> Modal1 -> Modal2 -> Modal3   (put the mixed material in a trolley)
//   success(row), remove(row), edit(row)
const MixFlows = forwardRef(({ modals, idField, onDone }, ref) => {
  const { Modal1, Modal2, Modal3, Modal4, ModalEditPD, ModalSuccess, ModalDelete, CameraActivationModal, DataReviewSAP } = modals;
  const [m1, setM1] = useState(null);
  const [m2, setM2] = useState(null);
  const [m3, setM3] = useState(null);
  const [open4, setOpen4] = useState(false);
  const [edit, setEdit] = useState(null);
  const [success, setSuccess] = useState(null);
  const [del, setDel] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [primaryBatch, setPrimaryBatch] = useState("");
  const [secondaryBatch, setSecondaryBatch] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [weightTotal, setWeightTotal] = useState("");

  const clear = useCallback(() => { setM1(null); setM2(null); setM3(null); }, []);

  useImperativeHandle(ref, () => ({
    add: (ids) => setOpen4(ids && ids.length ? ids : true),
    cart: (row) => setM1({ ...row, rm_type_id: row.rm_type_id, CookedDateTime: row.CookedDateTime, withdraw_date: row.withdraw_date, production: row.production, level_eu: row.level_eu }),
    success: (row) => setSuccess({ batch: row.batch, mat: row.mat, mat_name: row.mat_name, production: row.production, rmfp_id: row.rmfp_id, level_eu: row.level_eu, newBatch: row.newBatch, withdraw_date: row.withdraw_date }),
    remove: (row) => setDel({ batch: row.batch, mat: row.mat, mat_name: row.mat_name, production: row.production, [idField]: row[idField], withdraw_date: row.withdraw_date, level_eu: row.level_eu }),
    edit: (row) => setEdit({ sap_re_id: row.sap_re_id, batch: row.batch, material: row.mat, withdraw_date: row.withdraw_date }),
  }));

  const toModal2 = (data) => {
    if (!data || !m1) return;
    setM2({
      ...data, batch: data.batch, rmfp_id: m1.rmfp_id, CookedDateTime: m1.CookedDateTime, dest: m1.dest, rm_type_id: m1.rm_type_id,
      mat: m1.mat, mat_name: m1.mat_name, withdraw_date: m1.withdraw_date, production: m1.production, level_eu: m1.level_eu,
    });
    setM1((v) => v && { ...v, __closed: true });
  };
  const toModal3 = (data) => {
    if (!data) return;
    setM3({
      ...data, CookedDateTime: data.CookedDateTime, mat: m2?.mat || data.mat, mat_name: m2?.mat_name || data.mat_name,
      withdraw_date: m2?.withdraw_date || data.withdraw_date, production: m2?.production || data.production, level_eu: m2?.level_eu || data.level_eu,
    });
    setM2(null);
  };

  const afterCamera = ({ primaryBatch: pb, secondaryBatch: sb, weightTotal: wt, selectedMaterials: sm, hu }) => {
    setPrimaryBatch(pb); setSecondaryBatch(sb); setWeightTotal(wt); setSelectedMaterials(sm);
    setReview({ material: pb, batch: sb, emulsionweightTotal: wt, hu, selectedMaterials: sm });
    setCameraOpen(false);
  };

  return (
    <>
      <CameraActivationModal
        open={cameraOpen} onClose={() => setCameraOpen(false)} onConfirm={afterCamera}
        primaryBatch={primaryBatch} secondaryBatch={secondaryBatch} setPrimaryBatch={setPrimaryBatch} setSecondaryBatch={setSecondaryBatch}
        selectedMaterials={selectedMaterials} weightTotal={weightTotal}
      />
      <DataReviewSAP open={!!review} onClose={() => { setReview(null); onDone?.(); }} {...review} />

      {m1 && (
        <Modal1
          open={!m1.__closed} onClose={() => setM1(null)} onNext={toModal2} data={m1}
          mat={m1.mat} mat_name={m1.mat_name} batch={m1.batch} production={m1.production} rmfp_id={m1.rmfp_id} CookedDateTime={m1.CookedDateTime}
          dest={m1.dest} rm_type_id={m1.rm_type_id} withdraw_date={m1.withdraw_date} level_eu={m1.level_eu}
        />
      )}
      {m2 && (
        <Modal2
          open rmfp_id={m2.rmfp_id} CookedDateTime={m2.CookedDateTime} dest={m2.dest} batch={m2.batch} batch_before={m2.batch_before} rm_type_id={m2.rm_type_id}
          mat_name={m2.mat_name} withdraw_date={m2.withdraw_date} production={m2.production} level_eu={m2.level_eu}
          onClose={() => clear()} onNext={toModal3} data={m2} clearData={clear}
        />
      )}
      {m3 && (
        <Modal3
          open CookedDateTime={m3.CookedDateTime} onClose={() => { clear(); onDone?.(); }} data={m3} mat_name={m3.mat_name} mat={m3.mat}
          withdraw_date={m3.withdraw_date} production={m3.production} level_eu={m3.level_eu}
          onEdit={() => { setM2(m3); setM3(null); }} clearData={clear}
        />
      )}
      {open4 && (
        <Modal4
          open onlyIds={Array.isArray(open4) ? open4 : null}
          onClose={(d) => {
            if (d && d.selectedMaterials?.length > 0) { setSelectedMaterials(d.selectedMaterials); setWeightTotal(d.totalWeight || 0); }
            setOpen4(false);
            setCameraOpen(true);
          }}
          onSuccess={onDone}
        />
      )}
      {edit && <ModalEditPD open onClose={() => setEdit(null)} data={edit} material={edit.material} batch={edit.batch} sap_re_id={edit.sap_re_id} withdraw_date={edit.withdraw_date} onSuccess={() => { setEdit(null); onDone?.(); }} />}
      {success && (
        <ModalSuccess
          open onClose={() => setSuccess(null)} mat={success.mat} mat_name={success.mat_name} batch={success.batch} production={success.production}
          rmfp_id={success.rmfp_id} level_eu={success.level_eu} newBatch={success.newBatch} withdraw_date={success.withdraw_date} onSuccess={onDone}
        />
      )}
      {del && (
        <ModalDelete
          open onClose={() => setDel(null)} mat={del.mat} mat_name={del.mat_name} batch={del.batch} production={del.production}
          {...{ [idField]: del[idField] }} withdraw_date={del.withdraw_date} onSuccess={onDone}
        />
      )}
    </>
  );
});
MixFlows.displayName = "MixFlows";

export default MixFlows;
