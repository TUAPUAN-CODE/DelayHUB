router.post("/coldstorages/scan/sap/come/cs", async (req, res) => {
  const { mat, batch, hu, weight } = req.body;

  if (!mat || !batch || !hu) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid required fields",
    });
  }

  let transaction;
  try {
    const pool = await connectToDatabase();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // ✅ ค้นหา hu และดึง start/end defrost date มาเช็ค
    const checkReq = new sql.Request(transaction);
    const checkResult = await checkReq
      .input("hu", hu)
      .query(`
        SELECT sap_re_id, start_defrost_date, end_defrost_date
        FROM SAP_Receive
        WHERE hu = @hu
      `);

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `ไม่พบข้อมูล HU: ${hu} ในระบบ`,
      });
    }

    const row = checkResult.recordset[0];

    // ✅ เช็ค start_defrost_date ก่อน
    if (!row.start_defrost_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `ยังไม่ได้บันทึกเวลาเริ่มละลาย สำหรับ HU: ${hu}`,
      });
    }

    // ✅ เช็ค end_defrost_date
    if (!row.end_defrost_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `ยังไม่ได้บันทึกเวลาละลายเสร็จ สำหรับ HU: ${hu}`,
      });
    }

    // ✅ ครบทั้งคู่ → UPDATE cs_come_cold_after_df_date
    const updateReq = new sql.Request(transaction);
    await updateReq
      .input("hu", hu)
      .input("weight", weight ?? null)
      .query(`
        UPDATE SAP_Receive
        SET cs_come_cold_after_df_date = GETDATE(),
            weight                     = COALESCE(@weight, weight)
        WHERE hu = @hu
      `);

    await transaction.commit();

    res.json({
      success: true,
      message: "บันทึกเวลาเข้าห้องเย็นหลังละลายเสร็จสิ้น",
      action: "update",
      summary: { batch, mat, hu, weight },
    });

  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("SQL error", err);
    res.status(500).json({ success: false, error: err.message });
  }
});