import React, { useCallback, useMemo, useRef, useState } from 'react';
import TimeStampTable from './Table';
import ManageModals from './ManageModals';
import ModalStampReceive from './stamp/ModalStampReceive';
import ModalStampBoil from './stamp/ModalStampBoil';
import ModalStampReturn from './stamp/ModalStampReturn';
import { useTimeStampData } from './useTimeStampData';

const STAMP_MODALS = { receive: ModalStampReceive, boil: ModalStampBoil, return: ModalStampReturn };

const ParentComponent = () => {
  const { date, setDate, rows, loading, errors, updatedAt, refresh } = useTimeStampData();
  const manageRef = useRef(null);
  const [stamp, setStamp] = useState(null);   // { kind, row }

  const handleStamp = useCallback((kind, row) => setStamp({ kind, row }), []);
  const closeStamp = useCallback(() => { setStamp(null); void refresh(); }, [refresh]);
  const actions = useMemo(() => ({
    cart: (r) => manageRef.current?.openCart(r),
    slip: (r) => manageRef.current?.openSlip(r),
    complete: (r) => manageRef.current?.openComplete(r),
    editPlan: (r) => manageRef.current?.openEdit(r),
  }), []);

  const Modal = stamp ? STAMP_MODALS[stamp.kind] : null;
  const sap = stamp?.row?.sap;
  return (
    <div>
      <TimeStampTable rows={rows} date={date} onDateChange={setDate} loading={loading} errors={errors} updatedAt={updatedAt}
        onRefresh={refresh} onStamp={handleStamp} actions={actions} />
      {Modal && sap && (
        <Modal open onClose={closeStamp} onSuccess={refresh} data={sap} material={sap.mat} batch={sap.batch} sap_re_id={sap.sap_re_id}
          withdraw_date={sap.withdraw_date} hu={sap.hu} remark={sap.remark} />
      )}
      <ManageModals ref={manageRef} onRefresh={refresh} />
    </div>
  );
};

export default React.memo(ParentComponent);
