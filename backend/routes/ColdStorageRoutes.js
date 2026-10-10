const { safeRollback } = require("../lib/safeRollback");
module.exports = (io) => {
    const express = require("express");
    const { connectToDatabase } = require("../database/db");
    const sql = require("mssql");
    const { round } = require("lodash");

    const router = express.Router();
    const RESERVATION_TIMEOUT_MINUTES = 5; // 5 นาที

    const DEBUG_LOGS = process.env.DEBUG_LOGS === 'true';
    function debugLog(...args) { if (DEBUG_LOGS) console.log(...args); }

    // ✅ ฟังก์ชันเคลียร์ Slot ที่จองไว้นานเกินไป
    const clearExpiredSlots = async () => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
               UPDATE Slot 
SET tro_id = NULL,status ='16', reserved_at = NULL 
WHERE reserved_at IS NOT NULL 
AND tro_id = 'rsrv'
AND DATEDIFF(MINUTE, reserved_at, GETDATE()) >= ${RESERVATION_TIMEOUT_MINUTES}
            `);

            if (result.rowsAffected[0] > 0) {
                io.emit("slotReset", {}); // แจ้ง frontend ว่ามีการรีเซ็ต Slot
                debugLog(`ล้าง Slot ที่หมดอายุแล้ว (${result.rowsAffected[0]} รายการ)`);
            }
        } catch (error) {
            console.error("Error clearing expired slots:", error);
        }
    };

    // ✅ ตั้งให้รันทุก 10 นาที
    setInterval(clearExpiredSlots, 60 * 10000);



    router.get("/coldstorage/main/md/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
      SELECT
          rmm.mapping_id,
          rmf.rmfp_id,
          rmm.tro_id,
          STRING_AGG(b.batch_after, ', ') AS batch_after,
          rm.mat,
          rm.mat_name,
          CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
          rmm.level_eu,
          FORMAT(rmm.prep_to_cold_time, 'N2') AS remaining_time,
          FORMAT(rmg.prep_to_cold, 'N2') AS standard_time,
          FORMAT(rmm.prep_to_pack_time, 'N2') AS remaining_prep_to_pack_time,
          FORMAT(rmg.prep_to_pack, 'N2') AS standard_prep_to_pack_time,
          FORMAT(rmm.cold_to_pack_time, 'N2') AS remaining_cold_to_pack_time,
          FORMAT(rmg.cold_to_pack, 'N2') AS standard_cold_to_pack_time,
          FORMAT(rmm.rework_time, 'N2') AS remaining_rework_time,
          FORMAT(rmg.rework, 'N2') AS standard_rework_time,
          rmm.rm_status,
          rmm.dest,
          rmm.weight_RM,
          rmm.tray_count,
          FORMAT(htr.cooked_date, 'yyyy-MM-dd HH:mm:ss') AS cooked_date,
          FORMAT(htr.rmit_date, 'yyyy-MM-dd HH:mm:ss') AS rmit_date,
          FORMAT(htr.qc_date, 'yyyy-MM-dd HH:mm:ss') AS qc_date,
          FORMAT(htr.out_cold_date, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date,
          FORMAT(htr.out_cold_date_two, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_two,
          FORMAT(htr.out_cold_date_three, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_three,


          rmm.from_mapping_id,
          FORMAT(htr_pack.pack_checkin_date, 'yyyy-MM-dd HH:mm:ss') AS pack_checkin_date


      FROM
          TrolleyRMMapping rmm
      JOIN  
          RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id  
      LEFT JOIN
          Batch b ON rmm.mapping_id = b.mapping_id
      JOIN
          ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
      JOIN
          RawMat rm ON pr.mat = rm.mat
      JOIN
          Production p ON pr.prod_id = p.prod_id
      JOIN
          RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
      JOIN
          History htr ON rmm.mapping_id = htr.mapping_id
      LEFT JOIN
          History htr_pack ON rmm.from_mapping_id = htr_pack.mapping_id


      WHERE
          rmm.rm_status IN (
              'QcCheck',
              'เหลือจากไลน์ผลิต',
              'รอแก้ไข',
              'รอกลับมาเตรียม',
              'รอ Qc',
              'QcCheck รอ MD',
              'QcCheck รอกลับมาเตรียม',
              'รอQCตรวจสอบ'
          )
          AND rmf.rm_group_id = rmg.rm_group_id
          AND rmm.tro_id IS NOT NULL
          AND rmm.dest IN ('เข้าห้องเย็น', 'รอCheckin')
      GROUP BY
          rmm.mapping_id,
          rmf.rmfp_id,
          rmm.tro_id,
          rm.mat,
          rm.mat_name,
          p.doc_no,
          rmm.rmm_line_name,
          rmm.level_eu,
          rmm.prep_to_cold_time,
          rmg.prep_to_cold,
          rmm.prep_to_pack_time,
          rmg.prep_to_pack,
          rmm.cold_to_pack_time,
          rmg.cold_to_pack,
          rmm.rework_time,
          rmg.rework,
          rmm.rm_status,
          rmm.dest,
          rmm.weight_RM,
          rmm.tray_count,
          htr.cooked_date,
          htr.rmit_date,
          htr.qc_date,
          htr.out_cold_date,
          htr.out_cold_date_two,
          htr.out_cold_date_three,
          rmm.from_mapping_id,        
          htr_pack.pack_checkin_date    
      ORDER BY
          rmm.mapping_id DESC
    `);


            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    router.get("/coldstorage/main/mix/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
                SELECT
                    rmm.mapping_id,
                    rmm.tro_id,
                    rmm.tray_count,
                    rmm.weight_RM,
                    rmm.rm_status,
                    rmm.stay_place,
                    rmm.dest,
                    rmm.mix_code,
                    rmm.prod_mix,
                    rmm.mix_time,
                    CONCAT(p.doc_no, ' (', rmm.[rmm_line_name], ')') AS production,
                    p.code,
                    FORMAT(htr.mixed_date, 'yyyy-MM-dd HH:mm:ss') AS mixed_date,
                    FORMAT(htr.pack_checkin_date, 'yyyy-MM-dd HH:mm:ss') AS pack_checkin_date
                FROM
                    TrolleyRMMapping rmm
                JOIN
                    Production p ON rmm.prod_mix = p.prod_id
                JOIN
                    History htr ON rmm.mapping_id = htr.mapping_id
                WHERE
                    rmm.dest IN ('เข้าห้องเย็น', 'รอCheckin')
                    AND rmm.rm_status IN ('เหลือจากไลน์ผลิต','รอแก้ไข')
                    AND rmm.tro_id IS NOT NULL
            `);


            const formattedData = result.recordset.map(item => {
                debugLog("item :", item);
                return item;
            });


            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/coldstorage/main/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
                SELECT
                    rmf.rmfp_id,
                    rmm.tro_id,
                    rmf.batch,
                    rm.mat,
                    rm.mat_name,
                    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
                    rmm.level_eu,
                    FORMAT(rmm.prep_to_cold_time, 'N2') AS remaining_time,
                    FORMAT(rmg.prep_to_cold, 'N2') AS standard_time,
                    FORMAT(rmm.prep_to_pack_time, 'N2') AS remaining_prep_to_pack_time,
                    FORMAT(rmg.prep_to_pack, 'N2') AS standard_prep_to_pack_time,
                    FORMAT(rmm.cold_to_pack_time, 'N2') AS remaining_cold_to_pack_time,
                    FORMAT(rmg.cold_to_pack, 'N2') AS standard_cold_to_pack_time,
                    FORMAT(rmm.rework_time, 'N2') AS remaining_rework_time,
                    FORMAT(rmg.rework, 'N2') AS standard_rework_time,
                    rmm.rm_status,
                    rmm.dest,
                    rmm.weight_RM,
                    rmm.tray_count,
                    FORMAT(htr.cooked_date, 'yyyy-MM-dd HH:mm:ss') AS cooked_date,
                    FORMAT(htr.rmit_date, 'yyyy-MM-dd HH:mm:ss') AS rmit_date,
                    FORMAT(htr.qc_date, 'yyyy-MM-dd HH:mm:ss') AS qc_date,
                    FORMAT(htr.out_cold_date, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date,
                    FORMAT(htr.out_cold_date_two, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_two,
                    FORMAT(htr.out_cold_date_three, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_three,
                    FORMAT(htr.pack_checkin_date, 'yyyy-MM-dd HH:mm:ss') AS pack_checkin_date


                FROM
                    TrolleyRMMapping rmm
                JOIN  
                    RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id  
                JOIN
                    ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
                JOIN
                    RawMat rm ON pr.mat = rm.mat
                JOIN
                    Production p ON pr.prod_id = p.prod_id
                JOIN
                    RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                JOIN
                    History htr ON rmm.mapping_id = htr.mapping_id
                WHERE
                    rmm.dest IN ('เข้าห้องเย็น', 'รอCheckin')
                    AND rmm.rm_status IN ('รอกลับมาเตรียม','รอ Qc','QcCheck รอ MD','QcCheck รอกลับมาเตรียม')
                    AND rmf.rm_group_id = rmg.rm_group_id
                    AND rmm.tro_id IS NOT NULL;


          `);


            const formattedData = result.recordset.map(item => {
                debugLog("item :", item);
                return item;
            });




            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    /**
    * @swagger
    * /api/coldstorage/room:
    *    get:
    *      summary: ช่องจอดห้องเย็น
    *      tags:
    *       - ColdStorage
    *      responses:
    *        200:
    *          description: Successfull response
    *        500:
    *          description: Internal server error
    */
    router.get("/coldstorage/room", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const result = await pool.request().query(`
        SELECT 
          slot_id,
          cs_id,
          tro_id,
          slot_status
        FROM Slot
      `);

            if (result.recordset.length > 0) {
                res.status(200).json({
                    message: "successfully",
                    slot: result.recordset,
                });
            } else {
                res.status(404).json({ message: "No Slot" });
            }
        } catch (error) {
            console.error("Error retrieving slot:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    });

    /**
 * @swagger
 * /api/coldstorage/update-rsrv-slot:
 *   put:
 *     summary: อัปเดต Slot เป็น "กำลังจอง"
 *     description: ใช้สำหรับอัปเดต slot_id และ cs_id โดยตั้งค่า tro_id เป็น "rsrv"
 *     tags:
 *       - ColdStorage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slot_id
 *               - cs_id
 *             properties:
 *               slot_id:
 *                 type: integer
 *               cs_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: อัปเดตค่ากำลังจองแล้ว
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: ข้อผิดพลาดภายในเซิร์ฟเวอร์
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
    router.put("/coldstorage/update-rsrv-slot", async (req, res) => {
        const { slot_id, cs_id } = req.body;

        if (!slot_id || !cs_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        try {
            const pool = await connectToDatabase();
            const transaction = pool.transaction();
            await transaction.begin();

            const resultSlot = await transaction.request()
                .input("slot_id", sql.VarChar, slot_id)
                .input("cs_id", cs_id)
                .query(`
          SELECT slot_id, cs_id, reserved_at FROM Slot WHERE slot_id = @slot_id AND cs_id = @cs_id
        `);

            if (resultSlot.recordset.length === 0) {
                return res.status(404).json({ success: false, message: "ไม่พบข้อมูล Slot หรือ CSID" });
            }

            const slot = resultSlot.recordset[0];

            // 🟢 ตรวจสอบว่า slot นี้ถูกจองแล้วหรือยัง
            if (slot.tro_id === 'rsrv') {
                const reservedTime = new Date(slot.reserved_at);
                const now = new Date();
                const diffMinutes = (now - reservedTime) / (10000 * 60);

                if (diffMinutes < RESERVATION_TIMEOUT_MINUTES) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "Slot นี้ถูกจองอยู่แล้ว" });
                }
            }


            await transaction.request()
                .input("slot_id", sql.VarChar, slot_id)
                .input("cs_id", cs_id)
                .query(`
          UPDATE Slot SET tro_id = 'rsrv',status ='339', reserved_at = GETDATE() WHERE slot_id = @slot_id AND cs_id = @cs_id AND tro_id IS NULL
        `);

            await transaction.commit();

            // ✅ ตรวจสอบว่า io ถูกส่งมาหรือไม่ ก่อน emit
            if (!io) {
                console.error("❌ io is undefined, cannot emit event");
                return res.status(500).json({ success: false, error: "Socket.io instance is missing" });
            }

            // 📢 ส่ง event ไปยัง frontend
            io.emit("slotUpdated", { slot_id, cs_id });

            res.json({ success: true, message: "อัปเดตค่ากำลังจองแล้ว" });

        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });



    /**
 * @swagger
 * /api/coldstorage/update-NULL-slot:
 *   put:
 *     summary: อัปเดต Slot เป็น "ว่าง"
 *     description: ใช้สำหรับอัปเดต slot_id และ cs_id โดยตั้งค่า tro_id เป็น NULL
 *     tags:
 *       - ColdStorage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slot_id
 *               - cs_id
 *             properties:
 *               slot_id:
 *                 type: integer
 *               cs_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: อัปเดตค่าว่างแล้ว
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: ข้อผิดพลาดภายในเซิร์ฟเวอร์
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
    router.put("/clodstorage/update-NULL-slot", async (req, res) => {
        const { slot_id, cs_id } = req.body;

        if (!slot_id || !cs_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let pool, transaction;
        try {
            pool = await connectToDatabase();
            transaction = new sql.Transaction(pool);

            await transaction.begin();

            // 1. ตรวจสอบ Slot ก่อน
            const resultSlot = await transaction.request()
                .input("slot_id", sql.VarChar, slot_id)
                .input("cs_id", cs_id)
                .query(`
        SELECT slot_id, cs_id, tro_id, reserved_at
        FROM Slot
        WHERE slot_id = @slot_id AND cs_id = @cs_id
      `);

            if (resultSlot.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(404).json({ success: false, message: "ไม่พบข้อมูล Slot หรือ CSID" });
            }

            // 2. อัปเดตค่า tro_id และ reserved_at ให้เป็น NULL
            const updateResult = await transaction.request()
                .input("slot_id", sql.VarChar, slot_id)
                .input("cs_id", cs_id)
                .query(`
       UPDATE Slot
        SET tro_id = NULL, status='444', reserved_at = NULL
        WHERE slot_id = @slot_id 
        AND cs_id = @cs_id
        AND tro_id = 'rsrv'
      `);

            // ตรวจสอบว่ามีแถวที่ถูกอัปเดตจริงหรือไม่
            if (updateResult.rowsAffected[0] === 0) {
                await safeRollback(transaction);
                return res.status(409).json({ success: false, message: "ไม่สามารถอัปเดต Slot ได้" });
            }

            // 3. Commit transaction ถ้าทุกอย่างผ่าน
            await transaction.commit();

            // 4. ส่ง event ไปยัง frontend ถ้ามี socket.io
            if (io) {
                io.emit("slotUpdated", { slot_id, cs_id });
            } else {
                console.error("❌ io is undefined, cannot emit event");
            }

            res.json({ success: true, message: "อัปเดตค่าว่างแล้ว" });

        } catch (err) {
            if (transaction) {
                try {
                    await safeRollback(transaction);
                } catch (rollbackErr) {
                    console.error("❌ Rollback error:", rollbackErr);
                }
            }
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.put("/clodstorage/rmInTrolley", async (req, res) => {
        const { mapping_id, rm_status } = req.body;

        if (!mapping_id || !rm_status) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let pool, transaction;
        try {
            pool = await connectToDatabase();
            transaction = new sql.Transaction(pool);

            await transaction.begin();

            // 1. ตรวจสอบข้อมูลเดิม
            const checkResult = await transaction.request()
                .input("mapping_id", sql.Int, mapping_id)
                .query(`
        SELECT
          trm.rm_status,
          htr.qccheck_cold,
          trm.mix_code
        FROM
          TrolleyRMMapping trm
        JOIN
          History htr ON trm.mapping_id = htr.mapping_id
        WHERE trm.mapping_id = @mapping_id
      `);

            if (checkResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(404).json({ error: "ไม่พบข้อมูล mapping_id ที่ระบุ" });
            }

            const { rm_status: currentStatus, qccheck_cold: qcCheckCold, mix_code: mixCode } =
                checkResult.recordset[0];

            // 2. ตรวจสอบเงื่อนไขก่อนอัปเดต
            if (mixCode !== null) {
                await safeRollback(transaction);
                return res.status(200).json({
                    success: true,
                    message: "ไม่ทำการอัปเดตเนื่องจากเป็นวัตถุดิบผสม",
                    mixCode,
                });
            }

            if (currentStatus === "รอกลับมาเตรียม" || currentStatus === "QcCheck รอ MD") {
                await safeRollback(transaction);
                return res.status(200).json({
                    success: true,
                    message: "ไม่ทำการอัปเดตเนื่องจากสถานะไม่อนุญาตให้เปลี่ยน",
                    currentStatus,
                });
            }

            if (currentStatus === "QcCheck" && qcCheckCold !== null) {
                await safeRollback(transaction);
                return res.status(200).json({
                    success: true,
                    message: "ไม่ทำการอัปเดตเนื่องจากวัตถุดิบผ่านการตรวจสอบ QC แล้ว",
                    currentStatus,
                    qcCheckCold,
                });
            }

            // 3. อัปเดตสถานะวัตถุดิบ
            const updateResult = await transaction.request()
                .input("mapping_id", sql.Int, mapping_id)
                .input("rm_status", sql.NVarChar, rm_status)
                .query(`
        UPDATE TrolleyRMMapping
        SET rm_status = @rm_status
        WHERE mapping_id = @mapping_id
      `);

            // ตรวจสอบว่ามีแถวถูกอัปเดตจริงหรือไม่
            if (updateResult.rowsAffected[0] === 0) {
                await safeRollback(transaction);
                return res.status(409).json({
                    success: false,
                    message: "ไม่สามารถอัปเดตสถานะได้",
                });
            }

            // 4. Commit ถ้าทุกอย่างผ่าน
            await transaction.commit();

            return res.status(200).json({
                success: true,
                message: "อัปเดตสถานะวัตถุดิบสำเร็จ",
                rowsAffected: updateResult.rowsAffected,
            });
        } catch (error) {
            if (transaction) {
                try {
                    await safeRollback(transaction);
                } catch (rollbackErr) {
                    console.error("❌ Rollback error:", rollbackErr);
                }
            }
            console.error("Error updating RM status:", error);
            return res.status(500).json({
                success: false,
                error: "เกิดข้อผิดพลาดในการอัปเดตสถานะวัตถุดิบ",
                details: error.message,
            });
        }
    });

    module.exports = router;





    // //เปลี่ยนสถานะ rm_status ในตาราง RMIntrolley
    // router.put("/clodstorage/rmInTrolley", async (req, res) => {
    //     const { mapping_id, rm_status } = req.body;

    //     if (!mapping_id) {
    //         return res.status(400).json({ error: "Missing required fields" });
    //     }

    //     let transaction
    //     try {
    //         const pool = await connectToDatabase();
    //         transaction = pool.transaction();
    //         await transaction.begin();

    //         const checkResult = await transaction
    //             .request()
    //             .input("mapping_id", sql.Int, mapping_id)
    //             .query(`SELECT
    //             trm.rm_status,
    //             qc.qccheck_cold
    //             FROM
    //                 TrolleyMapping trm
    //             LEFT JOIN
    //                 Qc qc ON trm.qc_id = qc.qc_id
    //             WHERE trm.mapping_id = @mapping_id
    //             `)
    //         if (checkResult.recordset[0].length === 0) {
    //             await safeRollback(transaction);
    //             return res.status(404).json({
    //                 success: false,
    //                 message: `ไม่พบวัตถุดิบด้วย mapping_id: ${mapping_id}`
    //             })
    //         }

    //         const currentStatus = checkResult.recordset[0].rm_status;
    //         const qcCheckCold = checkResult.recordset[0].qccheck_cold;

    //         console.log("currentStatus :",currentStatus)
    //         console.log("qcCheckCold :",qcCheckCold)

    //         if (currentStatus === "QcCheck" && qcCheckCold !== NULL) {
    //             await safeRollback(transaction);
    //             return res.status(400).json({
    //                 success: false,
    //                 message: "วัตถุดิบนี้ตรวจสอบแล้ว ไม่สามารถเปลี่ยนสถานะเป็น 'รอแก้ไข' ได้"
    //             })
    //         }

    //         // 3. อัปเดตสถานะ
    //         await transaction.request()
    //             .input("mapping_id", sql.Int, mapping_id)
    //             .input("rm_status", sql.NVarChar(50), rm_status)
    //             .query(`
    //             UPDATE TrolleyRMMapping
    //             SET rm_status = @rm_status
    //             WHERE mapping_id = @mapping_id
    //         `);

    //         await transaction.commit();

    //         return res.status(200).json({
    //             success: true,
    //             message: "อัปเดตสถานะวัตถุดิบเรียบร้อยแล้ว"
    //         });

    //     } catch (error) {
    //         await safeRollback(transaction);
    //         return res.status(500).json({
    //             success: false,
    //             error: "เกิดข้อผิดพลาดในการอัปเดตสถานะวัตถุดิบ",
    //             details: error.message
    //         });
    //     }
    // });



    const reservedSlots = new Map();
    const RESERVATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes


    io.on('connection', (socket) => {
        debugLog('Client connected:', socket.id);

        socket.on('reserveSlot', async ({ slot_id, cs_id }) => {
            const reservationKey = `${slot_id}-${cs_id}`;

            // Check if slot is already reserved
            if (reservedSlots.has(reservationKey)) {
                socket.emit('reservationError', {
                    message: 'Slot is already reserved',
                    slot_id,
                    cs_id
                });
                return;
            }

            try {
                // Create reservation
                reservedSlots.set(reservationKey, {
                    slot_id,
                    cs_id,
                    socketId: socket.id,
                    timestamp: Date.now()
                });

                // Broadcast reservation to all clients
                io.emit('slotUpdated', {
                    slot_id,
                    cs_id,
                    status: 'reserved'
                });

                // Set timeout to auto-cancel reservation
                setTimeout(() => {
                    if (reservedSlots.has(reservationKey)) {
                        reservedSlots.delete(reservationKey);
                        io.emit('slotUpdated', {
                            slot_id,
                            cs_id,
                            status: 'available'
                        });
                    }
                }, RESERVATION_TIMEOUT);

            } catch (error) {
                console.error('Reservation error:', error);
                socket.emit('reservationError', {
                    message: 'Failed to reserve slot',
                    slot_id,
                    cs_id
                });
            }
        });

        socket.on('disconnect', () => {
            // Clear reservations for disconnected socket
            for (const [key, value] of reservedSlots.entries()) {
                if (value.socketId === socket.id) {
                    const [slot_id, cs_id] = key.split('-');
                    reservedSlots.delete(key);
                    io.emit('slotUpdated', {
                        slot_id,
                        cs_id,
                        status: 'available'
                    });
                }
            }
            debugLog('Client disconnected:', socket.id);
        });
    });

    router.get("/coldstorage/fetchSlotRawMat", async (req, res) => {
        try {
            const { slot_id } = req.query;
            debugLog(`Received slot_id: ${slot_id}`);

            if (!slot_id) {
                return res.status(400).json({ success: false, error: "slot_id is required" });
            }

            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(500).json({ success: false, error: "Database connection failed." });
            }

            const result = await pool.request()
                .input('slot_id', sql.VarChar, slot_id)
                .query(`
                SELECT 
                    s.slot_id,
                    s.tro_id,
                    rmm.mapping_id,
                    rmm.tray_count,
                    rmm.weight_RM,
                    rmm.rm_status,
                    rm.mat_name,
                    CONCAT(p.doc_no, '(', rmm.rmm_line_name, ')') AS production,
                    FORMAT(rmm.prep_to_cold_time, 'N2') AS ptc_time,
                    FORMAT(COALESCE(rmm.cold_time, rmg.cold), 'N2') AS cold,
                    FORMAT(rmg.cold, 'N2') AS standard_cold,
                    FORMAT(rmm.rework_time, 'N2') AS rework_time,
                    FORMAT(rmg.rework, 'N2') AS standard_rework,
                    rmp.rmfp_id,
                    prm.mat,
                    h.cooked_date,
                    h.rmit_date,
                    CONVERT(VARCHAR, h.come_cold_date, 120) AS come_cold_date,
                    CONVERT(VARCHAR, h.come_cold_date_two, 120) AS come_cold_date_two,
                    CONVERT(VARCHAR, h.come_cold_date_three, 120) AS come_cold_date_three,
                    s.cs_id,
                    -- รวมค่า batch_after ทุกตัวใน mapping เดียวกัน
                    STRING_AGG(b.batch_after, ', ') AS batch_after_list
                FROM 
                    Slot s
                JOIN 
                    Trolley t ON s.tro_id = t.tro_id
                JOIN 
                    TrolleyRMMapping rmm ON rmm.tro_id = s.tro_id
                JOIN 
                    RMForProd rmp ON rmp.rmfp_id = rmm.rmfp_id
                JOIN 
                    ProdRawMat prm ON prm.prod_rm_id = rmm.tro_production_id
                JOIN 
                    RawMat rm ON rm.mat = prm.mat
                LEFT JOIN
                    batch b ON rmm.mapping_id = b.mapping_id
                JOIN 
                    ColdStorage c ON c.cs_id = s.cs_id
                JOIN 
                    Production p ON p.prod_id = prm.prod_id
                JOIN
                    RawMatGroup rmg ON rmp.rm_group_id = rmg.rm_group_id
                JOIN
                    History h ON rmm.mapping_id = h.mapping_id
                WHERE
                    s.slot_id = @slot_id AND rmm.dest = N'ห้องเย็น'
                    AND rmp.rm_group_id = rmg.rm_group_id
                GROUP BY
                    s.slot_id, s.tro_id, rmm.mapping_id, rmm.tray_count, rmm.weight_RM, 
                    rmm.rm_status, rm.mat_name, p.doc_no, rmm.rmm_line_name,
                    rmm.prep_to_cold_time, rmm.cold_time, rmg.cold, 
                    rmm.rework_time, rmg.rework, rmp.rmfp_id, prm.mat,
                    h.cooked_date, h.rmit_date, h.come_cold_date, 
                    h.come_cold_date_two, h.come_cold_date_three, s.cs_id
            `);

            if (result.recordset.length === 0) {
                return res.status(404).json({ success: false, error: "No data found for the given slot_id." });
            }

            const formattedData = result.recordset.map(item => {
                // แปลงวันที่ cooked_date
                if (item.cooked_date) {
                    const cookedDate = new Date(item.cooked_date);
                    const cookedYear = cookedDate.getUTCFullYear();
                    const cookedMonth = String(cookedDate.getUTCMonth() + 1).padStart(2, '0');
                    const cookedDay = String(cookedDate.getUTCDate()).padStart(2, '0');
                    const cookedHours = String(cookedDate.getUTCHours()).padStart(2, '0');
                    const cookedMinutes = String(cookedDate.getUTCMinutes()).padStart(2, '0');

                    item.CookedDateTime = `${cookedYear}-${cookedMonth}-${cookedDay} ${cookedHours}:${cookedMinutes}`;
                    delete item.cooked_date;
                } else {
                    item.CookedDateTime = null;
                }

                if (item.rmit_date) {
                    const cookedDate = new Date(item.rmit_date);
                    const cookedYear = cookedDate.getUTCFullYear();
                    const cookedMonth = String(cookedDate.getUTCMonth() + 1).padStart(2, '0');
                    const cookedDay = String(cookedDate.getUTCDate()).padStart(2, '0');
                    const cookedHours = String(cookedDate.getUTCHours()).padStart(2, '0');
                    const cookedMinutes = String(cookedDate.getUTCMinutes()).padStart(2, '0');

                    item.RawmatTransForm = `${cookedYear}-${cookedMonth}-${cookedDay} ${cookedHours}:${cookedMinutes}`;
                    delete item.rmit_date;
                } else {
                    item.RawmatTransForm = null;
                }

                // เปลี่ยนชื่อ field batch_after_list → batch
                item.batch = item.batch_after_list || null;
                delete item.batch_after_list;

                return item;
            });

            res.json({ success: true, data: formattedData });
        } catch (error) {
            console.error('Error during database query:', error);
            res.status(500).json({ success: false, error: `An error occurred while fetching data: ${error.message}` });
        }
    });


    router.get("/coldstorage/mixed/fetchSlotRawMat", async (req, res) => {
        try {
            const { slot_id } = req.query;
            debugLog(`Received slot_id for mixed materials: ${slot_id}`);

            if (!slot_id) {
                return res.status(400).json({ success: false, error: "slot_id is required" });
            }

            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(500).json({ success: false, error: "Database connection failed." });
            }

            const result = await pool
                .request()
                .input('slot_id', sql.VarChar, slot_id)
                .query(`
                    SELECT
                        rmm.mapping_id,
                        rmm.tro_id,
                        s.slot_id,
                        rmm.tray_count,
                        rmm.rmfp_id,
                        rmm.weight_RM,
                        rmm.rm_status,
                        rmm.stay_place,
                        rmm.dest,
                        rmm.mix_code,
                        rmm.prod_mix,
                        rmm.mix_time,
                        CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
                        p.code,
                        FORMAT(htr.mixed_date, 'yyyy-MM-dd HH:mm:ss') AS mixed_date,
                        CONVERT(VARCHAR, htr.come_cold_date, 120) AS come_cold_date,
                        CONVERT(VARCHAR, htr.come_cold_date_two, 120) AS come_cold_date_two,
                        CONVERT(VARCHAR, htr.come_cold_date_three, 120) AS come_cold_date_three,
                        s.cs_id
                    FROM
                        TrolleyRMMapping rmm
                    JOIN 
                        Slot s ON rmm.tro_id = s.tro_id
                    JOIN
                        RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                    JOIN 
                        Production p ON rmm.prod_mix = p.prod_id
                    JOIN 
                        History htr ON rmm.mapping_id = htr.mapping_id
                    WHERE 
                        s.slot_id = @slot_id AND rmm.dest = 'ห้องเย็น'
                        AND rmm.mix_code IS NOT NULL
                `);

            if (result.recordset.length === 0) {
                return res.json({ success: true, data: [] }); // ส่งอาร์เรย์ว่างเมื่อไม่พบข้อมูล
            }

            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    router.get("/coldstorage/fetchAvailableRawMaterials", async (req, res) => {
        try {
            const { current_tro_id } = req.query;
            debugLog("tro_id : ", current_tro_id)

            if (!current_tro_id) {
                return res.status(400).json({
                    success: false,
                    error: "current_tro_id is required"
                });
            }

            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(500).json({
                    success: false,
                    error: "Database connection failed."
                });
            }

            // ดึงข้อมูลวัตถุดิบปกติ
            // แก้ไข JOIN กับ batch table ให้ใช้ subquery ที่รวม batch_after หลายค่าเข้าด้วยกัน
            const normalRawMatQuery = `
SELECT 
    rmm.mapping_id,
    rmm.tro_id,
    rmm.rmfp_id,
    b.batch_combined AS batch,
    rm.mat_name,
    rm.mat,
    CONCAT(p.doc_no, '(', rmm.rmm_line_name, ')') AS production,
    rmm.weight_RM,
    rmm.tray_count,
    rmm.rm_status,
    rmm.dest,
    s.slot_id,
    cs.cs_id,
    cs.cs_name,
    h.cooked_date,
    h.rmit_date,
    CONVERT(VARCHAR, h.come_cold_date, 120) AS come_cold_date,
    CONVERT(VARCHAR, h.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(VARCHAR, h.come_cold_date_three, 120) AS come_cold_date_three,
    FORMAT(rmm.cold_time, 'N2') AS cold_time,
    FORMAT(rmm.rework_time, 'N2') AS rework_time,
    FORMAT(rmg.cold, 'N2') AS standard_cold,
    FORMAT(rmg.rework, 'N2') AS standard_rework,
    0 AS isMixed
FROM 
    TrolleyRMMapping rmm
LEFT JOIN 
    RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
LEFT JOIN 
    ProdRawMat prm ON prm.prod_rm_id = rmm.tro_production_id
LEFT JOIN 
    RawMat rm ON rm.mat = prm.mat
LEFT JOIN (
    SELECT 
        mapping_id,
        STRING_AGG(batch_after, ', ') AS batch_combined
    FROM batch
    GROUP BY mapping_id
) b ON rmm.mapping_id = b.mapping_id
LEFT JOIN Qc q ON rmm.qc_id = q.qc_id
LEFT JOIN Production p ON p.prod_id = prm.prod_id
LEFT JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
LEFT JOIN History h ON rmm.mapping_id = h.mapping_id
LEFT JOIN Slot s ON rmm.tro_id = s.tro_id
LEFT JOIN ColdStorage cs ON s.cs_id = cs.cs_id
WHERE
    rmm.tro_id != @current_tro_id
    AND rmm.dest = 'ห้องเย็น'
    AND rmm.stay_place = 'เข้าห้องเย็น'
    AND rmm.weight_RM > 0
    AND rmm.tro_id IS NOT NULL;
`;

            // ดึงข้อมูลวัตถุดิบผสม
            const mixedRawMatQuery = `
            SELECT 
                rmm.mapping_id,
                rmm.tro_id,
                NULL AS rmfp_id,
                NULL AS batch,
                CONCAT('Mixed: ', rmm.mix_code) AS mat_name, 
                rmm.mix_code AS mat,
                CONCAT(p.doc_no, '(', rmm.rmm_line_name, ')') AS production,
                rmm.weight_RM,
                rmm.tray_count,
                rmm.rm_status,
                rmm.dest,
                s.slot_id,
                cs.cs_id,
                cs.cs_name,
                NULL AS cooked_date,
                NULL AS rmit_date,
                CONVERT(VARCHAR, h.mixed_date, 120) AS mixed_date,
                CONVERT(VARCHAR, h.come_cold_date, 120) AS come_cold_date,
                CONVERT(VARCHAR, h.come_cold_date_two, 120) AS come_cold_date_two,
                CONVERT(VARCHAR, h.come_cold_date_three, 120) AS come_cold_date_three,
                FORMAT(rmm.mix_time, 'N2') AS mix_time,
                NULL AS rework_time,
                NULL AS standard_cold,
                NULL AS standard_rework,
                1 AS isMixed -- ระบุว่าเป็นวัตถุดิบผสม
            FROM 
                TrolleyRMMapping rmm
            JOIN 
                Production p ON rmm.prod_mix = p.prod_id
            JOIN
                History h ON rmm.mapping_id = h.mapping_id
            JOIN
                Slot s ON rmm.tro_id = s.tro_id
            JOIN
                ColdStorage cs ON s.cs_id = cs.cs_id
            WHERE
                rmm.tro_id != @current_tro_id
                AND rmm.dest = 'ห้องเย็น'
                AND rmm.stay_place = 'เข้าห้องเย็น'
                AND rmm.weight_RM > 0
                AND rmm.tro_id IS NOT NULL
        `;

            // ดึงข้อมูลทั้งสองประเภทพร้อมกัน
            const [normalResult, mixedResult] = await Promise.all([
                pool.request()
                    .input('current_tro_id', current_tro_id)
                    .query(normalRawMatQuery),
                pool.request()
                    .input('current_tro_id', current_tro_id)
                    .query(mixedRawMatQuery)
            ]);

            // รวมข้อมูลทั้งสองประเภท
            const combinedData = [
                ...normalResult.recordset.map(item => ({
                    ...item,
                    CookedDateTime: item.cooked_date ?
                        new Date(item.cooked_date).toISOString().replace('T', ' ') : null,
                    RawmatTransForm: item.rmit_date ?
                        new Date(item.rmit_date).toISOString().replace('T', ' ') : null
                })),
                ...mixedResult.recordset.map(item => ({
                    ...item,
                    CookedDateTime: null,
                    RawmatTransForm: item.mixed_date ?
                        new Date(item.mixed_date).toISOString().replace('T', ' ') : null
                }))
            ];

            res.json({
                success: true,
                data: combinedData
            });
        } catch (error) {
            console.error('Error fetching available raw materials:', error);
            res.status(500).json({
                success: false,
                error: `An error occurred: ${error.message}`
            });
        }
    });
    router.put("/coldstorage/addRawMatToTrolley", async (req, res) => {
        try {
            debugLog("Raw Request Body:", req.body);
            const {
                source_tro_id,
                target_tro_id,
                weight,
                slot_id,
                rmfp_id,
                mix_code,
                mapping_id,
                isMixed
            } = req.body;

            if (!source_tro_id || !target_tro_id || !weight || !slot_id) {
                return res.status(400).json({ success: false, error: "Missing required fields" });
            }

            if (isMixed) {
                if (!mix_code || !mapping_id) {
                    return res.status(400).json({ success: false, error: "For mixed materials, mix_code and mapping_id are required" });
                }
            } else {
                if (!rmfp_id) {
                    return res.status(400).json({ success: false, error: "For normal materials, rmfp_id is required" });
                }
            }

            const weightNum = parseFloat(weight);
            if (isNaN(weightNum)) {
                return res.status(400).json({ success: false, error: "Invalid weight value" });
            }

            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(500).json({ success: false, error: "Database connection failed" });
            }

            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // ดึงข้อมูลวัตถุดิบต้นทาง
                let sourceQuery;
                if (isMixed) {
                    sourceQuery = `
                    SELECT 
                        mapping_id, tro_id, rmfp_id, tray_count, batch_id, tro_production_id, process_id, qc_id,
                        weight_RM, level_eu, prep_to_cold_time, cold_time,
                        rework_time, prep_to_pack_time, cold_to_pack_time,
                        rm_status, rm_cold_status, stay_place, dest, 
                        mix_code, prod_mix, allocation_date, removal_date, 
                        status, production_batch, created_by, rmm_line_name, mix_time
                    FROM TrolleyRMMapping
                    WHERE mapping_id = @mapping_id
                `;
                } else {
                    sourceQuery = `
                    SELECT 
                        mapping_id, tro_id, rmfp_id, tray_count, batch_id, tro_production_id, process_id, qc_id,
                        weight_RM, level_eu, prep_to_cold_time, cold_time,
                        rework_time, prep_to_pack_time, cold_to_pack_time,
                        rm_status, rm_cold_status, stay_place, dest, 
                        mix_code, prod_mix, allocation_date, removal_date, 
                        status, production_batch, created_by, rmm_line_name
                    FROM TrolleyRMMapping
                    WHERE tro_id = @source_tro_id AND rmfp_id = @rmfp_id
                `;
                }

                const sourceResult = await new sql.Request(transaction)
                    .input('source_tro_id', source_tro_id)
                    .input('rmfp_id', rmfp_id)
                    .input('mapping_id', mapping_id)
                    .query(sourceQuery);

                if (sourceResult.recordset.length === 0) throw new Error("Source raw material not found");

                const sourceRecord = sourceResult.recordset[0];
                const currentTotalWeight = sourceRecord.weight_RM;
                const existingTrayCount = sourceRecord.tray_count;

                if (currentTotalWeight < weightNum) throw new Error(`Not enough weight available (Available: ${currentTotalWeight}, Requested: ${weightNum})`);

                const weightRatio = weightNum / currentTotalWeight;
                const traysToMove = Math.ceil(existingTrayCount * weightRatio);

                // ดึงข้อมูลประวัติต้นทาง
                const historyResult = await new sql.Request(transaction)
                    .input('mapping_id', sourceRecord.mapping_id)
                    .query(`SELECT come_cold_date, come_cold_date_three, come_cold_date_two, cooked_date, edit_rework, first_prod, location, md_time, mixed_date, name_edit_prod_three, name_edit_prod_two, out_cold_date, out_cold_date_three, out_cold_date_two, prepare_mor_night, qc_date, receiver, receiver_out_cold, receiver_out_cold_three, receiver_out_cold_two, receiver_oven_edit, receiver_pack_edit, receiver_prep_two, receiver_qc, receiver_qc_cold, remark_pack_edit, remark_rework, remark_rework_cold, rework_date, rmit_date, sc_pack_date, three_prod, two_prod, withdraw_date FROM History WHERE mapping_id = @mapping_id`);

                if (historyResult.recordset.length === 0) throw new Error("History record not found for source material");

                const historyData = historyResult.recordset[0];
                const currentDateTime = new Date().toISOString();
                const currentUser = req.user?.username || 'ห้องเย็นผสมวัตถุดิบ';

                // 1. ลดน้ำหนักและจำนวนถาดจากต้นทาง
                const updateSourceResult = await new sql.Request(transaction)
                    .input('source_tro_id', source_tro_id)
                    .input('rmfp_id', rmfp_id)
                    .input('mapping_id', mapping_id)
                    .input('weight', weightNum)
                    .input('trays', traysToMove)
                    .input('updated_at', currentDateTime)
                    .query(`
                    UPDATE TrolleyRMMapping
                    SET 
                        weight_RM  = weight_RM - @weight,
                        tray_count = tray_count - @trays,
                        updated_at = @updated_at
                    WHERE ${isMixed ? 'mapping_id = @mapping_id' : 'tro_id = @source_tro_id AND rmfp_id = @rmfp_id'}
                `);
                if (updateSourceResult.rowsAffected[0] === 0) throw new Error("Failed to update source TrolleyRMMapping");

                // 2. ตรวจสอบว่ามีวัตถุดิบปลายทางแล้วหรือไม่
                let destMappingId;
                if (isMixed) {
                    const checkMixedResult = await new sql.Request(transaction)
                        .input('target_tro_id', target_tro_id)
                        .input('mix_code', mix_code)
                        .query(`SELECT mapping_id FROM TrolleyRMMapping WHERE tro_id = @target_tro_id AND mix_code = @mix_code`);
                    if (checkMixedResult.recordset.length > 0) destMappingId = checkMixedResult.recordset[0].mapping_id;
                } else {
                    const checkNormalResult = await new sql.Request(transaction)
                        .input('target_tro_id', target_tro_id)
                        .input('rmfp_id', rmfp_id)
                        .query(`SELECT mapping_id FROM TrolleyRMMapping WHERE tro_id = @target_tro_id AND rmfp_id = @rmfp_id`);
                    if (checkNormalResult.recordset.length > 0) destMappingId = checkNormalResult.recordset[0].mapping_id;
                }

                if (destMappingId) {
                    // ✅ มีอยู่แล้ว → แค่ UPDATE
                    const updateDestResult = await new sql.Request(transaction)
                        .input('mapping_id', destMappingId)
                        .input('weight', weightNum)
                        .input('trays', traysToMove)
                        .input('updated_at', currentDateTime)
                        .query(`
                        UPDATE TrolleyRMMapping
                        SET weight_RM  = weight_RM + @weight,
                            tray_count = tray_count + @trays,
                            updated_at = @updated_at
                        WHERE mapping_id = @mapping_id
                    `);
                    if (updateDestResult.rowsAffected[0] === 0) throw new Error("Failed to update destination TrolleyRMMapping");

                    const updateHistoryResult = await new sql.Request(transaction)
                        .input('mapping_id', destMappingId)
                        .input('weight', weightNum)
                        .input('trays', traysToMove)
                        .input('updated_at', currentDateTime)
                        .query(`
                        UPDATE History
                        SET weight_RM  = weight_RM + @weight,
                            tray_count = tray_count + @trays,
                            updated_at = @updated_at
                        WHERE mapping_id = @mapping_id
                    `);
                    if (updateHistoryResult.rowsAffected[0] === 0) throw new Error("Failed to update destination History");

                } else {
                    // ✅ ยังไม่มี → INSERT ใหม่
                    const insertResult = await new sql.Request(transaction)
                        .input('target_tro_id', target_tro_id)
                        .input('rmfp_id', rmfp_id)
                        .input('batch_id', sourceRecord.batch_id)
                        .input('tro_production_id', sourceRecord.tro_production_id)
                        .input('process_id', sourceRecord.process_id)
                        .input('qc_id', sourceRecord.qc_id)
                        .input('tray_count', traysToMove)
                        .input('weight_RM', weightNum)
                        .input('level_eu', sourceRecord.level_eu)
                        .input('prep_to_cold_time', sourceRecord.prep_to_cold_time)
                        .input('cold_time', sourceRecord.cold_time)
                        .input('prep_to_pack_time', sourceRecord.prep_to_pack_time)
                        .input('cold_to_pack_time', sourceRecord.cold_to_pack_time)
                        .input('mix_time', sourceRecord.mix_time)
                        .input('rework_time', sourceRecord.rework_time)
                        .input('rm_status', sourceRecord.rm_status)
                        .input('rm_cold_status', sourceRecord.rm_cold_status)
                        .input('stay_place', sourceRecord.stay_place)
                        .input('dest', sourceRecord.dest)
                        .input('mix_code', sourceRecord.mix_code)
                        .input('prod_mix', sourceRecord.prod_mix)
                        .input('allocation_date', currentDateTime)
                        .input('status', 1)
                        .input('production_batch', sourceRecord.production_batch)
                        .input('created_by', currentUser)
                        .input('created_at', currentDateTime)
                        .input('rmm_line_name', sourceRecord.rmm_line_name)
                        .input('tl_status', '1.1')
                        .query(`
                        INSERT INTO TrolleyRMMapping (
                            tro_id, rmfp_id, batch_id, tro_production_id, process_id, 
                            qc_id, tray_count, weight_RM, level_eu, 
                            prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time,
                            mix_time, rework_time, rm_status, rm_cold_status, 
                            stay_place, dest, mix_code, prod_mix, allocation_date, 
                            status, production_batch, created_by, created_at, tl_status, rmm_line_name
                        )
                        OUTPUT INSERTED.mapping_id
                        VALUES (
                            @target_tro_id, @rmfp_id, @batch_id, @tro_production_id, @process_id, 
                            @qc_id, @tray_count, @weight_RM, @level_eu, 
                            @prep_to_cold_time, @cold_time, @prep_to_pack_time, @cold_to_pack_time,
                            @mix_time, @rework_time, @rm_status, @rm_cold_status, 
                            @stay_place, @dest, @mix_code, @prod_mix, @allocation_date, 
                            @status, @production_batch, @created_by, @created_at, @tl_status, @rmm_line_name
                        )
                    `);
                    if (!insertResult.recordset[0]?.mapping_id) throw new Error("Failed to insert destination TrolleyRMMapping");

                    destMappingId = insertResult.recordset[0].mapping_id;

                    // INSERT History
                    await new sql.Request(transaction)
                        .input('mapping_id', destMappingId)
                        .input('withdraw_date', historyData.withdraw_date)
                        .input('cooked_date', historyData.cooked_date)
                        .input('rmit_date', historyData.rmit_date)
                        .input('qc_date', historyData.qc_date)
                        .input('come_cold_date', historyData.come_cold_date)
                        .input('out_cold_date', historyData.out_cold_date)
                        .input('come_cold_date_two', historyData.come_cold_date_two)
                        .input('out_cold_date_two', historyData.out_cold_date_two)
                        .input('come_cold_date_three', historyData.come_cold_date_three)
                        .input('out_cold_date_three', historyData.out_cold_date_three)
                        .input('mixed_date', historyData.mixed_date)
                        .input('sc_pack_date', historyData.sc_pack_date)
                        .input('rework_date', historyData.rework_date)
                        .input('receiver', historyData.receiver)
                        .input('receiver_prep_two', historyData.receiver_prep_two)
                        .input('receiver_qc', historyData.receiver_qc)
                        .input('receiver_out_cold', historyData.receiver_out_cold)
                        .input('receiver_out_cold_two', historyData.receiver_out_cold_two)
                        .input('receiver_out_cold_three', historyData.receiver_out_cold_three)
                        .input('receiver_oven_edit', historyData.receiver_oven_edit)
                        .input('receiver_pack_edit', historyData.receiver_pack_edit)
                        .input('remark_pack_edit', historyData.remark_pack_edit)
                        .input('location', historyData.location)
                        .input('tray_count', traysToMove)
                        .input('weight_RM', weightNum)
                        .input('md_time', historyData.md_time)
                        .input('tro_id', sql.VarChar, target_tro_id)
                        .input('rmm_line_name', sourceRecord.rmm_line_name)
                        .input('dest', sourceRecord.dest)
                        .input('name_edit_prod_two', historyData.name_edit_prod_two)
                        .input('name_edit_prod_three', historyData.name_edit_prod_three)
                        .input('first_prod', historyData.first_prod)
                        .input('two_prod', historyData.two_prod)
                        .input('three_prod', historyData.three_prod)
                        .input('receiver_qc_cold', historyData.receiver_qc_cold)
                        .input('remark_rework', historyData.remark_rework)
                        .input('remark_rework_cold', historyData.remark_rework_cold)
                        .input('edit_rework', historyData.edit_rework)
                        .input('prepare_mor_night', historyData.prepare_mor_night)
                        .query(`
                        INSERT INTO History (
                            mapping_id, withdraw_date, cooked_date, rmit_date, qc_date, 
                            come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two, 
                            come_cold_date_three, out_cold_date_three, mixed_date, sc_pack_date, rework_date, 
                            receiver, receiver_prep_two, receiver_qc, receiver_out_cold, 
                            receiver_out_cold_two, receiver_out_cold_three, receiver_oven_edit, 
                            receiver_pack_edit, remark_pack_edit, location, tray_count, weight_RM, 
                            md_time, tro_id, rmm_line_name, dest, name_edit_prod_two, name_edit_prod_three, 
                            first_prod, two_prod, three_prod, receiver_qc_cold, remark_rework, 
                            remark_rework_cold, edit_rework, prepare_mor_night, created_at
                        )
                        VALUES (
                            @mapping_id, @withdraw_date, @cooked_date, @rmit_date, @qc_date, 
                            @come_cold_date, @out_cold_date, @come_cold_date_two, @out_cold_date_two, 
                            @come_cold_date_three, @out_cold_date_three, @mixed_date, @sc_pack_date, @rework_date, 
                            @receiver, @receiver_prep_two, @receiver_qc, @receiver_out_cold, 
                            @receiver_out_cold_two, @receiver_out_cold_three, @receiver_oven_edit, 
                            @receiver_pack_edit, @remark_pack_edit, @location, @tray_count, @weight_RM, 
                            @md_time, @tro_id, @rmm_line_name, @dest, @name_edit_prod_two, @name_edit_prod_three, 
                            @first_prod, @two_prod, @three_prod, @receiver_qc_cold, @remark_rework, 
                            @remark_rework_cold, @edit_rework, @prepare_mor_night, GETDATE()
                        )
                    `);

                    // INSERT Batch (คัดลอกจาก source)
                    const sourceBatchResult = await new sql.Request(transaction)
                        .input('source_mapping_id', sourceRecord.mapping_id)
                        .query(`SELECT batch_after, batch_before FROM Batch WHERE mapping_id = @source_mapping_id`);

                    if (sourceBatchResult.recordset.length > 0) {
                        for (const batch of sourceBatchResult.recordset) {
                            await new sql.Request(transaction)
                                .input('mapping_id', destMappingId)
                                .input('batch_after', batch.batch_after)
                                .input('batch_before', batch.batch_before)
                                .query(`
                                INSERT INTO Batch (mapping_id, batch_after, batch_before)
                                VALUES (@mapping_id, @batch_after, @batch_before)
                            `);
                        }
                        debugLog(`✅ คัดลอก ${sourceBatchResult.recordset.length} batch records ไปยัง mapping ใหม่: ${destMappingId}`);
                    }

                    // ✅ ดึง mat แล้ว INSERT ลง Mat
                    const matResult = await new sql.Request(transaction)
                        .input('mapping_id', destMappingId)
                        .query(`
                        SELECT
                            rmm.mapping_id,
                            rm.mat
                        FROM TrolleyRMMapping rmm
                        JOIN RMForProd  rmf ON rmm.rmfp_id          = rmf.rmfp_id
                        JOIN ProdRawMat pr  ON rmm.tro_production_id = pr.prod_rm_id
                        JOIN RawMat     rm  ON pr.mat                = rm.mat
                        WHERE rmm.mapping_id = @mapping_id
                    `);

                    if (matResult.recordset.length > 0) {
                        const mat = matResult.recordset[0].mat;

                        await new sql.Request(transaction)
                            .input('mapping_id', destMappingId)
                            .input('mat', mat)
                            .input('mat_2x', mat)
                            .query(`
                            INSERT INTO Mat (mapping_id, mat, mat_2x)
                            VALUES (@mapping_id, @mat, @mat_2x)
                        `);

                        debugLog(`✅ Insert Mat สำเร็จ mapping_id: ${destMappingId}, mat: ${mat}`);
                    } else {
                        console.warn(`⚠️ ไม่พบ mat สำหรับ mapping_id: ${destMappingId}`);
                    }
                }

                // ตรวจสอบ source หลังโอน
                const checkSourceResult = await new sql.Request(transaction)
                    .input('source_tro_id', source_tro_id)
                    .query(`
                    SELECT COUNT(*) AS item_count, SUM(weight_RM) AS total_weight
                    FROM TrolleyRMMapping
                    WHERE tro_id = @source_tro_id
                `);
                const sourceTotalWeight = checkSourceResult.recordset[0]?.total_weight || 0;

                const checkZeroWeightItems = await new sql.Request(transaction)
                    .input('source_tro_id', source_tro_id)
                    .query(`
                    SELECT mapping_id FROM TrolleyRMMapping
                    WHERE tro_id = @source_tro_id AND weight_RM = 0
                `);

                if (checkZeroWeightItems.recordset.length > 0) {
                    await new sql.Request(transaction)
                        .input('source_tro_id', source_tro_id)
                        .input('removal_date', currentDateTime)
                        .query(`
                        UPDATE TrolleyRMMapping
                        SET removal_date = @removal_date,
                            tro_id       = NULL,
                            status       = '9788',
                            tl_status    = '1411'
                        WHERE tro_id = @source_tro_id AND weight_RM = 0
                    `);
                }

                const remainingItemsResult = await new sql.Request(transaction)
                    .input('source_tro_id', source_tro_id)
                    .query(`
                    SELECT COUNT(*) AS remaining_items
                    FROM TrolleyRMMapping
                    WHERE tro_id = @source_tro_id AND weight_RM > 0
                `);
                const remainingItems = remainingItemsResult.recordset[0]?.remaining_items || 0;

                if (remainingItems === 0 && sourceTotalWeight === 0) {
                    await new sql.Request(transaction)
                        .input('source_tro_id', source_tro_id)
                        .query(`UPDATE Slot SET tro_id = NULL, status = '1428' WHERE tro_id = @source_tro_id`);
                    await new sql.Request(transaction)
                        .input('source_tro_id', source_tro_id)
                        .query(`UPDATE Trolley SET tro_status = '1', status = '1.7' WHERE tro_id = @source_tro_id`);
                }

                await transaction.commit();

                res.json({
                    success: true,
                    message: "Raw material added successfully",
                    data: {
                        source_tro_id,
                        target_tro_id,
                        moved_weight: weightNum,
                        moved_trays: traysToMove,
                        dest_mapping_id: destMappingId,
                        source_remaining_items: remainingItems,
                        zero_weight_items_updated: checkZeroWeightItems.recordset.length
                    }
                });

            } catch (error) {
                await safeRollback(transaction);
                console.error("Transaction error:", error);
                res.status(500).json({ success: false, error: error.message });
            }
        } catch (error) {
            console.error("Error in addRawMatToTrolley:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // router.get("/coldstorage/fetchTrolleyMaterials", async (req, res) => {
    //     try {
    //         const { tro_id } = req.query;
    //         if (!tro_id) return res.status(400).json({ success: false, error: "tro_id is required" });

    //         const pool = await connectToDatabase();

    //         // วัตถุดิบปกติ
    //         const normalMaterialsQuery = `
    //        SELECT 
    //             t.tro_id,
    //             rmm.mapping_id,
    //             rmm.rmfp_id,
    //             0 AS isMixed,
    //             NULL AS mix_code,
    //             COALESCE(b.batch_after, rmf.batch) AS batch,
    //             FORMAT(rmm.prep_to_cold_time, 'N2') AS ptc_time,
    //             FORMAT(rmg.prep_to_cold, 'N2') AS standard_ptc,
    //             rm.mat_name AS materialName,
    //             rm.mat,
    //             rmm.weight_RM,
    //             rmm.tray_count,
    //             rmm.level_eu,
    //             h.come_cold_date,
    //             rmm.rm_status,
    //             CONCAT(p.doc_no, '(', rmm.rmm_line_name, ')') AS production,
    //             FORMAT(COALESCE(rmm.cold_time, rmg.cold), 'N2') AS cold,
    //             h.cooked_date,
    //             h.rmit_date,
    //             h.come_cold_date_two,
    //             h.come_cold_date_three,
    //             q.qccheck,
    //             q.mdcheck,
    //             q.defectcheck,
    //             q.defect_remark,
    //             h.qccheck_cold,
    //             q.md_remark,
    //             q.sq_remark,
    //             h.remark_rework,
    //             CONCAT(q.WorkAreaCode, '-', mwa.WorkAreaName, '/', q.md_no) AS machine_MD,
    //             h.receiver_qc_cold,
    //             h.remark_rework_cold,
    //             h.withdraw_date,
    //             h.first_prod,
    //             h.two_prod,
    //             h.three_prod,
    //             h.name_edit_prod_two,
    //             h.name_edit_prod_three,
    // 			pr.process_name
    //         FROM Trolley t
    //         JOIN TrolleyRMMapping rmm ON t.tro_id = rmm.tro_id
    //         JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
    //         JOIN ProdRawMat prm ON prm.prod_rm_id = rmm.tro_production_id
    //         JOIN RawMat rm ON rm.mat = prm.mat
    //         JOIN batch b ON rmm.batch_id = b.batch_id
    //         JOIN Production p ON p.prod_id = prm.prod_id
    //         JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
    //         JOIN History h ON rmm.mapping_id = h.mapping_id
    //         JOIN QC q ON rmm.qc_id = q.qc_id
    //         JOIN WorkAreas mwa ON q.WorkAreaCode = mwa.WorkAreaCode
    // 		JOIN Process pr ON rmm.process_id = pr.process_id
    //         WHERE t.tro_id = @tro_id
    //           AND rmm.dest = 'ห้องเย็น'
    //           AND rmm.mix_code IS NULL
    //     `;

    //         // วัตถุดิบผสม
    //         const mixedMaterialsQuery = `
    //         SELECT
    //             t.tro_id,
    //             rmm.mapping_id,
    //             rmm.rmfp_id,
    //             1 AS isMixed,
    //             rmm.mix_code,
    //             NULL AS batch,
    //             CONCAT('Mixed: ', rmm.mix_code) AS mat_name,
    //             rmm.mix_code AS mat,
    //             rmm.weight_RM,
    //             rmm.tray_count,
    //             h.come_cold_date,
    //             rmm.rm_status,
    //             CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
    //             NULL AS ptc_time,
    //             NULL AS cold,
    //             NULL AS cooked_date,
    //             NULL AS rmit_date,
    //             h.come_cold_date_two,
    //             h.come_cold_date_three,
    //             h.withdraw_date
    //         FROM Trolley t
    //         JOIN TrolleyRMMapping rmm ON t.tro_id = rmm.tro_id
    //         JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
    //         JOIN Production p ON rmm.prod_mix = p.prod_id
    //         JOIN History h ON rmm.mapping_id = h.mapping_id
    //         WHERE t.tro_id = @tro_id 
    //           AND rmm.dest = 'ห้องเย็น'
    //           AND rmm.mix_code IS NOT NULL
    //     `;

    //         const [normalResult, mixedResult] = await Promise.all([
    //             pool.request().input('tro_id', tro_id).query(normalMaterialsQuery),
    //             pool.request().input('tro_id', tro_id).query(mixedMaterialsQuery)
    //         ]);

    //         // ส่งค่าตรง ๆ จากฐานข้อมูล ไม่แปลงเวลา
    //         const combinedData = [
    //             ...normalResult.recordset,
    //             ...mixedResult.recordset
    //         ];

    //         res.json({ success: true, tro_id, materials: combinedData });

    //     } catch (error) {
    //         console.error('Error fetching trolley materials:', error);
    //         res.status(500).json({ success: false, error: error.message });
    //     }
    // });




    // ฟังก์ชันช่วยสำหรับแปลงรูปแบบวันที่

    router.get("/coldstorage/fetchTrolleyMaterials", async (req, res) => {
        try {
            const { tro_id } = req.query;
            if (!tro_id) {
                return res.status(400).json({ success: false, error: "tro_id is required" });
            }

            const pool = await connectToDatabase();

            // 🔹 วัตถุดิบปกติ
            const normalMaterialsQuery = `
            SELECT 
                t.tro_id,
                rmm.mapping_id,
                rmm.rmfp_id,
                0 AS isMixed,
                NULL AS mix_code,
                COALESCE(b.batch_after, rmf.batch) AS batch,
                FORMAT(rmm.prep_to_cold_time, 'N2') AS ptc_time,
                FORMAT(rmg.prep_to_cold, 'N2') AS standard_ptc,
                rm.mat_name AS materialName,
                rm.mat,
                rmm.weight_RM,
                rmm.tray_count,
                rmm.level_eu,
                h.come_cold_date,
                rmm.rm_status,
                CONCAT(p.doc_no, '(', rmm.rmm_line_name, ')') AS production,
                FORMAT(COALESCE(rmm.cold_time, rmg.cold), 'N2') AS cold,
                h.cooked_date,
                h.rmit_date,
                h.come_cold_date_two,
                h.come_cold_date_three,
                q.qccheck,
                q.mdcheck,
                q.defectcheck,
                q.defect_remark,
                h.qccheck_cold,
                q.md_remark,
                q.sq_remark,
                h.remark_rework,
                CONCAT(q.WorkAreaCode, '-', mwa.WorkAreaName, '/', q.md_no) AS machine_MD,
                h.receiver_qc_cold,
                h.remark_rework_cold,
                h.withdraw_date,
                h.first_prod,
                h.two_prod,
                h.three_prod,
                h.name_edit_prod_two,
                h.name_edit_prod_three,
                pr.process_name,
                q.general_remark
            FROM Trolley t
            JOIN TrolleyRMMapping rmm ON t.tro_id = rmm.tro_id
            JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
            JOIN ProdRawMat prm ON prm.prod_rm_id = rmm.tro_production_id
            JOIN RawMat rm ON rm.mat = prm.mat
            LEFT JOIN batch b ON rmm.batch_id = b.batch_id
            JOIN Production p ON p.prod_id = prm.prod_id
            JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
            LEFT JOIN History h ON rmm.mapping_id = h.mapping_id
            LEFT JOIN QC q ON rmm.qc_id = q.qc_id
            LEFT JOIN WorkAreas mwa ON q.WorkAreaCode = mwa.WorkAreaCode
            JOIN Process pr ON rmm.process_id = pr.process_id
            WHERE t.tro_id = @tro_id
              AND rmm.dest = 'ห้องเย็น'
              AND (rmm.mix_code IS NULL OR rmm.mix_code = '0')

        `;

            // 🔹 วัตถุดิบผสม
            const mixedMaterialsQuery = `
            SELECT
                t.tro_id,
                rmm.mapping_id,
                rmm.rmfp_id,
                1 AS isMixed,
                rmm.mix_code,
                NULL AS batch,
                CONCAT('Mixed: ', rmm.mix_code) AS mat_name,
                rmm.mix_code AS mat,
                rmm.weight_RM,
                rmm.tray_count,
                h.come_cold_date,
                rmm.rm_status,
                CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
                NULL AS ptc_time,
                NULL AS cold,
                NULL AS cooked_date,
                NULL AS rmit_date,
                h.come_cold_date_two,
                h.come_cold_date_three,
                h.withdraw_date
            FROM Trolley t
            JOIN TrolleyRMMapping rmm ON t.tro_id = rmm.tro_id
            JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
            JOIN Production p ON rmm.prod_mix = p.prod_id
            LEFT JOIN History h ON rmm.mapping_id = h.mapping_id
            WHERE t.tro_id = @tro_id 
              AND rmm.dest = 'ห้องเย็น'
              AND rmm.mix_code IS NOT NULL
        `;

            // 🔄 Query ทั้ง normal และ mixed พร้อมกัน
            const [normalResult, mixedResult] = await Promise.all([
                pool.request().input('tro_id', sql.VarChar, tro_id).query(normalMaterialsQuery),
                pool.request().input('tro_id', sql.VarChar, tro_id).query(mixedMaterialsQuery)
            ]);

            // 🧩 รวมข้อมูล
            const combinedData = [
                ...normalResult.recordset,
                ...mixedResult.recordset
            ];

            res.json({ success: true, tro_id, materials: combinedData });

        } catch (error) {
            console.error('❌ Error fetching trolley materials:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });


    function formatMaterialDates(item) {
        // แปลง cooked_date เป็น CookedDateTime
        if (item.cooked_date) {
            const date = new Date(item.cooked_date);
            item.CookedDateTime = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
        } else {
            item.CookedDateTime = null;
        }

        // แปลง rmit_date เป็น RawmatTransForm
        if (item.rmit_date) {
            const date = new Date(item.rmit_date);
            item.RawmatTransForm = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
        } else {
            item.RawmatTransForm = null;
        }

        return item;
    }




    router.get("/coldstorage/export/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
   SELECT
    rmm.mapping_id,
    rmf.rmfp_id,
    b.batch_before AS batch_before,
    COALESCE(b.batch_after, rmf.batch) AS batch,
    rmm.mix_code,
    rm.mat,
    m.mat_2x,
    rm.mat_name,
    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(rmg.prep_to_cold AS DECIMAL(10,2)) AS standard_ptc,

    CAST(rmm.rework_time AS DECIMAL(10,2)) AS remaining_rework_time,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework_time,

    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.level_eu,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.rmm_line_name,

    s.slot_id,
    rmm.dest,
    rmm.weight_RM,
    rmm.tray_count,

    q.sq_remark,
    q.md_remark,
    q.defect_remark,
    q.qccheck,
    q.mdcheck,
    q.defectcheck,
    q.sq_acceptance,
    q.defect_acceptance,

    htr.first_prod,
    htr.two_prod,
    htr.three_prod,
    htr.name_edit_prod_two,
    htr.name_edit_prod_three,
    htr.remark_rework,
    htr.edit_rework,
    htr.remark_rework_cold,
    htr.receiver_qc_cold,
    htr.qccheck_cold,
    htr.prepare_mor_night,

    CONCAT(
        COALESCE(q.WorkAreaCode, ''),
        CASE 
            WHEN q.WorkAreaCode IS NOT NULL 
                 AND mwa.WorkAreaName IS NOT NULL
            THEN CONCAT('-', mwa.WorkAreaName, '/', q.md_no)
            ELSE ''
        END
    ) AS machine_MD,

    CONVERT(VARCHAR, htr.cooked_date, 120) AS cooked_date,
    CONVERT(VARCHAR, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(VARCHAR, htr.rmit_date, 120) AS rmit_date,
    CONVERT(VARCHAR, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(VARCHAR, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(VARCHAR, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(VARCHAR, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(VARCHAR, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(VARCHAR, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(VARCHAR, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(VARCHAR, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(VARCHAR, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(VARCHAR, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(VARCHAR, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(VARCHAR, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(VARCHAR, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(VARCHAR, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(VARCHAR, htr.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
    CONVERT(VARCHAR, htr.cs_out_out_date_five, 120) AS cs_out_out_date_five,
    CONVERT(VARCHAR, htr.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
    CONVERT(VARCHAR, htr.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
    CONVERT(VARCHAR, htr.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
    CONVERT(VARCHAR, htr.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
    CONVERT(VARCHAR, htr.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
    CONVERT(VARCHAR, htr.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
    CONVERT(VARCHAR, htr.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
    CONVERT(VARCHAR, htr.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
    CONVERT(VARCHAR, htr.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
    CONVERT(VARCHAR, htr.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
ON rmm.rmfp_id = rmf.rmfp_id

LEFT JOIN Batch b
ON rmm.mapping_id = b.mapping_id

JOIN ProdRawMat pr
ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
ON pr.mat = rm.mat

JOIN Production p
ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
ON rmf.rm_group_id = rmg.rm_group_id

LEFT JOIN Slot s
ON rmm.tro_id = s.tro_id

JOIN History htr
ON rmm.mapping_id = htr.mapping_id

LEFT JOIN Qc q
ON rmm.qc_id = q.qc_id

LEFT JOIN WorkAreas mwa
ON q.WorkAreaCode = mwa.WorkAreaCode

JOIN Mat m
ON rmm.mapping_id = m.mapping_id

WHERE
    rmm.dest = 'ห้องเย็น'
    AND rmm.stay_place = 'เข้าห้องเย็น'
    AND rmm.tro_id IS NOT NULL
	

ORDER BY 
    rmm.mapping_id DESC
    `);

            const formattedData = result.recordset.map(item => {
                debugLog("item:", item);
                return item;
            });

            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/coldstorages/export/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
    SELECT
    rmm.mapping_id,
    rmf.rmfp_id,
    b.batch_before AS batch_before,
    COALESCE(b.batch_after, rmf.batch) AS batch,
    rmm.mix_code,
    rm.mat,
    rm.mat_name,
    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(rmg.prep_to_cold AS DECIMAL(10,2)) AS standard_ptc,

    CAST(rmm.rework_time AS DECIMAL(10,2)) AS remaining_rework_time,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework_time,

    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.level_eu,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.rmm_line_name,

    s.slot_id,
    rmm.dest,
    rmm.weight_RM,
    rmm.tray_count,

    q.sq_remark,
    q.md_remark,
    q.defect_remark,
    q.qccheck,
    q.mdcheck,
    q.defectcheck,
    q.sq_acceptance,
    q.defect_acceptance,

    htr.first_prod,
    htr.two_prod,
    htr.three_prod,
    htr.name_edit_prod_two,
    htr.name_edit_prod_three,
    htr.remark_rework,
    htr.edit_rework,
    htr.remark_rework_cold,
    htr.receiver_qc_cold,
    htr.qccheck_cold,
    htr.prepare_mor_night,

    CONCAT(
        COALESCE(q.WorkAreaCode, ''),
        CASE 
            WHEN q.WorkAreaCode IS NOT NULL 
                 AND mwa.WorkAreaName IS NOT NULL
            THEN CONCAT('-', mwa.WorkAreaName, '/', q.md_no)
            ELSE ''
        END
    ) AS machine_MD,

    CONVERT(VARCHAR, htr.cooked_date, 120) AS cooked_date,
    CONVERT(VARCHAR, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(VARCHAR, htr.rmit_date, 120) AS rmit_date,
    CONVERT(VARCHAR, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(VARCHAR, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(VARCHAR, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(VARCHAR, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(VARCHAR, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(VARCHAR, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(VARCHAR, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(VARCHAR, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(VARCHAR, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(VARCHAR, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(VARCHAR, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(VARCHAR, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(VARCHAR, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(VARCHAR, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(VARCHAR, htr.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
    CONVERT(VARCHAR, htr.cs_out_out_date_five, 120) AS cs_out_out_date_five,
    CONVERT(VARCHAR, htr.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
    CONVERT(VARCHAR, htr.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
    CONVERT(VARCHAR, htr.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
    CONVERT(VARCHAR, htr.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
    CONVERT(VARCHAR, htr.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
    CONVERT(VARCHAR, htr.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
    CONVERT(VARCHAR, htr.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
    CONVERT(VARCHAR, htr.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
    CONVERT(VARCHAR, htr.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
    CONVERT(VARCHAR, htr.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
ON rmm.rmfp_id = rmf.rmfp_id

LEFT JOIN Batch b
ON rmm.mapping_id = b.mapping_id

JOIN ProdRawMat pr
ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
ON pr.mat = rm.mat

JOIN Production p
ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
ON rmf.rm_group_id = rmg.rm_group_id

LEFT JOIN Slot s
ON rmm.tro_id = s.tro_id

JOIN History htr
ON rmm.mapping_id = htr.mapping_id

LEFT JOIN Qc q
ON rmm.qc_id = q.qc_id

LEFT JOIN WorkAreas mwa
ON q.WorkAreaCode = mwa.WorkAreaCode

WHERE
    rmm.dest = 'ในห้องเย็นใหญ่'
    AND rmm.stay_place = 'เข้าห้องเย็นใหญ่'
    AND rmm.tro_id IS NOT NULL
	

ORDER BY 
    rmm.mapping_id DESC
    `);

            const formattedData = result.recordset.map(item => {
                debugLog("item:", item);
                return item;
            });

            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/coldstorage/mix/export/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
                SELECT
                    rmm.mapping_id,
                    rmm.tro_id,
                    s.slot_id,
                    rmm.tray_count,
                    rmm.weight_RM,
                    rmm.rm_status,
                    rmm.rm_cold_status,
                    rmm.stay_place,
                    rmm.dest,
                    rmm.mix_code,
                    rmm.prod_mix,
                    rmm.mix_time,
                    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
                    rmm.rmm_line_name,
                    p.code,
                    CONVERT(VARCHAR, htr.mixed_date, 120) AS mixed_date,
                    CONVERT(VARCHAR, htr.come_cold_date, 120) AS come_cold_date,
                    CONVERT(VARCHAR, htr.come_cold_date_two, 120) AS come_cold_date_two,
                    CONVERT(VARCHAR, htr.come_cold_date_three, 120) AS come_cold_date_three

                FROM
                    TrolleyRMMapping rmm
                JOIN 
                    Production p ON rmm.prod_mix = p.prod_id
                JOIN 
                    History htr ON rmm.mapping_id = htr.mapping_id
                JOIN
                    Slot s ON rmm.tro_id = s.tro_id
                WHERE 
                    rmm.dest = 'ห้องเย็น'
                    AND rmm.stay_place = 'เข้าห้องเย็น'
                    AND rmm.tro_id IS NOT NULL
                    AND rmm.mix_code IS NOT NULL;
          `);

            const formattedData = result.recordset.map(item => {
                debugLog("item :", item);
                return item;
            });


            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.put("/coldstorage/outcoldstorage", async (req, res) => {
        try {
            debugLog("Raw Request Body:", req.body);

            const {
                tro_id, slot_id, rm_cold_status, rm_status,
                dest, operator, materials, storage_purpose,
                deposit_days, cold_remark
            } = req.body;

            if (!tro_id || !slot_id || !rm_status || !dest || !materials) {
                console.warn("Missing fields:", { tro_id, slot_id, rm_status, dest, materials });
                return res.status(400).json({ error: "Missing required fields" });
            }

            const pool = await connectToDatabase();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // ── 1. อัปเดตสถานะของ slot ────────────────────────────────────────────
                const updateSlotResult = await new sql.Request(transaction)
                    .input("tro_id", sql.VarChar, tro_id)
                    .query(`
                    UPDATE Slot
                    SET tro_id = NULL, status = '1791'
                    WHERE tro_id = @tro_id;
                `);

                if (updateSlotResult.rowsAffected[0] === 0) {
                    throw new Error(`Slot update failed for slot_id ${slot_id}`);
                }

                // ── 2. วนลูปแต่ละ material ─────────────────────────────────────────────
                for (const material of materials) {
                    const { mapping_id, remaining_rework_time, cold, mix_time } = material;

                    // ✅ histamine แยกแต่ละ mapping_id
                    const histamineValue = (material.histamine != null && material.histamine !== "")
                        ? parseFloat(material.histamine) : null;

                    debugLog(`📦 mapping_id: ${mapping_id}, histamine: ${histamineValue}, storage_purpose: ${storage_purpose}`);

                    // ── ดึง cold_to_pack ─────────────────────────────────────────────
                    const rmDataResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .query(`
                        SELECT rmg.cold_to_pack, rmm.cold_to_pack_time
                        FROM TrolleyRMMapping rmm
                        JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                        JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                        WHERE rmm.mapping_id = @mapping_id
                    `);

                    if (rmDataResult.recordset.length === 0) {
                        throw new Error(`Raw material not found for mapping_id: ${mapping_id}`);
                    }

                    let cold_to_pack_time = rmDataResult.recordset[0].cold_to_pack_time
                        ?? rmDataResult.recordset[0].cold_to_pack;

                    // ── อัปเดต TrolleyRMMapping ──────────────────────────────────────
                    let updateQuery = `
                    UPDATE TrolleyRMMapping
                    SET dest              = @dest,
                        rm_cold_status    = NULL,
                        stay_place        = @stay_place,
                        cold_to_pack_time = @cold_to_pack_time
                `;

                    if (mix_time !== null && mix_time !== undefined) {
                        updateQuery += `, mix_time = @mix_time`;
                    } else if (remaining_rework_time !== null && remaining_rework_time !== undefined) {
                        updateQuery += `, rework_time = @rework_delay_time`;
                    } else {
                        updateQuery += `, cold_time = @cold`;
                    }

                    if (dest === 'บรรจุ' || dest === 'จุดเตรียม') {
                        updateQuery += `, tro_id = NULL`;
                    }

                    const updateRmResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .input("rm_cold_status", rm_cold_status)
                        .input("dest", sql.VarChar, dest)
                        .input("mix_time", mix_time)
                        .input("rework_delay_time", material.rework_delay_time)
                        .input("cold", cold)
                        .input("stay_place", 'ออกห้องเย็น')
                        .input("cold_to_pack_time", cold_to_pack_time)
                        .query(updateQuery + ` WHERE mapping_id = @mapping_id;`);

                    if (updateRmResult.rowsAffected[0] === 0) {
                        throw new Error(`Failed to update TrolleyRMMapping for mapping_id ${mapping_id}`);
                    }

                    // ── อัปเดต Trolley status ────────────────────────────────────────
                    if (dest === 'จุดเตรียม' || dest === 'บรรจุ') {
                        await new sql.Request(transaction)
                            .input("tro_id", sql.VarChar, tro_id)
                            .query(`UPDATE Trolley SET tro_status = 1 WHERE tro_id = @tro_id;`);
                    }

                    // ── ดึงข้อมูลล่าสุดหลัง update ──────────────────────────────────
                    const updatedRmDataResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .query(`
                        SELECT cold_to_pack_time, mix_time, rework_time
                        FROM TrolleyRMMapping
                        WHERE mapping_id = @mapping_id
                    `);
                    const updatedRmData = updatedRmDataResult.recordset[0];

                    // ── อัปเดต History ───────────────────────────────────────────────
                    let historyUpdateQuery = `
                    UPDATE History
                    SET
                        out_cold_date = CASE
                            WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL
                            THEN GETDATE() ELSE out_cold_date END,

                        out_cold_date_two = CASE
                            WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL
                            THEN GETDATE() ELSE out_cold_date_two END,

                        out_cold_date_three = CASE
                            WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL
                            THEN GETDATE() ELSE out_cold_date_three END,

                        receiver_out_cold = CASE
                            WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL
                            THEN @operator ELSE receiver_out_cold END,

                        receiver_out_cold_two = CASE
                            WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL
                            THEN @operator ELSE receiver_out_cold_two END,

                        receiver_out_cold_three = CASE
                            WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL
                            THEN @operator ELSE receiver_out_cold_three END,

                        cold_to_pack_time = @cold_to_pack_time,
                        mix_time          = @mix_time,
                        rework_time       = @rework_time,
                        cold_dest         = @dest
                `;

                    // ✅ pack_checkin_date เฉพาะ dest = 'บรรจุ'
                    if (dest === 'บรรจุ') {
                        historyUpdateQuery += `, pack_checkin_date = GETDATE()`;
                    }

                    // ── ดึงสถานะรอบปัจจุบันเพื่อเลือก column ที่จะ update ──────────
                    const roundCheckResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .query(`
                            SELECT TOP 1
                                come_cold_date, out_cold_date,
                                come_cold_date_two, out_cold_date_two,
                                come_cold_date_three, out_cold_date_three
                            FROM History
                            WHERE mapping_id = @mapping_id
                            ORDER BY hist_id DESC
                        `);

                    let currentRound = 1;
                    if (roundCheckResult.recordset.length > 0) {
                        const h = roundCheckResult.recordset[0];
                        if (h.come_cold_date_three && !h.out_cold_date_three) currentRound = 3;
                        else if (h.come_cold_date_two && !h.out_cold_date_two) currentRound = 2;
                        else currentRound = 1;
                    }

                    // ── สร้าง historyExtra ตามรอบ ─────────────────────────────────
                    let historyExtra = "";

                    const histReq = new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .input("operator", sql.NVarChar, operator)
                        .input("dest", sql.VarChar, dest)
                        .input("cold_to_pack_time", updatedRmData.cold_to_pack_time)
                        .input("mix_time", updatedRmData.mix_time)
                        .input("rework_time", updatedRmData.rework_time);

                    const spField = currentRound === 3 ? 'at_pd_storage_purpose_3'
                        : currentRound === 2 ? 'at_pd_storage_purpose_2'
                            : 'at_pd_storage_purpose';
                    const hField = currentRound === 3 ? 'at_pd_histamine_3'
                        : currentRound === 2 ? 'at_pd_histamine_2'
                            : 'at_pd_histamine';
                    const ddField = currentRound === 3 ? 'at_pd_deposit_date_3'
                        : currentRound === 2 ? 'at_pd_deposit_date_2'
                            : 'at_pd_deposit_date';
                    const crField = currentRound === 3 ? 'at_pd_cold_remark_3'
                        : currentRound === 2 ? 'at_pd_cold_remark_2'
                            : 'at_pd_cold_remark';

                    if (storage_purpose && storage_purpose.trim() !== "") {
                        histReq.input("storage_purpose_val", sql.NVarChar, storage_purpose.trim());
                        historyExtra += `, ${spField} = @storage_purpose_val`;
                        debugLog(`✅ ${spField}: "${storage_purpose}" → mapping_id: ${mapping_id} (round ${currentRound})`);
                    }

                    if (histamineValue != null && !isNaN(histamineValue)) {
                        histReq.input("histamine_val", sql.Float, histamineValue);
                        historyExtra += `, ${hField} = @histamine_val`;
                        debugLog(`✅ ${hField}: ${histamineValue} ppm → mapping_id: ${mapping_id} (round ${currentRound})`);
                    }

                    if (deposit_days) {
                        histReq.input("deposit_days_val", sql.Date, new Date(deposit_days));
                        historyExtra += `, ${ddField} = @deposit_days_val`;
                        debugLog(`✅ ${ddField}: "${deposit_days}" → mapping_id: ${mapping_id} (round ${currentRound})`);
                    }

                    if (cold_remark && cold_remark.trim() !== "") {
                        histReq.input("cold_remark_val", sql.NVarChar(500), cold_remark.trim());
                        historyExtra += `, ${crField} = @cold_remark_val`;
                        debugLog(`✅ ${crField}: "${cold_remark}" → mapping_id: ${mapping_id} (round ${currentRound})`);
                    }

                    historyUpdateQuery += historyExtra + ` WHERE mapping_id = @mapping_id;`;

                    await histReq.query(historyUpdateQuery);

                    debugLog(`✅ History updated: mapping_id=${mapping_id}`);
                }

                // ── Commit ────────────────────────────────────────────────────────────
                await transaction.commit();
                debugLog(`✅ Transaction committed: tro_id=${tro_id}`);

                io.to('saveRMForProdRoom').emit('dataUpdated', {
                    message: "วัตถุดิบถูกนำออกจากห้องเย็นแล้ว",
                    updatedAt: new Date(),
                    tro_id,
                    operator
                });
                io.to('QcCheckRoom').emit('dataUpdated', { tro_id });

                res.status(200).json({ message: "Data updated successfully" });

            } catch (innerError) {
                await safeRollback(transaction);
                console.error("Transaction error:", innerError);
                res.status(500).json({ error: innerError.message });
            }

        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({ error: "An error occurred while updating the data." });
        }

    });


    router.put("/coldstorages/outcoldstorage", async (req, res) => {
        try {
            const { tro_id, slot_id, rm_status, operator, materials, location, storage_purpose } = req.body;

            if (!tro_id || !slot_id || !rm_status || !materials || !location) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            const pool = await connectToDatabase();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // 1. อัปเดต Slot
                const updateSlotResult = await new sql.Request(transaction)
                    .input("tro_id", sql.VarChar, tro_id)
                    .query(`UPDATE Slot SET tro_id = NULL, status = '1791' WHERE tro_id = @tro_id;`);

                if (updateSlotResult.rowsAffected[0] === 0) {
                    throw new Error(`Slot update failed for slot_id ${slot_id}`);
                }

                // ── ดึง cs_id จาก Slot โดยใช้ slot_id ที่รับมา ──────────────────
                const CS_IDS_NO_COLD_TIME = [10, 14, 21, 25, 26, 37, 38];

                const slotResult = await new sql.Request(transaction)
                    .input("slot_id", sql.VarChar, slot_id)
                    .query(`SELECT cs_id FROM Slot WHERE slot_id = @slot_id`);

                const cs_id = slotResult.recordset[0]?.cs_id ?? null;

                const isColdStorageNoUpdate = cs_id != null && CS_IDS_NO_COLD_TIME.includes(cs_id);

                debugLog(`ℹ️ slot_id=${slot_id} → cs_id=${cs_id} → skipColdTime=${isColdStorageNoUpdate}`);

                // 2. วนลูปแต่ละ material
                for (const material of materials) {
                    const { mapping_id, remaining_rework_time, cold, mix_time } = material;

                    const histamineValue = (material.histamine != null && material.histamine !== "")
                        ? parseFloat(material.histamine) : null;

                    // ดึง cold_to_pack
                    const rmDataResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .query(`
                    SELECT rmg.cold_to_pack, rmm.cold_to_pack_time
                    FROM TrolleyRMMapping rmm
                    JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                    JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                    WHERE rmm.mapping_id = @mapping_id
                `);

                    if (rmDataResult.recordset.length === 0)
                        throw new Error(`Raw material not found for mapping_id: ${mapping_id}`);

                    let cold_to_pack_time = rmDataResult.recordset[0].cold_to_pack_time
                        ?? rmDataResult.recordset[0].cold_to_pack;

                    // ── อัปเดต TrolleyRMMapping ──────────────────────────────────
                    // ถ้า cs_id อยู่ใน [10,14,21,25,26,37,38] → ไม่ update cold_time
                    let updateQuery = `
                UPDATE TrolleyRMMapping
                SET dest           = @dest,
                    rm_cold_status = NULL,
                    stay_place     = @stay_place
            `;
                    if (mix_time != null) {
                        updateQuery += `, mix_time    = @mix_time`;
                    } else if (remaining_rework_time != null) {
                        updateQuery += `, rework_time = @rework_delay_time`;
                    } else if (!isColdStorageNoUpdate) {
                        // cs_id ไม่ใช่ห้องเย็นที่ยกเว้น → update cold_time ตามปกติ
                        updateQuery += `, cold_time   = @cold`;
                    }
                    // cs_id อยู่ใน list ที่ยกเว้น → ไม่ต่อ cold_time เลย

                    const updateBigRmResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .input("dest", sql.VarChar, location)
                        .input("mix_time", mix_time)
                        .input("rework_delay_time", material.rework_delay_time)
                        .input("cold", cold)
                        .input("stay_place", 'ออกห้องเย็นใหญ่')
                        .input("cold_to_pack_time", cold_to_pack_time)
                        .query(updateQuery + ` WHERE mapping_id = @mapping_id;`);

                    if (updateBigRmResult.rowsAffected[0] === 0) {
                        throw new Error(`Failed to update TrolleyRMMapping for mapping_id ${mapping_id}`);
                    }

                    // ดึงข้อมูลล่าสุดหลัง update
                    const updatedRmDataResult = await new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .query(`
                    SELECT cold_to_pack_time, mix_time, rework_time
                    FROM TrolleyRMMapping
                    WHERE mapping_id = @mapping_id
                `);
                    const updatedRmData = updatedRmDataResult.recordset[0];

                    // ── สร้าง historyExtra และ inputs แบบ dynamic ──────────────────
                    let historyExtra = "";

                    const histReq = new sql.Request(transaction)
                        .input("mapping_id", mapping_id)
                        .input("operator", sql.NVarChar, operator)
                        .input("dest", sql.VarChar, location)
                        .input("cold_to_pack_time", updatedRmData.cold_to_pack_time)
                        .input("mix_time", updatedRmData.mix_time)
                        .input("rework_time", updatedRmData.rework_time);

                    // ✅ storage_purpose — update เฉพาะเมื่อมีค่า
                    if (storage_purpose && storage_purpose.trim() !== "") {
                        histReq.input("storage_purpose", sql.NVarChar, storage_purpose);
                        historyExtra += `, storage_purpose = @storage_purpose`;
                        debugLog(`✅ storage_purpose: ${storage_purpose} → mapping_id: ${mapping_id}`);
                    }

                    // ✅ histamine — update เฉพาะเมื่อมีค่า
                    if (histamineValue != null && !isNaN(histamineValue)) {
                        histReq.input("histamine", sql.Float, histamineValue);
                        historyExtra += `, histamine = @histamine`;
                        debugLog(`✅ histamine: ${histamineValue} → mapping_id: ${mapping_id}`);
                    }

                    // ── อัปเดต History ────────────────────────────────────────────
                    await histReq.query(`
                UPDATE History
                SET
                    out_cold_date = CASE
                        WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL
                        THEN GETDATE() ELSE out_cold_date END,

                    receiver_out_cold = CASE
                        WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL
                        THEN @operator ELSE receiver_out_cold END,

                    receiver_out_cold_two = CASE
                        WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL
                        THEN @operator ELSE receiver_out_cold_two END,

                    receiver_out_cold_three = CASE
                        WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL
                        THEN @operator ELSE receiver_out_cold_three END,

                    cs_out_cold_date = CASE
                        WHEN cs_come_cold_date IS NOT NULL AND cs_out_cold_date IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date END,

                    cs_out_cold_date_two = CASE
                        WHEN cs_come_cold_date_two IS NOT NULL AND cs_out_cold_date_two IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_two END,

                    cs_out_cold_date_three = CASE
                        WHEN cs_come_cold_date_three IS NOT NULL AND cs_out_cold_date_three IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_three END,

                    cs_out_cold_date_four = CASE
                        WHEN cs_come_cold_date_four IS NOT NULL AND cs_out_cold_date_four IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_four END,

                    cs_out_out_date_five = CASE
                        WHEN cs_come_cold_date_five IS NOT NULL AND cs_out_out_date_five IS NULL
                        THEN GETDATE() ELSE cs_out_out_date_five END,

                    cs_out_cold_date_six = CASE
                        WHEN cs_come_cold_date_six IS NOT NULL AND cs_out_cold_date_six IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_six END,

                    cs_out_cold_date_seven = CASE
                        WHEN cs_come_cold_date_seven IS NOT NULL AND cs_out_cold_date_seven IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_seven END,

                    cs_out_cold_date_eight = CASE
                        WHEN cs_come_cold_date_eight IS NOT NULL AND cs_out_cold_date_eight IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_eight END,

                    cs_out_cold_date_nine = CASE
                        WHEN cs_come_cold_date_nine IS NOT NULL AND cs_out_cold_date_nine IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_nine END,

                    cs_out_cold_date_ten = CASE
                        WHEN cs_come_cold_date_ten IS NOT NULL AND cs_out_cold_date_ten IS NULL
                        THEN GETDATE() ELSE cs_out_cold_date_ten END,

                    cold_dest = @dest
                    ${historyExtra}

                WHERE mapping_id = @mapping_id;
            `);

                    debugLog(`✅ History updated: mapping_id=${mapping_id}`);
                }

                await transaction.commit();
                debugLog(`✅ Transaction committed: tro_id=${tro_id}`);

                io.to('saveRMForProdRoom').emit('dataUpdated', {
                    message: "วัตถุดิบถูกนำออกจากห้องเย็นแล้ว",
                    updatedAt: new Date(),
                    tro_id,
                    operator
                });
                io.to('QcCheckRoom').emit('dataUpdated', { tro_id });

                res.status(200).json({ message: "Data updated successfully" });

            } catch (innerError) {
                await safeRollback(transaction);
                console.error("Transaction error:", innerError);
                res.status(500).json({ error: innerError.message });
            }

        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({ error: "An error occurred while updating the data." });
        }
    });

    //  router.put("/coldstorage/outcoldstorage", async (req, res) => {
    //         try {
    //             console.log("Raw Request Body:", req.body);


    //             const { tro_id, slot_id, rm_cold_status, rm_status, dest, operator, materials } = req.body;


    //             // ตรวจสอบค่าที่ได้รับว่าครบถ้วน
    //             if (!tro_id || !slot_id || !rm_status || !rm_cold_status || !dest || !materials) {
    //                 console.log("Missing fields:", { tro_id, slot_id, rm_status, rm_cold_status, dest, materials });
    //                 return res.status(400).json({ error: "Missing required fields" });
    //             }


    //             const pool = await connectToDatabase();
    //             const transaction = new sql.Transaction(pool);
    //             await transaction.begin();


    //             try {
    //                 // 1. อัปเดตสถานะของ slot
    //                 const updateSlotResult = await new sql.Request(transaction)
    //                     .input("tro_id", tro_id)
    //                     .query(`
    //           UPDATE Slot
    //           SET tro_id = NULL,
    //               status = '1791'
    //           WHERE tro_id = @tro_id;
    //         `);


    //                 if (updateSlotResult.rowsAffected[0] === 0) {
    //                     throw new Error(`Slot update failed for slot_id ${slot_id}`);
    //                 }


    //                 // 2. วนลูปปรับปรุงข้อมูลแต่ละรายการวัตถุดิบใน TrolleyRMMapping
    //                 for (const material of materials) {
    //                     const { mapping_id, remaining_rework_time, delayTime, cold, mix_time } = material;


    //                     // ดึงข้อมูล cold_to_pack และ cold_to_pack_time
    //                     const rmDataResult = await new sql.Request(transaction)
    //                         .input("mapping_id", mapping_id)
    //                         .query(`
    //             SELECT rmg.cold_to_pack, rmm.cold_to_pack_time
    //             FROM TrolleyRMMapping rmm
    //             JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
    //             JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
    //             WHERE rmm.mapping_id = @mapping_id
    //           `);


    //                     if (rmDataResult.recordset.length === 0) {
    //                         throw new Error(`Raw material not found for mapping_id: ${mapping_id}`);
    //                     }


    //                     let cold_to_pack_time = rmDataResult.recordset[0].cold_to_pack_time ?? rmDataResult.recordset[0].cold_to_pack;


    //                     // สร้างคำสั่ง SQL พื้นฐานสำหรับอัปเดต TrolleyRMMapping
    //                     let updateQuery = `
    //           UPDATE TrolleyRMMapping
    //           SET dest = CASE
    //               WHEN rm_status = 'QcCheck' AND @rm_cold_status IN ('เหลือจากไลน์ผลิต', 'วัตถุดิบตรง')  AND @dest = 'บรรจุ' THEN 'บรรจุ'
    //               WHEN rm_status = 'QcCheck' AND @rm_cold_status IN ('เหลือจากไลน์ผลิต', 'วัตถุดิบตรง')  AND @dest = 'จุดเตรียม' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'QcCheck รอ MD' AND @rm_cold_status = 'วัตถุดิบรับฝาก' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'QcCheck รอกลับมาเตรียม' AND @rm_cold_status = 'วัตถุดิบรับฝาก' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'รอกลับมาเตรียม' AND @rm_cold_status = 'วัตถุดิบรับฝาก' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบรับฝาก' AND @dest = 'จุดเตรียม' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบรอแก้ไข' AND @dest = 'จุดเตรียม' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบตรง' AND @dest = 'บรรจุ' THEN 'บรรจุ'
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบตรง' AND @dest = 'จุดเตรียม' THEN 'จุดเตรียม'
    //               WHEN rm_status = 'เหลือจากไลน์ผลิต' AND @rm_cold_status = 'เหลือจากไลน์ผลิต' AND @dest = 'บรรจุ' THEN 'บรรจุ'
    //               WHEN rm_status = 'ส่งฟรีช' AND @rm_cold_status = 'รอส่งฟรีช' THEN 'จุดเตรียม'
    //               ELSE @dest
    //           END,
    //           rm_status = CASE
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบตรง' AND @dest = 'บรรจุ' THEN 'QcCheck'
    //               WHEN rm_status = 'รอแก้ไข' AND @rm_cold_status = 'วัตถุดิบรับฝาก' AND @dest = 'จุดเตรียม' THEN 'รับฝาก-รอแก้ไข'
    //               ELSE rm_status
    //           END,
    //           rm_cold_status = NULL,
    //           stay_place = @stay_place,
    //           cold_to_pack_time = @cold_to_pack_time
    //         `;


    //                     // กำหนด field เฉพาะประเภทวัตถุดิบ
    //                     if (mix_time !== null && mix_time !== undefined) {
    //                         updateQuery += `, mix_time = @mix_time`;
    //                     } else if (remaining_rework_time !== null && remaining_rework_time !== undefined) {
    //                         updateQuery += `, rework_time = @rework_delay_time`;
    //                     } else {
    //                         updateQuery += `, cold_time = @cold`;
    //                     }



    //                     if (dest === 'บรรจุ') {
    //                         updateQuery += `, tro_id = NULL`;
    //                     }


    //                     if (dest === 'จุดเตรียม') {
    //                         updateQuery += `, tro_id = NULL`;
    //                     }


    //                     // Execute TrolleyRMMapping update
    //                     const updateRmResult = await new sql.Request(transaction)
    //                         .input("mapping_id", mapping_id)
    //                         .input("rm_status", rm_status)
    //                         .input("rm_cold_status", rm_cold_status)
    //                         .input("dest", dest)
    //                         .input("mix_time", mix_time)
    //                         .input("rework_delay_time", material.rework_delay_time)
    //                         .input("cold", cold)
    //                         .input("stay_place", 'ออกห้องเย็น')
    //                         .input("cold_to_pack_time", cold_to_pack_time)
    //                         .query(updateQuery + ` WHERE mapping_id = @mapping_id;`);


    //                     if (updateRmResult.rowsAffected[0] === 0) {
    //                         throw new Error(`Failed to update TrolleyRMMapping for mapping_id ${mapping_id}`);
    //                     }



    //                     if (dest === 'จุดเตรียม'|| dest === 'บรรจุ') {
    //                         await new sql.Request(transaction)
    //                             .input("tro_id", tro_id)
    //                             .query(`
    //               UPDATE Trolley
    //               SET tro_status = 1
    //               WHERE tro_id = @tro_id;
    //             `);
    //                     }


    //                     // 3. อัปเดต History
    //                     const updatedRmDataResult = await new sql.Request(transaction)
    //                         .input("mapping_id", mapping_id)
    //                         .query(`
    //             SELECT cold_to_pack_time, mix_time, rework_time
    //             FROM TrolleyRMMapping
    //             WHERE mapping_id = @mapping_id
    //           `);
    //                     const updatedRmData = updatedRmDataResult.recordset[0];


    //                     const historyUpdateQuery = `
    //           UPDATE History
    //           SET out_cold_date = CASE WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL THEN GETDATE() ELSE out_cold_date END,
    //               out_cold_date_two = CASE WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL THEN GETDATE() ELSE out_cold_date_two END,
    //               out_cold_date_three = CASE WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL THEN GETDATE() ELSE out_cold_date_three END,
    //               receiver_out_cold = CASE WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL THEN @operator ELSE receiver_out_cold END,
    //               receiver_out_cold_two = CASE WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL THEN @operator ELSE receiver_out_cold_two END,
    //               receiver_out_cold_three = CASE WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL THEN @operator ELSE receiver_out_cold_three END,
    //               cold_to_pack_time = @cold_to_pack_time,
    //               mix_time = @mix_time,
    //               rework_time = @rework_time,
    //               cold_dest = @dest
    //           WHERE mapping_id = @mapping_id;
    //         `;


    //                     await new sql.Request(transaction)
    //                         .input("mapping_id", mapping_id)
    //                         .input("operator", operator)
    //                         .input("cold_to_pack_time", updatedRmData.cold_to_pack_time)
    //                         .input("mix_time", updatedRmData.mix_time)
    //                         .input("rework_time", updatedRmData.rework_time)
    //                         .input("dest", dest)
    //                         .query(historyUpdateQuery);
    //                 }


    //                 // Commit transaction
    //                 await transaction.commit();


    //                 const formattedData = {
    //                     message: "วัตถุดิบถูกนำออกจากห้องเย็นแล้ว",
    //                     updatedAt: new Date(),
    //                     tro_id,
    //                     operator
    //                 };


    //                 io.to('saveRMForProdRoom').emit('dataUpdated', formattedData);
    //                 io.to('QcCheckRoom').emit('dataUpdated', formattedData);


    //                 res.status(200).json({ message: "Data updated successfully" });


    //             } catch (innerError) {
    //                 await safeRollback(transaction);
    //                 console.error("Transaction error:", innerError);
    //                 res.status(500).json({ error: innerError.message });
    //             }


    //         } catch (error) {
    //             console.error("Error:", error);
    //             res.status(500).json({ error: "An error occurred while updating the data." });
    //         }
    //     });







    // ✅ แก้ไข Backend Route
    // ปัญหาเดิม: ใช้ sql.Request() object เดียวกันแล้ว .input() ซ้ำ key
    // → throw "The parameter mapping_id has already been added" → transaction hang

    router.put("/coldstorage/update/:mapping_id", async (req, res) => {
        const { mapping_id } = req.params;

        let pool;
        let transaction;

        try {
            pool = await connectToDatabase();
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            // ✅ แยก sql.Request() ใหม่ทุก query — ห้ามใช้ object เดิมซ้ำ
            // 1️⃣ ดึง tro_id เดิมออกมาก่อน
            const req1 = new sql.Request(transaction);
            const getTro = await req1
                .input("mapping_id", sql.Int, mapping_id)
                .query(`
        SELECT tro_id 
        FROM TrolleyRMMapping
        WHERE mapping_id = @mapping_id
      `);

            if (getTro.recordset.length === 0) {
                await safeRollback(transaction);
                return res.json({
                    success: false,
                    message: "ไม่พบ mapping_id"
                });
            }

            const tro_id = getTro.recordset[0].tro_id;
            debugLog("tro_id found:", tro_id);

            // 2️⃣ ถ้ามี tro_id ให้ update ตาราง Trolley
            if (tro_id) {
                const req2 = new sql.Request(transaction); // ✅ Request ใหม่
                await req2
                    .input("tro_id", sql.VarChar, String(tro_id)) // ✅ tro_id เป็น string "0691"
                    .query(`
          UPDATE Trolley
          SET tro_status = '1'
          WHERE tro_id = @tro_id
        `);
            }

            // 3️⃣ update TrolleyRMMapping
            const req3 = new sql.Request(transaction); // ✅ Request ใหม่
            await req3
                .input("mapping_id", sql.Int, mapping_id)
                .query(`
        UPDATE TrolleyRMMapping
        SET stay_place = N'ห้องเย็นลบ',
            dest       = N'ห้องเย็นลบ',
            tro_id     = NULL
        WHERE mapping_id = @mapping_id
      `);

            await transaction.commit();

            res.json({
                success: true,
                message: "อัปเดตสำเร็จ และคืนสถานะรถเข็นเรียบร้อย"
            });

        } catch (error) {
            if (transaction) {
                try { await safeRollback(transaction); } catch (_) { }
            }
            console.error("❌ Update error:", error);
            res.status(500).json({
                success: false,
                message: "เกิดข้อผิดพลาด",
                error: error.message
            });
        }
    });


router.get("/coldstorage/history/:mapping_id", async (req, res) => {
    try {
        const { mapping_id } = req.params;
        const pool = await connectToDatabase();

        // Get history data and time values
        const result = await pool.request()
            .input("mapping_id", mapping_id)
            .query(`SELECT
                    CONVERT(VARCHAR, h.come_cold_date, 120) AS come_cold_date,
                    CONVERT(VARCHAR, h.out_cold_date, 120) AS out_cold_date,
                    CONVERT(VARCHAR, h.come_cold_date_two, 120) AS come_cold_date_two,
                    CONVERT(VARCHAR, h.out_cold_date_two, 120) AS out_cold_date_two,
                    CONVERT(VARCHAR, h.come_cold_date_three, 120) AS come_cold_date_three,
                    CONVERT(VARCHAR, h.out_cold_date_three, 120) AS out_cold_date_three,

                    CONVERT(VARCHAR, h.cs_come_cold_date, 120) AS cs_come_cold_date,
                    CONVERT(VARCHAR, h.cs_out_cold_date, 120) AS cs_out_cold_date,
                    CONVERT(VARCHAR, h.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
                    CONVERT(VARCHAR, h.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
                    CONVERT(VARCHAR, h.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
                    CONVERT(VARCHAR, h.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
                    CONVERT(VARCHAR, h.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
                    CONVERT(VARCHAR, h.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
                    CONVERT(VARCHAR, h.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
                    CONVERT(VARCHAR, h.cs_out_out_date_five, 120) AS cs_out_cold_date_five,
                    CONVERT(VARCHAR, h.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
                    CONVERT(VARCHAR, h.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
                    CONVERT(VARCHAR, h.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
                    CONVERT(VARCHAR, h.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
                    CONVERT(VARCHAR, h.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
                    CONVERT(VARCHAR, h.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
                    CONVERT(VARCHAR, h.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
                    CONVERT(VARCHAR, h.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
                    CONVERT(VARCHAR, h.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
                    CONVERT(VARCHAR, h.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten,

                    CONVERT(VARCHAR, h.qc_date, 120) AS qc_date,
                    CONVERT(VARCHAR, h.rework_date, 120) AS rework_date,
                    h.receiver_out_cold,
                    h.receiver_out_cold_two,
                    h.receiver_out_cold_three,
                    rmm.rework_time,
                    rmm.mix_time,
                    rmm.cold_to_pack_time,
                    rmg.cold_to_pack,
                    CONVERT(VARCHAR, h.summary_withdraw_date, 120) AS summary_withdraw_date
                
                FROM History h
                JOIN TrolleyRMMapping rmm ON h.mapping_id = rmm.mapping_id
                JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                WHERE h.mapping_id = @mapping_id
            `);

        if (result.recordset.length > 0) {
            const historyData = result.recordset[0];
            const historyEntries = [];

            if (historyData.come_cold_date) {
                historyEntries.push({
                    round: 1,
                    come_date: historyData.come_cold_date,
                    out_date: historyData.out_cold_date,
                    come_operator: historyData.receiver_come_cold,
                    out_operator: historyData.receiver_out_cold
                });
            }

            if (historyData.come_cold_date_two) {
                historyEntries.push({
                    round: 2,
                    come_date: historyData.come_cold_date_two,
                    out_date: historyData.out_cold_date_two,
                    come_operator: historyData.receiver_come_cold_two,
                    out_operator: historyData.receiver_out_cold_two
                });
            }

            if (historyData.come_cold_date_three) {
                historyEntries.push({
                    round: 3,
                    come_date: historyData.come_cold_date_three,
                    out_date: historyData.out_cold_date_three,
                    come_operator: historyData.receiver_come_cold_three,
                    out_operator: historyData.receiver_out_cold_three
                });
            }

            // ชุดที่ 2 (เข้าออกห้องเย็น2) รองรับสูงสุด 10 รอบ
            const csSuffixes = ["", "_two", "_three", "_four", "_five", "_six", "_seven", "_eight", "_nine", "_ten"];
            const historyEntries2 = [];
            csSuffixes.forEach((suffix, idx) => {
                const comeKey = `cs_come_cold_date${suffix}`;
                const outKey = `cs_out_cold_date${suffix}`;
                if (historyData[comeKey]) {
                    historyEntries2.push({
                        round: idx + 1,
                        come_date: historyData[comeKey],
                        out_date: historyData[outKey]
                    });
                }
            });

            res.status(200).json({
                history: historyEntries,
                history2: historyEntries2,
                qc_date: historyData.qc_date,
                rework_date: historyData.rework_date,
                rework_time: historyData.rework_time,
                mix_time: historyData.mix_time,
                cold_to_pack_time: historyData.cold_to_pack_time,
                cold_to_pack: historyData.cold_to_pack,
                summary_withdraw_date: historyData.summary_withdraw_date
            });

            debugLog("send body history:", historyEntries);
            debugLog("send body history2:", historyEntries2);
            debugLog("send body qc_date:", historyData.qc_date);
            debugLog("send body rework_time:", historyData.rework_time);
            debugLog("send body mix_time:", historyData.mix_time);
            debugLog("send body cold_to_pack_time:", historyData.cold_to_pack_time);
            debugLog("send body cold_to_pack:", historyData.cold_to_pack);
        } else {
            res.status(404).json({ err: "History not found" });
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "An error occurred while fetching history." });
    }
});

router.get("/coldstorage/history/test/:mapping_id", async (req, res) => {
    try {
        const { mapping_id } = req.params;
        const pool = await connectToDatabase();

        // Get history data and time values
        const result = await pool.request()
            .input("mapping_id", mapping_id)
            .query(`SELECT
                    CONVERT(VARCHAR, h.come_cold_date, 120) AS come_cold_date,
                    CONVERT(VARCHAR, h.out_cold_date, 120) AS out_cold_date,
                    CONVERT(VARCHAR, h.come_cold_date_two, 120) AS come_cold_date_two,
                    CONVERT(VARCHAR, h.out_cold_date_two, 120) AS out_cold_date_two,
                    CONVERT(VARCHAR, h.come_cold_date_three, 120) AS come_cold_date_three,
                    CONVERT(VARCHAR, h.out_cold_date_three, 120) AS out_cold_date_three,

                    CONVERT(VARCHAR, h.cs_come_cold_date, 120) AS cs_come_cold_date,
                    CONVERT(VARCHAR, h.cs_out_cold_date, 120) AS cs_out_cold_date,
                    CONVERT(VARCHAR, h.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
                    CONVERT(VARCHAR, h.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
                    CONVERT(VARCHAR, h.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
                    CONVERT(VARCHAR, h.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
                    CONVERT(VARCHAR, h.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
                    CONVERT(VARCHAR, h.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
                    CONVERT(VARCHAR, h.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
                    CONVERT(VARCHAR, h.cs_out_out_date_five, 120) AS cs_out_cold_date_five,
                    CONVERT(VARCHAR, h.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
                    CONVERT(VARCHAR, h.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
                    CONVERT(VARCHAR, h.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
                    CONVERT(VARCHAR, h.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
                    CONVERT(VARCHAR, h.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
                    CONVERT(VARCHAR, h.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
                    CONVERT(VARCHAR, h.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
                    CONVERT(VARCHAR, h.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
                    CONVERT(VARCHAR, h.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
                    CONVERT(VARCHAR, h.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten,

                    CONVERT(VARCHAR, h.qc_date, 120) AS qc_date,
                    CONVERT(VARCHAR, h.rmit_date, 120) AS rmit_date,
                    CONVERT(VARCHAR, h.rework_date, 120) AS rework_date,
                    CONVERT(VARCHAR,
                            COALESCE(
                                h.come_cold_date_three,
                                h.come_cold_date_two,
                                h.come_cold_date
                            ),
                            120
                    ) AS come_cold_date_latest,
                    h.receiver_out_cold,
                    h.receiver_out_cold_two,
                    h.receiver_out_cold_three,
                    rmm.rework_time,
                    rmm.mix_time,
                    rmm.cold_to_pack_time,
                    rmg.cold_to_pack,
                    rmf.remark,
                    CONVERT(VARCHAR, h.summary_withdraw_date, 120) AS summary_withdraw_date
                   
                FROM History h
                JOIN TrolleyRMMapping rmm ON h.mapping_id = rmm.mapping_id
                JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                JOIN RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                WHERE h.mapping_id = @mapping_id
            `);

        if (result.recordset.length > 0) {
            const historyData = result.recordset[0];
            const historyEntries = [];

            if (historyData.come_cold_date) {
                historyEntries.push({
                    round: 1,
                    come_date: historyData.come_cold_date,
                    out_date: historyData.out_cold_date,
                    come_operator: historyData.receiver_come_cold,
                    out_operator: historyData.receiver_out_cold
                });
            }

            if (historyData.come_cold_date_two) {
                historyEntries.push({
                    round: 2,
                    come_date: historyData.come_cold_date_two,
                    out_date: historyData.out_cold_date_two,
                    come_operator: historyData.receiver_come_cold_two,
                    out_operator: historyData.receiver_out_cold_two
                });
            }

            if (historyData.come_cold_date_three) {
                historyEntries.push({
                    round: 3,
                    come_date: historyData.come_cold_date_three,
                    out_date: historyData.out_cold_date_three,
                    come_operator: historyData.receiver_come_cold_three,
                    out_operator: historyData.receiver_out_cold_three
                });
            }

            // ชุดที่ 2 (เข้าออกห้องเย็น2) รองรับสูงสุด 10 รอบ
            const csSuffixes = ["", "_two", "_three", "_four", "_five", "_six", "_seven", "_eight", "_nine", "_ten"];
            const historyEntries2 = [];
            csSuffixes.forEach((suffix, idx) => {
                const comeKey = `cs_come_cold_date${suffix}`;
                const outKey = `cs_out_cold_date${suffix}`;
                if (historyData[comeKey]) {
                    historyEntries2.push({
                        round: idx + 1,
                        come_date: historyData[comeKey],
                        out_date: historyData[outKey]
                    });
                }
            });

            res.status(200).json({
                history: historyEntries,
                history2: historyEntries2,
                qc_date: historyData.qc_date,
                rework_date: historyData.rework_date,
                rework_time: historyData.rework_time,
                mix_time: historyData.mix_time,
                cold_to_pack_time: historyData.cold_to_pack_time,
                cold_to_pack: historyData.cold_to_pack,
                come_cold_date_latest: historyData.come_cold_date_latest,
                rmit_date: historyData.rmit_date,
                remark: historyData.remark,
                summary_withdraw_date: historyData.summary_withdraw_date
            });

            debugLog("send body history:", historyEntries);
            debugLog("send body history2:", historyEntries2);
            debugLog("send body qc_date:", historyData.qc_date);
            debugLog("send body rework_time:", historyData.rework_time);
            debugLog("send body mix_time:", historyData.mix_time);
            debugLog("send body cold_to_pack_time:", historyData.cold_to_pack_time);
            debugLog("send body cold_to_pack:", historyData.cold_to_pack);
            debugLog("send body come_cold_date_latest:", historyData.come_cold_date_latest);
            debugLog("send body rmit_date:", historyData.rmit_date);
        } else {
            res.status(404).json({ err: "History not found" });
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "An error occurred while fetching history." });
    }
});



    router.put("/coldstorage/moverawmat", async (req, res) => {
        try {
            debugLog("raw Request Body:", req.body);
            const { tro_id, new_tro_id, typeOutput, slot_id, new_slot_id, rmfp_id, moveType, operator } = req.body;

            if (!tro_id || !new_tro_id || !typeOutput || !slot_id || !new_slot_id) {
                console.warn("Missing fields:", { tro_id, new_tro_id, typeOutput, slot_id, new_slot_id });
                return res.status(400).json({ error: "Missing required fields" });
            }

            const typeOutputValue = parseFloat(typeOutput);
            if (isNaN(typeOutputValue)) {
                return res.status(400).json({ error: "typeOutput must be a valid number" });
            }

            const pool = await connectToDatabase();
            const transaction = pool.transaction();
            await transaction.begin();

            try {
                // --- ตรวจสอบน้ำหนักเก่าของรถเข็น ---
                const result = await pool.request()
                    .input("tro_id", sql.VarChar, tro_id)
                    .query(`SELECT SUM(weight_RM) AS total_weight FROM RMInTrolley WHERE tro_id = @tro_id;`);

                if (result.recordset.length > 0 && (result.recordset[0].total_weight || 0) <= 0) {
                    // --- อัปเดต tro_id เก่าเป็นใหม่ ---
                    await pool.request()
                        .input("tro_id", sql.VarChar, tro_id)
                        .input("new_tro_id", sql.VarChar, new_tro_id)
                        .query(`
                        UPDATE RMInTrolley SET tro_id = @new_tro_id WHERE tro_id = @tro_id;
                        UPDATE t SET t.weight_per_tro = ISNULL((SELECT SUM(r.weight_RM) FROM RMInTrolley r WHERE r.tro_id = @new_tro_id),0)
                        FROM RMInTrolley t WHERE t.tro_id = @new_tro_id;
                        UPDATE Slot SET tro_id = NULL ,status ='2061' WHERE slot_id = @slot_id;
                        UPDATE Trolley SET cs_id = NULL, slot_id = NULL, status = '1.8',tro_status = 1 WHERE tro_id = @tro_id;
                    `);
                    await transaction.commit();
                    return res.status(200).json({ message: "Old tro_id updated to new_tro_id and slot cleared." });
                }

                // --- ย้ายทั้งคัน หรือบางส่วน ---
                if ((moveType === "ย้ายทั้งคัน" || moveType === "ย้ายบางส่วน") && rmfp_id) {
                    const getMaterialData = await pool.request()
                        .input("tro_id", sql.VarChar, tro_id)
                        .input("rmfp_id", sql.VarChar, rmfp_id)
                        .query(`SELECT weight_RM, batch, mat_name, [แผนการผลิต], cold, rmfp_id, mat, rm_status FROM RMInTrolley WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id;`);

                    if (getMaterialData.recordset.length > 0) {
                        const materialData = getMaterialData.recordset[0];
                        const currentWeight = materialData.weight_RM || 0;

                        if (moveType === "ย้ายบางส่วน" && typeOutputValue > currentWeight) {
                            await safeRollback(transaction);
                            return res.status(400).json({ error: "น้ำหนักที่ต้องการย้ายมากกว่าน้ำหนักที่มีอยู่" });
                        }

                        // --- ลดน้ำหนักใน tro_id เก่า ---
                        const weightToMove = moveType === "ย้ายทั้งคัน" ? currentWeight : typeOutputValue;
                        await pool.request()
                            .input("tro_id", sql.VarChar, tro_id)
                            .input("rmfp_id", sql.VarChar, rmfp_id)
                            .input("weight_to_move", sql.Float, weightToMove)
                            .query(`
                            UPDATE RMInTrolley SET weight_RM = weight_RM - @weight_to_move
                            WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id;
                            UPDATE t SET t.weight_per_tro = ISNULL((SELECT SUM(r.weight_RM) FROM RMInTrolley r WHERE r.tro_id = @tro_id),0)
                            FROM RMInTrolley t WHERE t.tro_id = @tro_id;
                        `);

                        // --- เพิ่มน้ำหนักใน tro_id ใหม่ ---
                        const checkExistInNewTrolley = await pool.request()
                            .input("new_tro_id", sql.VarChar, new_tro_id)
                            .input("rmfp_id", sql.VarChar, rmfp_id)
                            .query(`SELECT COUNT(*) AS exist_count FROM RMInTrolley WHERE tro_id = @new_tro_id AND rmfp_id = @rmfp_id;`);
                        const existInNewTrolley = checkExistInNewTrolley.recordset[0].exist_count > 0;

                        if (existInNewTrolley) {
                            await pool.request()
                                .input("new_tro_id", sql.VarChar, new_tro_id)
                                .input("rmfp_id", sql.VarChar, rmfp_id)
                                .input("weight_to_move", sql.Float, weightToMove)
                                .query(`
                                UPDATE RMInTrolley SET weight_RM = weight_RM + @weight_to_move
                                WHERE tro_id = @new_tro_id AND rmfp_id = @rmfp_id;
                                UPDATE t SET t.weight_per_tro = ISNULL((SELECT SUM(r.weight_RM) FROM RMInTrolley r WHERE r.tro_id = @new_tro_id),0)
                                FROM RMInTrolley t WHERE t.tro_id = @new_tro_id;
                            `);
                        } else {
                            await pool.request()
                                .input("new_tro_id", sql.VarChar, new_tro_id)
                                .input("weight_to_move", sql.Float, weightToMove)
                                .input("batch", sql.NVarChar, materialData.batch || '')
                                .input("mat_name", sql.NVarChar, materialData.mat_name || '')
                                .input("production", sql.NVarChar, materialData.แผนการผลิต || '')
                                .input("cold", sql.NVarChar, materialData.cold || '')
                                .input("rmfp_id", sql.VarChar, materialData.rmfp_id || '')
                                .input("mat", sql.NVarChar, materialData.mat || '')
                                .input("rm_status", sql.Int, materialData.rm_status || 0)
                                .query(`
                                INSERT INTO RMInTrolley (tro_id, weight_RM, batch, mat_name, แผนการผลิต, cold, rmfp_id, mat, rm_status, weight_per_tro)
                                VALUES (@new_tro_id, @weight_to_move, @batch, @mat_name, @production, @cold, @rmfp_id, @mat, @rm_status, 0);
                                UPDATE t SET t.weight_per_tro = ISNULL((SELECT SUM(r.weight_RM) FROM RMInTrolley r WHERE r.tro_id = @new_tro_id),0)
                                FROM RMInTrolley t WHERE t.tro_id = @new_tro_id;
                            `);
                        }

                        // --- ลบรายการที่น้ำหนัก 0 ใน tro_id เก่า ---
                        await pool.request()
                            .input("tro_id", sql.VarChar, tro_id)
                            .input("rmfp_id", sql.VarChar, rmfp_id)
                            .query(`DELETE FROM RMInTrolley WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id AND weight_RM <= 0;`);
                    }
                }

                // --- ตรวจสอบรถเข็นเก่าและ slot ---
                const finalCheck = await pool.request()
                    .input("tro_id", sql.VarChar, tro_id)
                    .input("slot_id", sql.VarChar, slot_id)
                    .query(`
                    SELECT COUNT(*) AS item_count, ISNULL(SUM(weight_RM),0) AS total_weight
                    FROM RMInTrolley WHERE tro_id = @tro_id;
                    UPDATE Slot SET tro_id = NULL ,status ='2194' WHERE slot_id = @slot_id;
                    UPDATE trolley SET tro_status = 1,status = '1.9',cs_id = NULL, slot_id = NULL WHERE tro_id = @tro_id
                        AND (SELECT ISNULL(SUM(weight_RM),0) FROM RMInTrolley WHERE tro_id = @tro_id) <= 0;
                    DELETE FROM RMInTrolley WHERE tro_id = @tro_id AND (weight_RM <= 0 OR weight_RM IS NULL);
                `);

                // --- ผูกรถเข็นใหม่กับ slot ใหม่ ---
                const getCSidFromSlot = await pool.request()
                    .input("new_slot_id", sql.VarChar, new_slot_id)
                    .query(`SELECT cs_id FROM Slot WHERE slot_id = @new_slot_id;`);
                const cs_id = getCSidFromSlot.recordset.length > 0 ? getCSidFromSlot.recordset[0].cs_id : null;

                await pool.request()
                    .input("new_tro_id", sql.VarChar, new_tro_id)
                    .input("new_slot_id", sql.VarChar, new_slot_id)
                    .input("cs_id", sql.VarChar, cs_id)
                    .query(`
        UPDATE Slot 
        SET tro_id = @new_tro_id, 
            status = '/coldstorage/moverawmat'
        WHERE slot_id = @new_slot_id;

        UPDATE trolley 
        SET cs_id = @cs_id,
            slot_id = @new_slot_id,
            tro_status = 0
        WHERE tro_id = @new_tro_id;
    `);


                await transaction.commit();

                const formattedData = {
                    message: "วัตถุดิบถูกนำออกจากห้องเย็นแล้ว",
                    updatedAt: new Date(),
                    tro_id,
                    operator
                };
                io.to('saveRMForProdRoom').emit('dataUpdated', formattedData);

                res.status(200).json({ message: "Trolley moved successfully and weight updated" });

            } catch (error) {
                console.error("Transaction error:", error.message, error.stack);
                await safeRollback(transaction);
                res.status(500).json({ error: "Transaction failed", details: error.message });
            }

        } catch (error) {
            console.error("Error:", error.message, error.stack);
            res.status(500).json({ error: "An error occurred while updating the data.", details: error.message });
        }
    });


    router.put("/coldstorage/moveslot", async (req, res) => {
        try {
            debugLog("Slot Request Body:", req.body);
            const { slot_id, tro_id, new_slot_id } = req.body;

            if (!slot_id || !tro_id || !new_slot_id) {
                console.warn("Missing fields:", { slot_id, tro_id, new_slot_id });
                return res.status(400).json({ error: "Missing required fields" });
            }

            const pool = await connectToDatabase();
            const transaction = pool.transaction();
            await transaction.begin();

            try {
                // --- ตรวจสอบ slot เดิม ---
                const oldSlot = await pool.request()
                    .input("slot_id", sql.VarChar, slot_id)
                    .query(`SELECT slot_id, cs_id, tro_id, slot_status FROM Slot WHERE slot_id = @slot_id;`);

                if (oldSlot.recordset.length === 0) {
                    await safeRollback(transaction);
                    return res.status(404).json({ error: "Slot not found" });
                }

                if (!oldSlot.recordset[0].tro_id) {
                    await safeRollback(transaction);
                    return res.status(400).json({ error: "Cannot move slot. No trolley in the current slot." });
                }

                // --- ตรวจสอบ slot ใหม่ ---
                const newSlot = await pool.request()
                    .input("new_slot_id", new_slot_id)
                    .query(`SELECT slot_id, cs_id, tro_id, slot_status FROM Slot WHERE slot_id = @new_slot_id;`);

                if (newSlot.recordset.length === 0) {
                    await safeRollback(transaction);
                    return res.status(404).json({ error: "New Slot not found" });
                }

                if (newSlot.recordset[0].tro_id) {
                    await safeRollback(transaction);
                    return res.status(400).json({ error: "Cannot move slot. The new slot is already occupied by another trolley." });
                }

                // --- อัปเดต slot ใหม่ ---
                await pool.request()
                    .input("slot_id", sql.VarChar, new_slot_id)
                    .input("tro_id", sql.VarChar, tro_id)
                    .query(`UPDATE Slot SET tro_id = @tro_id ,
                     status = '/coldstorage/moveslot'
                    WHERE slot_id = @slot_id;`);

                // --- ลบ tro_id จาก slot เก่า ---
                await pool.request()
                    .input("slot_id", sql.VarChar, slot_id)
                    .query(`UPDATE Slot SET tro_id = NULL ,status ='16' WHERE slot_id = @slot_id;`);

                await transaction.commit();
                return res.status(200).json({ message: "Slot moved successfully" });

            } catch (error) {
                console.error("Transaction error:", error);
                await safeRollback(transaction);
                return res.status(500).json({ error: "Transaction failed", details: error.message });
            }

        } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    });

    router.put("/coldstorage/updatestatusrework", async (req, res) => {
        try {
            debugLog("Raw Request Body:", req.body);
            const { rm_tro_id } = req.body;

            // ตรวจสอบค่า rm_tro_id
            if (!rm_tro_id || typeof rm_tro_id !== "number") {
                return res.status(400).json({ error: "Invalid or missing 'rm_tro_id'" });
            }

            const pool = await connectToDatabase();
            const transaction = pool.transaction();
            await transaction.begin();

            try {
                // อัปเดต status ของ RMInTrolley
                const result = await pool.request()
                    .input("rm_tro_id", rm_tro_id)
                    .query(`
                    UPDATE RMInTrolley
                    SET rm_status = 'รอแก้ไข'
                    WHERE rm_tro_id = @rm_tro_id;
                `);

                if (result.rowsAffected[0] === 0) {
                    // ไม่มี record ให้ update -> rollback
                    await safeRollback(transaction);
                    return res.status(404).json({ error: "No record found to update" });
                }

                await transaction.commit();
                res.status(200).json({ message: "Status updated successfully" });

            } catch (error) {
                console.error("Transaction error:", error);
                await safeRollback(transaction);
                res.status(500).json({ error: "Transaction failed", details: error.message });
            }

        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({ error: "An error occurred while updating the data.", details: error.message });
        }
    });



    router.get("/coldstorage/room/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
                SELECT
                    rmf.rmfp_id,
                    rmf.batch,
                    rm.mat,
                    rm.mat_name,
                    CONCAT(p.doc_no, ' (', rmf.rmfp_line_name, ')') AS production,
                    FORMAT(rmg.cold, 'N2') AS cold,
                    rmt.rm_status,
                    rmt.dest,
                    rmt.weight_per_tro,
                    rmt.ntray,
                    qc.qc_datetime,
                    htr.come_cold_date,
                    htr.out_cold_date
                FROM
                    RMInTrolley rmt
                JOIN  
                    RMForProd rmf ON rmt.rmfp_id = rmf.rmfp_id  
                JOIN
                    ProdRawMat pr ON rmf.prod_rm_id = pr.prod_rm_id
                JOIN
                    RawMat rm ON pr.mat = rm.mat
                JOIN
                    Production p ON pr.prod_id = p.prod_id
                JOIN
                    Line l ON p.line_id = l.line_id
                JOIN
                    RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                JOIN
                    QC qc ON rmt.qc_id = qc.qc_id
                JOIN
                    History htr ON rmt.rm_tro_id = htr.rm_tro_id
                WHERE 
                    rmf.rm_group_id = rmg.rm_group_id;

          `);
            // rmt.dest = 'ห้องเย็น'
            // AND rmt.stay_place = 'เข้าห้องเย็น'
            // 11:01

            const formattedData = result.recordset.map(item => {
                // แปลงวันที่ cooked_date
                if (item.cooked_date) {
                    const cookedDate = new Date(item.cooked_date);
                    const cookedYear = cookedDate.getUTCFullYear();
                    const cookedMonth = String(cookedDate.getUTCMonth() + 1).padStart(2, '0');
                    const cookedDay = String(cookedDate.getUTCDate()).padStart(2, '0');
                    const cookedHours = String(cookedDate.getUTCHours()).padStart(2, '0');
                    const cookedMinutes = String(cookedDate.getUTCMinutes()).padStart(2, '0');

                    item.CookedDateTime = `${cookedYear}-${cookedMonth}-${cookedDay} ${cookedHours}:${cookedMinutes}`;
                    delete item.cooked_date;
                }
                if (item.come_cold_date) {
                    const cookedDate = new Date(item.come_cold_date);
                    const cookedYear = cookedDate.getUTCFullYear();
                    const cookedMonth = String(cookedDate.getUTCMonth() + 1).padStart(2, '0');
                    const cookedDay = String(cookedDate.getUTCDate()).padStart(2, '0');
                    const cookedHours = String(cookedDate.getUTCHours()).padStart(2, '0');
                    const cookedMinutes = String(cookedDate.getUTCMinutes()).padStart(2, '0');

                    item.ComeColdDateTime = `${cookedYear}-${cookedMonth}-${cookedDay} ${cookedHours}:${cookedMinutes}`;
                    delete item.come_cold_date;
                }
                return item;
            });


            res.json({ success: true, data: formattedData });
        } catch (err) {
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/coldstorage/incold/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    COALESCE(b.batch_after, rmf.batch) AS batch,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,

    cs.cs_name,
    s.slot_id,

    htr.qccheck_cold,
    htr.remark_rework_cold,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(varchar, htr.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
    CONVERT(varchar, htr.cs_out_out_date_five, 120) AS cs_out_out_date_five,
    CONVERT(varchar, htr.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
    CONVERT(varchar, htr.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
    CONVERT(varchar, htr.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
    CONVERT(varchar, htr.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
    CONVERT(varchar, htr.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
    CONVERT(varchar, htr.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
    CONVERT(varchar, htr.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
    CONVERT(varchar, htr.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
    CONVERT(varchar, htr.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
    CONVERT(varchar, htr.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN Slot s
    ON rmm.tro_id = s.tro_id

JOIN ColdStorage cs
    ON s.cs_id = cs.cs_id


OUTER APPLY (
    SELECT STRING_AGG(batch_after, ', ') AS batch_after
    FROM Batch
    WHERE mapping_id = rmm.mapping_id
) b


OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.dest = 'ห้องเย็น'
    AND rmm.stay_place = 'เข้าห้องเย็น'
    AND rmm.tro_id IS NOT NULL

ORDER BY rmm.mapping_id DESC
`;

            const result = await pool.request().query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });


    /**
     * Trolleys that may be checked in to a cold room but are not in a slot yet (read only).
     * Same conditions as the check-in API: dest is one of the allowed destinations and the trolley has no Slot.
     * Same columns as /coldstorage/incold/fetchSlotRawMat (cs_name / slot_id are NULL) so the table can show both lists.
     */
    router.get("/coldstorage/pending/checkin", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
            const query = `
SELECT TOP (2000)
    rmm.mapping_id,
    rmf.rmfp_id,

    COALESCE(b.batch_after, rmf.batch) AS batch,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,

    CAST(NULL AS NVARCHAR(50)) AS cs_name,
    CAST(NULL AS VARCHAR(10)) AS slot_id,

    htr.qccheck_cold,
    htr.remark_rework_cold,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(varchar, htr.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
    CONVERT(varchar, htr.cs_out_out_date_five, 120) AS cs_out_out_date_five,
    CONVERT(varchar, htr.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
    CONVERT(varchar, htr.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
    CONVERT(varchar, htr.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
    CONVERT(varchar, htr.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
    CONVERT(varchar, htr.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
    CONVERT(varchar, htr.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
    CONVERT(varchar, htr.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
    CONVERT(varchar, htr.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
    CONVERT(varchar, htr.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
    CONVERT(varchar, htr.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id


OUTER APPLY (
    SELECT STRING_AGG(batch_after, ', ') AS batch_after
    FROM Batch
    WHERE mapping_id = rmm.mapping_id
) b


OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.tro_id IS NOT NULL
    AND rmm.dest IN (N'เข้าห้องเย็น', N'รอCheckin', N'ห้องเย็น', N'ส่งกลับจากห้องเย็นใหญ่')
    AND NOT EXISTS (SELECT 1 FROM Slot sx WHERE sx.tro_id = rmm.tro_id)

ORDER BY rmm.mapping_id DESC
`;
            const result = await pool.request().query(query);
            res.json(result.recordset);
        } catch (error) {
            console.error("[Route /coldstorage/pending/checkin] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.get('/mat-info/:mapping_id', async (req, res) => {
        const { mapping_id } = req.params;
        const result = await pool.request()
            .input('mapping_id', sql.Int, mapping_id)
            .query(`
            SELECT TOP (1) mat, mat_2x
            FROM [PFCMv2].[dbo].[Mat]
            WHERE mapping_id = @mapping_id
        `);
        res.json(result.recordset[0] || { mat: null, mat_2x: null });
    });

    router.get("/coldstorages/table/out", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const result = await pool
                .request()
                .query(`
                SELECT 
                    s.sap_re_id,
                    s.batch,
                    s.mat,
                    s.hu,
                    s.before_hu,
                    s.weight,
                    s.remark,
                    s.storage_purpose,
                    s.storage_purpose_2,
                    s.storage_purpose_3,
                    s.histamine,
                    s.histamine_2,
                    s.histamine_3,
                    s.pd_remark_1,
                    s.pd_remark_2,
                    s.pd_remark_3,
                    CONVERT(varchar, s.withdraw_date, 120)             AS withdraw_date,
                    CONVERT(varchar, s.start_defrost_date, 120)        AS start_defrost_date,
                    CONVERT(varchar, s.end_defrost_date, 120)          AS end_defrost_date,
                    CONVERT(varchar, s.start_defrost_date_two, 120)    AS start_defrost_date_two,
                    CONVERT(varchar, s.end_defrost_date_two, 120)      AS end_defrost_date_two,
                    CONVERT(varchar, s.start_defrost_date_three, 120)  AS start_defrost_date_three,
                    CONVERT(varchar, s.end_defrost_date_three, 120)    AS end_defrost_date_three,
                    CONVERT(varchar, s.start_defrost_date_four, 120)   AS start_defrost_date_four,
                    CONVERT(varchar, s.end_defrost_date_four, 120)     AS end_defrost_date_four,
                    CONVERT(varchar, s.input_pd_date, 120)             AS input_pd_date,
                    CONVERT(varchar, s.output_pd_date, 120)            AS output_pd_date,
                    CONVERT(varchar, s.input_cd_date, 120)             AS input_cd_date,
                    CONVERT(varchar, s.withdraw_date_two, 120)         AS withdraw_date_two,
                    CONVERT(varchar, s.input_pd_date_two, 120)         AS input_pd_date_two,
                    CONVERT(varchar, s.output_pd_date_two, 120)        AS output_pd_date_two,
                    CONVERT(varchar, s.input_cd_date_two, 120)         AS input_cd_date_two,
                    CONVERT(varchar, s.withdraw_date_three, 120)       AS withdraw_date_three,
                    CONVERT(varchar, s.input_pd_date_three, 120)       AS input_pd_date_three,
                    CONVERT(varchar, s.output_pd_date_three, 120)      AS output_pd_date_three,
                    CONVERT(varchar, s.input_cd_date_three, 120)       AS input_cd_date_three,
                    CONVERT(varchar, s.withdraw_date_four, 120)        AS withdraw_date_four
                FROM SAP_Receive s
                WHERE status = 1
                  AND s.hu NOT IN (SELECT before_hu FROM SAP_Receive WHERE before_hu IS NOT NULL)
                  AND (
                    (input_cd_date IS NOT NULL AND withdraw_date_two IS NULL)
                    OR
                    (input_cd_date_two IS NOT NULL AND withdraw_date_three IS NULL)
                    OR
                    (input_cd_date_three IS NOT NULL AND withdraw_date_four IS NULL)
                  )
            `);

            res.json({ success: true, data: result.recordset });

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ success: false, error: "Internal Server Error" });
        }
    });


    // ตาราง Time Stamp รวมของวัตถุดิบไม่แปรรูป (SAP_Receive) — อ่านอย่างเดียว
    // ส่งรายการที่มีความเคลื่อนไหวภายใน ?days วัน (ค่าเริ่มต้น 14) และรายการที่ยังค้างอยู่ (อยู่ในห้องเย็น / รอรับเข้า) ไม่ว่าเก่าแค่ไหน
    router.get("/coldstorages/sap/unified", async (req, res) => {
        try {
            const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 365);
            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(503).json({ success: false, error: "Database unavailable" });
            }

            const result = await pool.request()
                .input("days", sql.Int, days)
                .query(`
                SELECT TOP (3000)
                    s.sap_re_id,
                    s.batch,
                    s.mat,
                    rm.mat_name,
                    s.hu,
                    s.before_hu,
                    s.weight,
                    s.remark,
                    s.cs_re,
                    s.cs_re_2,
                    s.cs_re_3,
                    CONVERT(varchar, s.withdraw_date, 120) AS withdraw_date,
                    CONVERT(varchar, s.start_defrost_date, 120) AS start_defrost_date,
                    CONVERT(varchar, s.end_defrost_date, 120) AS end_defrost_date,
                    CONVERT(varchar, s.input_pd_date, 120) AS input_pd_date,
                    CONVERT(varchar, s.output_pd_date, 120) AS output_pd_date,
                    CONVERT(varchar, s.input_cd_date, 120) AS input_cd_date,
                    CONVERT(varchar, s.withdraw_date_two, 120) AS withdraw_date_two,
                    CONVERT(varchar, s.start_defrost_date_two, 120) AS start_defrost_date_two,
                    CONVERT(varchar, s.end_defrost_date_two, 120) AS end_defrost_date_two,
                    CONVERT(varchar, s.input_pd_date_two, 120) AS input_pd_date_two,
                    CONVERT(varchar, s.output_pd_date_two, 120) AS output_pd_date_two,
                    CONVERT(varchar, s.input_cd_date_two, 120) AS input_cd_date_two,
                    CONVERT(varchar, s.withdraw_date_three, 120) AS withdraw_date_three,
                    CONVERT(varchar, s.start_defrost_date_three, 120) AS start_defrost_date_three,
                    CONVERT(varchar, s.end_defrost_date_three, 120) AS end_defrost_date_three,
                    CONVERT(varchar, s.input_pd_date_three, 120) AS input_pd_date_three,
                    CONVERT(varchar, s.output_pd_date_three, 120) AS output_pd_date_three,
                    CONVERT(varchar, s.input_cd_date_three, 120) AS input_cd_date_three,
                    CONVERT(varchar, s.withdraw_date_four, 120) AS withdraw_date_four,
                    CONVERT(varchar, s.start_defrost_date_four, 120) AS start_defrost_date_four,
                    CONVERT(varchar, s.end_defrost_date_four, 120) AS end_defrost_date_four
                FROM SAP_Receive s
                LEFT JOIN RawMat rm ON rm.mat = s.mat
                CROSS APPLY (
                    SELECT MAX(v.d) AS last_at
                    FROM (VALUES (s.withdraw_date),(s.start_defrost_date),(s.end_defrost_date),(s.input_pd_date),(s.output_pd_date),(s.input_cd_date),(s.withdraw_date_two),(s.start_defrost_date_two),(s.end_defrost_date_two),(s.input_pd_date_two),(s.output_pd_date_two),(s.input_cd_date_two),(s.withdraw_date_three),(s.start_defrost_date_three),(s.end_defrost_date_three),(s.input_pd_date_three),(s.output_pd_date_three),(s.input_cd_date_three),(s.withdraw_date_four),(s.start_defrost_date_four),(s.end_defrost_date_four)) AS v(d)
                ) la
                WHERE s.status = 1
                  AND (
                        la.last_at >= DATEADD(DAY, -@days, GETDATE())
                        OR (s.input_cd_date IS NOT NULL AND s.withdraw_date_two IS NULL)
                        OR (s.input_cd_date_two IS NOT NULL AND s.withdraw_date_three IS NULL)
                        OR (s.input_cd_date_three IS NOT NULL AND s.withdraw_date_four IS NULL)
                        OR (s.output_pd_date IS NOT NULL AND s.input_cd_date IS NULL)
                        OR (s.output_pd_date_two IS NOT NULL AND s.input_cd_date_two IS NULL)
                        OR (s.output_pd_date_three IS NOT NULL AND s.input_cd_date_three IS NULL)
                  )
                ORDER BY la.last_at DESC, s.sap_re_id DESC
            `);

            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("[Route /coldstorages/sap/unified] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.get("/coldstorages/incold/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    COALESCE(b.batch_after, rmf.batch) AS batch,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,
    rmg.rm_group_name,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,

    cs.cs_name,
    s.slot_id,

    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,
    
    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,

    htr.remark,
    htr.weight,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three,
    CONVERT(varchar, qc.qc_datetime,      120) AS qc_datetime,
    CONVERT(varchar, qc.md_time,      120) AS md_time

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN Slot s
    ON rmm.tro_id = s.tro_id

JOIN ColdStorage cs
    ON s.cs_id = cs.cs_id

JOIN QC qc
    ON rmm.qc_id = qc.qc_id


OUTER APPLY (
    SELECT STRING_AGG(batch_after, ', ') AS batch_after
    FROM Batch
    WHERE mapping_id = rmm.mapping_id
) b


OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.dest = 'ในห้องเย็นใหญ่'
    AND rmm.stay_place = 'เข้าห้องเย็นใหญ่'
    AND rmm.tro_id IS NOT NULL

ORDER BY rmm.mapping_id DESC
`;

            const result = await pool.request().query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
    // รายการที่รับเข้าห้องเย็นใหญ่ได้ (รถเข็นที่ยังไม่อยู่ในช่องจอดใดๆ และปลายทางคือห้องเย็นใหญ่) — อ่านอย่างเดียว
    // เงื่อนไขเดียวกับ PUT /largecold/checkin/update/Trolley: รถเข็นมีวัตถุดิบ และยังไม่อยู่ใน Slot
    router.get("/coldstorages/pending/checkin", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            if (!pool) {
                return res.status(503).json({ success: false, error: "Database unavailable" });
            }

            const query = `

SELECT TOP (2000)
    rmm.mapping_id,
    rmf.rmfp_id,

    COALESCE(b.batch_after, rmf.batch) AS batch,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,
    rmg.rm_group_name,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.stay_place,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,


    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,
    htr.at_pd_cold_remark,
    htr.at_pd_cold_remark_2,
    htr.at_pd_cold_remark_3,
    CONVERT(varchar, htr.at_pd_deposit_date,   120) AS at_pd_deposit_date,
    CONVERT(varchar, htr.at_pd_deposit_date_2, 120) AS at_pd_deposit_date_2,
    CONVERT(varchar, htr.at_pd_deposit_date_3, 120) AS at_pd_deposit_date_3,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,

    htr.remark,
    htr.weight,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,
    CAST(NULL AS INT) AS cs_id,
    CAST(NULL AS NVARCHAR(100)) AS cs_name,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id


OUTER APPLY (
    SELECT STRING_AGG(batch_after, ', ') AS batch_after
    FROM Batch
    WHERE mapping_id = rmm.mapping_id
) b


OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.dest IN (N'ห้องเย็นใหญ่', N'เข้าห้องเย็นใหญ่')
    AND rmm.tro_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM Slot sx WHERE sx.tro_id = rmm.tro_id)
ORDER BY rmm.mapping_id DESC
`;

            const result = await pool.request().query(query);
            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("[Route /coldstorages/pending/checkin] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.get("/coldstorages/incold/fetchSlotRawMatsend", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    COALESCE(b.batch_after, rmf.batch) AS batch,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,
    rmg.rm_group_name,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.stay_place,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,


    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,
    htr.at_pd_cold_remark,
    htr.at_pd_cold_remark_2,
    htr.at_pd_cold_remark_3,
    CONVERT(varchar, htr.at_pd_deposit_date,   120) AS at_pd_deposit_date,
    CONVERT(varchar, htr.at_pd_deposit_date_2, 120) AS at_pd_deposit_date_2,
    CONVERT(varchar, htr.at_pd_deposit_date_3, 120) AS at_pd_deposit_date_3,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,

    htr.remark,
    htr.weight,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,
    cs.cs_id,
    cs.cs_name,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN Slot s
    ON rmm.tro_id = s.tro_id

JOIN ColdStorage cs
    ON s.cs_id = cs.cs_id

OUTER APPLY (
    SELECT STRING_AGG(batch_after, ', ') AS batch_after
    FROM Batch
    WHERE mapping_id = rmm.mapping_id
) b


OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.dest in ( 'เข้าห้องเย็นใหญ่','ในห้องเย็นใหญ่')
    AND rmm.tro_id IS NOT NULL
ORDER BY rmm.mapping_id DESC
`;

            const result = await pool.request().query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.get("/coldstorages/cs2", async (req, res) => {
        try {
            const { start_defrost_from, start_defrost_to, withdraw_from, withdraw_to } = req.query;
            const pool = await connectToDatabase();
            const request = pool.request();

            let extraWhere = '';
            if (start_defrost_from) { request.input('sdf', sql.NVarChar, start_defrost_from); extraWhere += ` AND s.start_defrost_date >= @sdf`; }
            if (start_defrost_to) { request.input('sdt', sql.NVarChar, start_defrost_to); extraWhere += ` AND s.start_defrost_date <= @sdt`; }
            if (withdraw_from) { request.input('wdf', sql.NVarChar, withdraw_from); extraWhere += ` AND s.withdraw_date >= @wdf`; }
            if (withdraw_to) { request.input('wdt', sql.NVarChar, withdraw_to); extraWhere += ` AND s.withdraw_date <= @wdt`; }

            const result = await request.query(`
                SELECT
                    s.sap_re_id,
                    s.hu,
                    s.batch,
                    s.mat,
                    rm.mat_name,
                    CONVERT(varchar, s.start_defrost_date,     120) AS start_defrost_date,
                    CONVERT(varchar, s.end_defrost_date,       120) AS end_defrost_date,
                    CONVERT(varchar, s.withdraw_date,          120) AS withdraw_date,
                    CONVERT(varchar, s.start_defrost_date_two, 120) AS start_defrost_date_two,
                    CONVERT(varchar, s.end_defrost_date_two,   120) AS end_defrost_date_two,
                    CONVERT(varchar, s.withdraw_date_two,      120) AS withdraw_date_two,
                    CONVERT(varchar, s.input_pd_date,          120) AS input_pd_date,
                    CONVERT(varchar, s.input_pd_date_two,      120) AS input_pd_date_two
                FROM SAP_Receive s
                JOIN rawmat rm ON s.mat = rm.mat
                WHERE 1=1 ${extraWhere}
                ORDER BY s.sap_re_id DESC
            `);

            res.json({ success: true, data: result.recordset });

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ success: false, error: "Internal Server Error" });
        }
    });

    router.get("/all/delay/tracking/rm", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const {
                mat, batch_before, batch_after, hu,
                mat_name, code, doc_no, rmm_line_name,
                sc_pack_date_from, sc_pack_date_to
            } = req.query;

            const request = pool.request();
            const filters = [];

            if (mat) {
                filters.push("rm.mat LIKE '%' + @mat + '%'");
                request.input("mat", sql.NVarChar, mat);
            }
            if (batch_before) {
                filters.push("b.batch_before LIKE '%' + @batch_before + '%'");
                request.input("batch_before", sql.NVarChar, batch_before);
            }
            if (batch_after) {
                filters.push("b.batch_after LIKE '%' + @batch_after + '%'");
                request.input("batch_after", sql.NVarChar, batch_after);
            }
            if (hu) {
                filters.push("CAST(htr.hu AS NVARCHAR) LIKE '%' + @hu + '%'");
                request.input("hu", sql.NVarChar, hu);
            }
            if (mat_name) {
                filters.push("rm.mat_name LIKE '%' + @mat_name + '%'");
                request.input("mat_name", sql.NVarChar, mat_name);
            }
            if (code) {
                filters.push("p.code LIKE '%' + @code + '%'");
                request.input("code", sql.NVarChar, code);
            }
            if (doc_no) {
                filters.push("p.doc_no LIKE '%' + @doc_no + '%'");
                request.input("doc_no", sql.NVarChar, doc_no);
            }
            if (rmm_line_name) {
                filters.push("htr.rmm_line_name LIKE '%' + @rmm_line_name + '%'");
                request.input("rmm_line_name", sql.NVarChar, rmm_line_name);
            }
            if (sc_pack_date_from) {
                filters.push("htr.sc_pack_date >= @sc_pack_date_from");
                request.input("sc_pack_date_from", sql.DateTime, new Date(sc_pack_date_from));
            }
            if (sc_pack_date_to) {
                filters.push("htr.sc_pack_date < DATEADD(day, 1, @sc_pack_date_to)");
                request.input("sc_pack_date_to", sql.DateTime, new Date(sc_pack_date_to));
            }

            const extraWhere = filters.length > 0
                ? filters.map(f => `    AND ${f}`).join('\n')
                : '';

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    b.batch_after,
    b.batch_before,

    rm.mat,
    m.mat_2x,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,
    htr.rmm_line_name,

     p.doc_no,
     p.code,       
    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,

    htr.viscosity,
    htr.temps,
    htr.weight_per_cup,
    htr.id_igd AS wo_no,
    htr.id_igd_no AS basket_no,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(varchar, htr.sc_pack_date, 120) AS sc_pack_date,
    CONVERT(varchar, htr.start_mixed_date, 120) AS start_mixed_date,
    CONVERT(varchar, htr.start_gravy_date, 120) AS start_gravy_date,
    CONVERT(varchar, htr.pack_checkin_date, 120) AS pack_checkin_date,
    CONVERT(varchar, htr.gm_date, 120) AS gm_date,

    rmm.weight_rm,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,
    rmf.hu,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three,
    CONVERT(varchar, qc.qc_datetime,      120) AS qc_datetime,
    CONVERT(varchar, qc.md_time,      30) AS md_time,
    CONVERT(varchar, qc.color,      30) AS color,
    CONVERT(varchar, qc.odor,      30) AS odor,
    CONVERT(varchar, qc.texture,      30) AS texture,
    CONVERT(varchar, qc.md,      30) AS md,
    CONVERT(varchar, qc.defect,      30) AS defect

    

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN QC qc
    ON rmm.qc_id = qc.qc_id

    JOIN batch b
    ON rmm.mapping_id = b.mapping_id

JOIN Mat m
ON rmm.mapping_id = m.mapping_id





OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
    rmm.dest = 'บรรจุเสร็จ'
    AND rmm.stay_place = 'บรรจุเสร็จ'
    AND rmm.tro_id IS NULL
    AND htr.sc_pack_date IS NOT NULL
${extraWhere}

ORDER BY rmm.mapping_id DESC
`;

            const result = await request.query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.get("/all/delay/tracking/rm/inprocess/v2", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const {
                mat, batch_before, batch_after, hu,
                mat_name, code, doc_no, rmm_line_name,
                sc_pack_date_from, sc_pack_date_to
            } = req.query;

            const request = pool.request();
            const filters = [];

            if (mat) {
                filters.push("rm.mat LIKE '%' + @mat + '%'");
                request.input("mat", sql.NVarChar, mat);
            }
            if (batch_before) {
                filters.push("b.batch_before LIKE '%' + @batch_before + '%'");
                request.input("batch_before", sql.NVarChar, batch_before);
            }
            if (batch_after) {
                filters.push("b.batch_after LIKE '%' + @batch_after + '%'");
                request.input("batch_after", sql.NVarChar, batch_after);
            }
            if (hu) {
                filters.push("CAST(htr.hu AS NVARCHAR) LIKE '%' + @hu + '%'");
                request.input("hu", sql.NVarChar, hu);
            }
            if (mat_name) {
                filters.push("rm.mat_name LIKE '%' + @mat_name + '%'");
                request.input("mat_name", sql.NVarChar, mat_name);
            }
            if (code) {
                filters.push("p.code LIKE '%' + @code + '%'");
                request.input("code", sql.NVarChar, code);
            }
            if (doc_no) {
                filters.push("p.doc_no LIKE '%' + @doc_no + '%'");
                request.input("doc_no", sql.NVarChar, doc_no);
            }
            if (rmm_line_name) {
                filters.push("htr.rmm_line_name LIKE '%' + @rmm_line_name + '%'");
                request.input("rmm_line_name", sql.NVarChar, rmm_line_name);
            }
            if (sc_pack_date_from) {
                filters.push("htr.sc_pack_date >= @sc_pack_date_from");
                request.input("sc_pack_date_from", sql.DateTime, new Date(sc_pack_date_from));
            }
            if (sc_pack_date_to) {
                filters.push("htr.sc_pack_date < DATEADD(day, 1, @sc_pack_date_to)");
                request.input("sc_pack_date_to", sql.DateTime, new Date(sc_pack_date_to));
            }

            const extraWhere = filters.length > 0
                ? filters.map(f => `    AND ${f}`).join('\n')
                : '';

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    b.batch_after,
    b.batch_before,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,
    htr.rmm_line_name,

     p.doc_no,
     p.code,       
    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,

    htr.viscosity,
    htr.temps,
    htr.weight_per_cup,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(varchar, htr.sc_pack_date, 120) AS sc_pack_date,
    CONVERT(varchar, htr.start_mixed_date, 120) AS start_mixed_date,
    CONVERT(varchar, htr.start_gravy_date, 120) AS start_gravy_date,
    CONVERT(varchar, htr.pack_checkin_date, 120) AS pack_checkin_date,
    CONVERT(varchar, htr.gm_date, 120) AS gm_date,

    rmm.weight_rm,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,
    rmf.hu,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three,
    CONVERT(varchar, qc.qc_datetime,      120) AS qc_datetime,
    CONVERT(varchar, qc.md_time,      120) AS md_time

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN QC qc
    ON rmm.qc_id = qc.qc_id

    JOIN batch b
    ON rmm.mapping_id = b.mapping_id





OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE
     rmm.tro_id IS NOT NULL
     AND htr.sc_pack_date IS NULL -- in process = not packed yet (no sc_pack_date)
${extraWhere}

ORDER BY rmm.mapping_id DESC
`;

            const result = await request.query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.get("/all/delay/tracking/rm/inprocess", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const {
                mat, batch_before, batch_after, hu,
                mat_name, code, doc_no, rmm_line_name,
                sc_pack_date_from, sc_pack_date_to
            } = req.query;

            const request = pool.request();
            const filters = [];

            if (mat) {
                filters.push("rm.mat LIKE '%' + @mat + '%'");
                request.input("mat", sql.NVarChar, mat);
            }
            if (batch_before) {
                filters.push("b.batch_before LIKE '%' + @batch_before + '%'");
                request.input("batch_before", sql.NVarChar, batch_before);
            }
            if (batch_after) {
                filters.push("b.batch_after LIKE '%' + @batch_after + '%'");
                request.input("batch_after", sql.NVarChar, batch_after);
            }
            if (hu) {
                filters.push("CAST(htr.hu AS NVARCHAR) LIKE '%' + @hu + '%'");
                request.input("hu", sql.NVarChar, hu);
            }
            if (mat_name) {
                filters.push("rm.mat_name LIKE '%' + @mat_name + '%'");
                request.input("mat_name", sql.NVarChar, mat_name);
            }
            if (code) {
                filters.push("p.code LIKE '%' + @code + '%'");
                request.input("code", sql.NVarChar, code);
            }
            if (doc_no) {
                filters.push("p.doc_no LIKE '%' + @doc_no + '%'");
                request.input("doc_no", sql.NVarChar, doc_no);
            }
            if (rmm_line_name) {
                filters.push("htr.rmm_line_name LIKE '%' + @rmm_line_name + '%'");
                request.input("rmm_line_name", sql.NVarChar, rmm_line_name);
            }
            if (sc_pack_date_from) {
                filters.push("htr.sc_pack_date >= @sc_pack_date_from");
                request.input("sc_pack_date_from", sql.DateTime, new Date(sc_pack_date_from));
            }
            if (sc_pack_date_to) {
                filters.push("htr.sc_pack_date < DATEADD(day, 1, @sc_pack_date_to)");
                request.input("sc_pack_date_to", sql.DateTime, new Date(sc_pack_date_to));
            }

            const extraWhere = filters.length > 0
                ? filters.map(f => `    AND ${f}`).join('\n')
                : '';

            const query = `
SELECT
    rmm.mapping_id,
    rmf.rmfp_id,

    b.batch_after,
    b.batch_before,

    rm.mat,
    rm.mat_name,

    CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,

    CAST(rmm.prep_to_cold_time AS DECIMAL(10,2)) AS ptc_time,
    CAST(COALESCE(rmm.cold_time, rmg.cold) AS DECIMAL(10,2)) AS cold,
    CAST(rmm.rework_time AS DECIMAL(10,2)) AS rework_time,
    CAST(rmm.mix_time AS DECIMAL(10,2)) AS mix_time,

    CAST(rmg.cold AS DECIMAL(10,2)) AS standard_cold,
    CAST(rmg.rework AS DECIMAL(10,2)) AS standard_rework,

    rmf.rm_group_id AS rmf_rm_group_id,
    rmg.rm_group_id AS rmg_rm_group_id,

    rmm.tro_id,
    rmm.rm_cold_status,
    rmm.rm_status,
    rmm.dest,

    rmm.weight_RM,
    rmm.tray_count,
    rmm.level_eu,

    htr.hist_id,
    htr.rmm_line_name,

     p.doc_no,
     p.code,       
    htr.qccheck_cold,
    htr.remark_rework_cold,
    htr.receiver_out_cold,
    htr.receiver_out_cold_two,
    htr.receiver_out_cold_three,
    htr.rd_section_colds,
    htr.storage_purpose,
    htr.histamine,
    htr.at_pd_storage_purpose,
    htr.at_pd_histamine,
    htr.at_pd_storage_purpose_2,
    htr.at_pd_histamine_2,
    htr.at_pd_storage_purpose_3,
    htr.at_pd_histamine_3,

    htr.viscosity,
    htr.temps,
    htr.weight_per_cup,

    CONVERT(varchar, htr.withdraw_date, 120) AS withdraw_date,
    CONVERT(varchar, htr.cooked_date, 120) AS cooked_date,
    CONVERT(varchar, htr.rmit_date, 120) AS rmit_date,
    CONVERT(varchar, htr.come_cold_date, 120) AS come_cold_date,
    CONVERT(varchar, htr.come_cold_date_two, 120) AS come_cold_date_two,
    CONVERT(varchar, htr.come_cold_date_three, 120) AS come_cold_date_three,
    CONVERT(varchar, htr.out_cold_date, 120) AS out_cold_date,
    CONVERT(varchar, htr.out_cold_date_two, 120) AS out_cold_date_two,
    CONVERT(varchar, htr.out_cold_date_three, 120) AS out_cold_date_three,
    CONVERT(varchar, htr.rework_date, 120) AS rework_date,
    CONVERT(varchar, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
    CONVERT(varchar, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
    CONVERT(varchar, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
    CONVERT(varchar, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
    CONVERT(varchar, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
    CONVERT(varchar, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
    CONVERT(varchar, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
    CONVERT(varchar, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
    CONVERT(varchar, htr.sc_pack_date, 120) AS sc_pack_date,
    CONVERT(varchar, htr.start_mixed_date, 120) AS start_mixed_date,
    CONVERT(varchar, htr.start_gravy_date, 120) AS start_gravy_date,
    CONVERT(varchar, htr.pack_checkin_date, 120) AS pack_checkin_date,
    CONVERT(varchar, htr.gm_date, 120) AS gm_date,

    rmm.weight_rm,
    htr.pd_send,
    htr.pd_send2,
    htr.pd_send3,
    htr.cs_re,
    htr.cs_re_2,
    htr.cs_re_3,
    htr.storage_purpose_2,
    htr.storage_purpose_3,
    htr.histamine_2,
    htr.histamine_3,
    htr.cs_wd_2,
    htr.cs_wd_3,
    htr.cs_wd_4,
    rmf.hu,

    CONVERT(varchar, htr.start_defrost_date,       120) AS start_defrost_date,
    CONVERT(varchar, htr.end_defrost_date,         120) AS end_defrost_date,
    CONVERT(varchar, htr.start_defrost_date_two,   120) AS start_defrost_date_two,
    CONVERT(varchar, htr.end_defrost_date_two,     120) AS end_defrost_date_two,
    CONVERT(varchar, htr.start_defrost_date_three, 120) AS start_defrost_date_three,
    CONVERT(varchar, htr.end_defrost_date_three,   120) AS end_defrost_date_three,
    CONVERT(varchar, htr.start_defrost_date_four,  120) AS start_defrost_date_four,
    CONVERT(varchar, htr.end_defrost_date_four,    120) AS end_defrost_date_four,
    CONVERT(varchar, htr.input_pd_date,            120) AS input_pd_date,
    CONVERT(varchar, htr.input_pd_date_two,        120) AS input_pd_date_two,
    CONVERT(varchar, htr.input_pd_date_three,      120) AS input_pd_date_three,
    CONVERT(varchar, htr.output_pd_date,           120) AS output_pd_date,
    CONVERT(varchar, htr.output_pd_date_two,       120) AS output_pd_date_two,
    CONVERT(varchar, htr.output_pd_date_three,     120) AS output_pd_date_three,
    CONVERT(varchar, htr.withdraw_date_two,        120) AS withdraw_date_two,
    CONVERT(varchar, htr.withdraw_date_three,      120) AS withdraw_date_three,
    CONVERT(varchar, htr.withdraw_date_four,       120) AS withdraw_date_four,
    CONVERT(varchar, htr.input_cd_date,            120) AS input_cd_date,
    CONVERT(varchar, htr.input_cd_date_two,        120) AS input_cd_date_two,
    CONVERT(varchar, htr.input_cd_date_three,      120) AS input_cd_date_three,
    CONVERT(varchar, qc.qc_datetime,      120) AS qc_datetime,
    CONVERT(varchar, qc.md_time,      120) AS md_time

FROM TrolleyRMMapping rmm

JOIN RMForProd rmf
    ON rmm.rmfp_id = rmf.rmfp_id

JOIN ProdRawMat pr
    ON rmm.tro_production_id = pr.prod_rm_id

JOIN RawMat rm
    ON pr.mat = rm.mat

JOIN Production p
    ON pr.prod_id = p.prod_id

JOIN RawMatGroup rmg
    ON rmf.rm_group_id = rmg.rm_group_id

JOIN QC qc
    ON rmm.qc_id = qc.qc_id

    JOIN batch b
    ON rmm.mapping_id = b.mapping_id





OUTER APPLY (
    SELECT TOP 1 *
    FROM History h
    WHERE h.mapping_id = rmm.mapping_id
    ORDER BY h.hist_id DESC
) htr


WHERE

     rmm.tro_id IS NOT NULL
     AND htr.sc_pack_date IS NULL -- in process = not packed yet (no sc_pack_date)

${extraWhere}

ORDER BY rmm.mapping_id DESC
`;

            const result = await request.query(query);

            res.json(result.recordset);

        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.get("/coldstorage/incold/mix/fetchSlotRawMat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
                    SELECT
                        rmm.mapping_id,
                        rmm.mix_code,
                        CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS production,
                        FORMAT(rmm.mix_time, 'N2') AS mix_time,
                        rmm.tro_id,
                        rmm.rm_cold_status,
                        rmm.rm_status,
                        rmm.dest,
                        rmm.weight_RM,
                        rmm.tray_count,
                        cs.cs_name,  -- เพิ่ม cs_name จากตาราง ColdStorage
                        s.slot_id,
                        CONVERT(VARCHAR, htr.mixed_date, 120) AS mixed_date,
                        CONVERT(VARCHAR, htr.come_cold_date, 120) AS come_cold_date,
                        CONVERT(VARCHAR, htr.come_cold_date_two, 120) AS come_cold_date_two,
                        CONVERT(VARCHAR, htr.come_cold_date_three, 120) AS come_cold_date_three,
                        CONVERT(VARCHAR, htr.out_cold_date, 120) AS out_cold_date,
                        CONVERT(VARCHAR, htr.out_cold_date_two, 120) AS out_cold_date_two,
                        CONVERT(VARCHAR, htr.out_cold_date_three, 120) AS out_cold_date_three,
                        CONVERT(VARCHAR, htr.cs_come_cold_date, 120) AS cs_come_cold_date,
                        CONVERT(VARCHAR, htr.cs_out_cold_date, 120) AS cs_out_cold_date,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_two, 120) AS cs_come_cold_date_two,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_two, 120) AS cs_out_cold_date_two,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_three, 120) AS cs_come_cold_date_three,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_three, 120) AS cs_out_cold_date_three,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_four, 120) AS cs_come_cold_date_four,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_four, 120) AS cs_out_cold_date_four,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_five, 120) AS cs_come_cold_date_five,
                        CONVERT(VARCHAR, htr.cs_out_out_date_five, 120) AS cs_out_out_date_five,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_six, 120) AS cs_come_cold_date_six,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_six, 120) AS cs_out_cold_date_six,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_seven, 120) AS cs_come_cold_date_seven,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_seven, 120) AS cs_out_cold_date_seven,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_eight, 120) AS cs_come_cold_date_eight,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_eight, 120) AS cs_out_cold_date_eight,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_nine, 120) AS cs_come_cold_date_nine,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_nine, 120) AS cs_out_cold_date_nine,
                        CONVERT(VARCHAR, htr.cs_come_cold_date_ten, 120) AS cs_come_cold_date_ten,
                        CONVERT(VARCHAR, htr.cs_out_cold_date_ten, 120) AS cs_out_cold_date_ten

                    FROM
                        TrolleyRMMapping rmm
                    JOIN
                        Production p ON rmm.prod_mix = p.prod_id
                    OUTER APPLY (
                        SELECT TOP 1 * FROM History h
                        WHERE h.mapping_id = rmm.mapping_id
                        ORDER BY h.hist_id DESC
                    ) htr
                    JOIN
                        Slot s ON rmm.tro_id = s.tro_id
                    JOIN
                        ColdStorage cs ON s.cs_id = cs.cs_id
                    WHERE
                        rmm.dest = 'ห้องเย็น'
                        AND rmm.stay_place = 'เข้าห้องเย็น'
                        AND rmm.tro_id IS NOT NULL
                `);

            // แก้ไขรูปแบบวันที่ให้เป็นแบบเดียวกันทั้งหมด (แทนที่ T ด้วยช่องว่าง)
            const formattedData = result.recordset.map(record => {
                // สร้าง object ใหม่เพื่อไม่ให้แก้ไข record เดิม
                const newRecord = { ...record };

                // แปลงฟิลด์วันที่ทั้งหมด
                const dateFields = [
                    'withdraw_date', 'cooked_date', 'rmit_date',
                    'come_cold_date', 'come_cold_date_two', 'come_cold_date_three',
                    'out_cold_date', 'out_cold_date_two', 'out_cold_date_three', 'rework_date'
                ];

                // แทนที่ T ด้วยช่องว่างในทุกฟิลด์วันที่
                dateFields.forEach(field => {
                    if (newRecord[field]) {
                        newRecord[field] = newRecord[field].replace('T', ' ');
                    }
                });

                return newRecord;
            });

            return res.json(Object.values(formattedData));
        } catch (error) {
            console.error("Error fetching data:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.put("/qc/cold/check", async (req, res) => {
        let transaction;
        try {
            const {
                mapping_id,
                color,
                odor,
                texture,
                inspector_cold,
                remark,
                approver // เพิ่มรับ approver จาก request
            } = req.body;

            if (
                !mapping_id ||
                isNaN(mapping_id) ||
                color === undefined ||
                odor === undefined ||
                texture === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: "กรุณากรอกข้อมูลให้ครบถ้วน",
                });
            }

            const pool = await connectToDatabase();

            // ตรวจสอบ mapping_id
            const mappingCheck = await pool
                .request()
                .input("mapping_id", sql.Int, mapping_id)
                .query(`
                SELECT mapping_id, qc_id, rm_status
                FROM [PFCMv2].[dbo].[TrolleyRMMapping]
                WHERE mapping_id = @mapping_id
            `);

            if (mappingCheck.recordset.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `ไม่พบ mapping_id ${mapping_id} ในระบบ`,
                });
            }

            // ตรวจสอบว่าวัตถุดิบนี้ตรวจสอบแล้วหรือไม่
            if (mappingCheck.recordset[0].rm_status === 'QcCheck') {
                return res.status(400).json({
                    success: false,
                    message: "วัตถุดิบนี้ตรวจสอบแล้ว ไม่สามารถตรวจสอบซ้ำได้",
                });
            }

            // กำหนดค่า default
            let rm_status = "QcCheck";
            let qccheck = "ผ่าน";

            if ([color, odor, texture].includes(0)) {
                rm_status = "รอแก้ไข";
                qccheck = "ไม่ผ่าน";

                // ตรวจสอบว่ามี remark หรือไม่เมื่อไม่ผ่าน
                if (!remark || remark.trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: "กรุณากรอกหมายเหตุเมื่อมีข้อที่ไม่ผ่าน",
                    });
                }
            }

            // เริ่ม transaction
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            await transaction
                .request()
                .input("mapping_id", sql.Int, mappingCheck.recordset[0].mapping_id)
                .input("rm_status", sql.NVarChar, rm_status)
                .query(`UPDATE TrolleyRMMapping
                    SET rm_status = @rm_status,
                        updated_at = GETDATE()
                    WHERE mapping_id = @mapping_id
                `)

            await transaction
                .request()
                .input("mapping_id", sql.Int, mappingCheck.recordset[0].mapping_id)
                .input("inspector_cold", sql.NVarChar, inspector_cold)
                .input("qccheck_cold", sql.NVarChar, qccheck)
                .input("remark", sql.NVarChar, remark || null)
                .input("approver", sql.NVarChar, approver || null) // เพิ่ม approver
                .query(`
                UPDATE History
                SET 
                    qccheck_cold = @qccheck_cold,
                    remark_rework_cold = @remark,
                    receiver_qc_cold = @inspector_cold,
                    approver = @approver
                WHERE mapping_id = @mapping_id
            `);

            // ✅ Commit
            await transaction.commit();

            // ✅ Emit ผ่าน Socket.IO
            const io = req.app.get("io");
            const formattedData = {
                mappingId: mapping_id,
                qcId: mappingCheck.recordset[0].qc_id,
                rmStatus: rm_status,
                qccheck,
                updatedAt: new Date(),
                remark,
                approver // ส่ง approver ไปด้วย
            };
            io.to("QcCheckRoom").emit("dataUpdated", formattedData);

            // ✅ Response
            res.json({
                success: true,
                message: "บันทึกข้อมูลสำเร็จ",
                data: formattedData
            });

        } catch (err) {
            console.error("SQL Error:", err);
            if (transaction) {
                await safeRollback(transaction);
            }
            res.status(500).json({
                success: false,
                message: "เกิดข้อผิดพลาดในระบบ",
                error: err.message,
                stack: err.stack,
            });
        }
    });



    router.put("/cold/checkin/update/Trolley", async (req, res) => {
        const { tro_id, cs_id, slot_id, selectedOption } = req.body;

        const pool = await connectToDatabase();
        const transaction = pool.transaction();

        try {
            await transaction.begin();

            // ตรวจสอบว่ารถเข็นมีอยู่ในระบบหรือไม่
            const trolleyResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT tro_status, rsrv_timestamp FROM Trolley WHERE tro_id = @tro_id");

            if (trolleyResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "รถเข็นไม่พร้อมใช้งาน" });
            }

            // ตรวจสอบว่ารถเข็นอยู่ในห้องเย็นอยู่แล้วหรือไม่
            const trolleyInColdResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT cs_id, slot_id FROM Slot WHERE tro_id = @tro_id");

            if (trolleyInColdResult.recordset.length > 0) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `รถเข็นนี้อยู่ในห้องเย็นอยู่แล้ว (ช่อง ${trolleyInColdResult.recordset[0].slot_id})`
                });
            }

            // ตรวจสอบว่าช่องเก็บว่างหรือไม่
            // 🔧 แก้ไข: เพิ่มวงเล็บให้ชัดเจน และอนุญาต tro_id ตัวเองด้วย
            const slotResult = await transaction
                .request()
                .input("cs_id", sql.Int, cs_id)
                .input("slot_id", sql.VarChar, slot_id)
                .query("SELECT tro_id FROM Slot WHERE cs_id = @cs_id AND slot_id = @slot_id");

            if (
                slotResult.recordset.length === 0 ||
                (
                    slotResult.recordset[0].tro_id !== null &&
                    slotResult.recordset[0].tro_id !== 'rsrv' &&
                    slotResult.recordset[0].tro_id !== tro_id
                )
            ) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "Error" });
            }

            const tro_status = trolleyResult.recordset[0].tro_status;
            const rsrv_timestamp = trolleyResult.recordset[0].rsrv_timestamp;

            debugLog("tro_status", tro_status);
            debugLog("rsrv_timestamp", rsrv_timestamp);

            // กรณีรถเข็นว่าง
            if (selectedOption === "รถเข็นว่าง") {
                if (tro_status === false) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "รถเข็นคันนี้ถูกใช้งานแล้ว" });
                }

                if (rsrv_timestamp === null) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ไม่สามารถจองรถเข็นได้เนื่องจากเลยเวลาดำเนินการ 5 นาที"
                    });
                }

                if (tro_status === 1 || tro_status === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ไม่สามารถจองรถเข็นได้เนื่องจากเลยเวลาดำเนินการ 5 นาที"
                    });
                }

                const slotUpdateResult = await transaction
                    .request()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .input("cs_id", sql.Int, cs_id)
                    .input("slot_id", sql.VarChar, slot_id)
                    .query("UPDATE Slot SET tro_id = @tro_id, reserved_at = NULL WHERE cs_id = @cs_id AND slot_id = @slot_id");

                if (slotUpdateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ไม่สามารถอัปเดตช่องเก็บได้" });
                }

                const trolleyUpdateResult = await transaction
                    .request()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .query("UPDATE Trolley SET tro_status = 0, rsrv_timestamp = null WHERE tro_id = @tro_id");

                if (trolleyUpdateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ไม่สามารถอัปเดตสถานะรถเข็นได้" });
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: "รับเข้ารถเข็นว่าง" });
            }

            // ✅ STEP 1: Lock Slot early อัปเดตช่องเก็บ FIRST ก่อน update TrolleyRMMapping
            // เพื่อให้แน่ใจว่า Slot สามารถอัปเดตได้ก่อนจะแก้ไข TrolleyRMMapping
            const slotLockResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .input("cs_id", sql.Int, cs_id)
                .input("slot_id", sql.VarChar, slot_id)
                .query(`
                UPDATE Slot 
                SET tro_id = @tro_id, reserved_at = NULL 
                WHERE cs_id = @cs_id AND slot_id = @slot_id AND (tro_id IS NULL OR tro_id = 'rsrv')
            `);

            // ⚠️ ตรวจสอบว่า Slot อัปเดตสำเร็จ ถ้าไม่สำเร็จแล้ว Rollback ทั้งหมด
            if (slotLockResult.rowsAffected[0] === 0) {
                await safeRollback(transaction);
                console.error(`❌ Slot update failed: cs_id=${cs_id}, slot_id=${slot_id}, tro_id=${tro_id}`);
                return res.status(400).json({
                    success: false,
                    message: "ไม่สามารถอัปเดตช่องเก็บได้ - ช่องเก็บอาจถูกใช้งานโดยรถเข็นอื่น"
                });
            }

            debugLog(`✅ Slot locked and updated: cs_id=${cs_id}, slot_id=${slot_id}, tro_id=${tro_id}`);

            // ✅ STEP 2: ตรวจสอบข้อมูลวัตถุดิบใน TrolleyRMMapping
            const rmResults = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT dest, rmm_line_name, rm_status, cold_time, prep_to_cold_time, rework_time, mix_time, rmfp_id, mapping_id FROM TrolleyRMMapping WITH (UPDLOCK, ROWLOCK) WHERE tro_id = @tro_id");

            if (rmResults.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "ไม่พบวัตถุดิบในรถเข็นนี้" });
            }

            // 🔧 แก้ไข: เพิ่ม "ห้องเย็น" เข้าไปใน whitelist
            // เพราะหลัง update ครั้งแรก dest จะเปลี่ยนเป็น "ห้องเย็น" แล้ว
            const validDests = ["เข้าห้องเย็น", "รอCheckin", "รอเข้าห้องเย็น", "ห้องเย็น", "ห้องเย็นใหญ่", "ออกห้องเย็น", "ส่งกลับจากห้องเย็นใหญ่"]
            const invalidDestItems = rmResults.recordset.filter(item => !validDests.includes(item.dest));

            if (invalidDestItems.length > 0) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: "มีวัตถุดิบในรถเข็นที่ไม่ได้เตรียมเข้าห้องเย็น"
                });
            }

            // ตรวจสอบสถานะของวัตถุดิบตามเงื่อนไขที่เลือก
            const statusMap = {
                "วัตถุดิบรอแก้ไข": ["รอแก้ไข"],
                "วัตถุดิบรับฝาก": ["QcCheck รอกลับมาเตรียม", "QcCheck รอ MD", "รอ Qc", "รอกลับมาเตรียม"],
                "วัตถุดิบตรง": ["QcCheck"],
                "เหลือจากไลน์ผลิต": ["เหลือจากไลน์ผลิต"],
            };

            if (!(selectedOption in statusMap)) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "ตัวเลือกไม่ถูกต้อง" });
            }

            const validStatuses = statusMap[selectedOption];
            const invalidStatusItems = rmResults.recordset.filter(item =>
                !validStatuses.includes(item.rm_status)
            );

            if (invalidStatusItems.length > 0) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `ไม่ตรงเงื่อนไขรับเข้า ${selectedOption} มีวัตถุดิบที่มีสถานะไม่ตรงกับเงื่อนไข`
                });
            }

            let successfulUpdates = 0;

            for (const item of rmResults.recordset) {
                const { cold_time, prep_to_cold_time, rework_time, mix_time, rmfp_id, mapping_id } = item;

                let coldTimeValue = cold_time;
                let pic_time = prep_to_cold_time;
                let ReworkTime = rework_time;
                let MixTime = mix_time;

                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, cold_time ตอนรับ:`, cold_time);
                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, ptc_time ตอนรับ:`, prep_to_cold_time);
                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, rework_time ตอนรับ:`, rework_time);
                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, mix_time ตอนรับ:`, mix_time);

                // เฉพาะกรณีที่ cold_time เป็น null ให้ดึงค่าจาก RawMatGroup
                if (cold_time === null) {
                    const rmgResult = await transaction
                        .request()
                        .input("rmfp_id", sql.Int, rmfp_id)
                        .query(`
                        SELECT rmg.cold
                        FROM RMForProd rmf
                        JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
                        WHERE rmf.rmfp_id = @rmfp_id
                    `);

                    if (rmgResult.recordset.length > 0) {
                        coldTimeValue = rmgResult.recordset[0].cold;
                    }
                }

                if (mix_time !== null) {
                    const mixQuery = await transaction
                        .request()
                        .input("mapping_id", sql.Int, mapping_id)
                        .query(`
                        SELECT FORMAT(mixed_date, 'yyyy-MM-dd HH:mm:ss') AS mixed_date
                        FROM History
                        WHERE mapping_id = @mapping_id AND mixed_date IS NOT NULL
                    `);

                    if (mixQuery.recordset.length > 0 && mixQuery.recordset[0].mixed_date) {
                        const mixedDate = new Date(mixQuery.recordset[0].mixed_date);
                        const currentDate = new Date();
                        const timeDiffMinutes = (currentDate - mixedDate) / (1000 * 60);

                        debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, ใช้เวลาอ้างอิงจาก mixed_date`);

                        if (mix_time === 0.00) {
                            const totalMinutesRemaining = -timeDiffMinutes;
                            const updatedHours = Math.floor(Math.abs(totalMinutesRemaining) / 60);
                            const updatedMinutes = Math.floor(Math.abs(totalMinutesRemaining) % 60);
                            MixTime = -1 * (updatedHours + (updatedMinutes / 100));

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, กรณี mix_time เป็น 0.00`);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลือ (ติดลบ):`, MixTime);
                        } else {
                            const isNegative = mix_time < 0;
                            const absValue = Math.abs(mix_time);
                            const hours = Math.floor(absValue);
                            const minutes = Math.round((absValue - hours) * 100);

                            let totalMinutes = (isNegative ? -1 : 1) * (hours * 60 + minutes);
                            const totalMinutesRemaining = totalMinutes - timeDiffMinutes;

                            const isResultNegative = totalMinutesRemaining < 0;
                            const absMinutesRemaining = Math.abs(totalMinutesRemaining);
                            const updatedHours = Math.floor(absMinutesRemaining / 60);
                            const updatedMinutes = Math.floor(absMinutesRemaining % 60);

                            MixTime = (isResultNegative ? -1 : 1) * (updatedHours + (updatedMinutes / 100));

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, mix_time เดิม:`, mix_time);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลืออยู่ (ชั่วโมง.นาที):`, MixTime);
                        }

                        MixTime = parseFloat(MixTime.toFixed(2));
                    }
                }

                // ตรวจสอบ rework_time และคำนวณเวลาที่เหลือ
                if (rework_time !== null) {
                    const reworkQuery = await transaction
                        .request()
                        .input("mapping_id", sql.Int, mapping_id)
                        .query(`
                        SELECT FORMAT(qc_date, 'yyyy-MM-dd HH:mm:ss') AS qc_date
                        FROM History
                        WHERE mapping_id = @mapping_id AND qc_date IS NOT NULL
                    `);

                    if (reworkQuery.recordset.length > 0 && reworkQuery.recordset[0].qc_date) {
                        const qcDate = new Date(reworkQuery.recordset[0].qc_date);
                        const currentDate = new Date();
                        const timeDiffMinutes = (currentDate - qcDate) / (1000 * 60);

                        debugLog(`RMFP ID: ${rmfp_id}, ใช้เวลาอ้างอิงจาก qc_date`);

                        if (rework_time === 0.00) {
                            const totalMinutesRemaining = -timeDiffMinutes;
                            const updatedHours = Math.floor(Math.abs(totalMinutesRemaining) / 60);
                            const updatedMinutes = Math.floor(Math.abs(totalMinutesRemaining) % 60);
                            ReworkTime = -1 * (updatedHours + (updatedMinutes / 100));

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, กรณี rework_time เป็น 0.00`);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลือ (ติดลบ):`, ReworkTime);
                        } else {
                            const isNegative = rework_time < 0;
                            const absValue = Math.abs(rework_time);
                            const hours = Math.floor(absValue);
                            const minutes = Math.round((absValue - hours) * 100);

                            let totalMinutes = (isNegative ? -1 : 1) * (hours * 60 + minutes);
                            const totalMinutesRemaining = totalMinutes - timeDiffMinutes;

                            const isResultNegative = totalMinutesRemaining < 0;
                            const absMinutesRemaining = Math.abs(totalMinutesRemaining);
                            const updatedHours = Math.floor(absMinutesRemaining / 60);
                            const updatedMinutes = Math.floor(absMinutesRemaining % 60);

                            ReworkTime = (isResultNegative ? -1 : 1) * (updatedHours + (updatedMinutes / 100));

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, rework_time เดิม:`, rework_time);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลืออยู่ (ชั่วโมง.นาที):`, ReworkTime);
                        }

                        ReworkTime = parseFloat(ReworkTime.toFixed(2));
                    }
                } else {
                    // กรณี rework_time เป็น null ให้คำนวณ prep_to_cold_time
                    if (prep_to_cold_time === null) {
                        const ptcResult = await transaction
                            .request()
                            .input("rmfp_id", sql.Int, rmfp_id)
                            .input("tro_id", sql.VarChar(4), tro_id)
                            .query(`
                            SELECT
                                rmg.prep_to_cold,
                                FORMAT(htr.cooked_date, 'yyyy-MM-dd HH:mm:ss') AS cooked_date,
                                FORMAT(htr.rmit_date, 'yyyy-MM-dd HH:mm:ss') AS rmit_date
                            FROM TrolleyRMMapping rmm
                            JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                            JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
                            JOIN History htr ON rmm.mapping_id = htr.mapping_id
                            WHERE rmm.rmfp_id = @rmfp_id AND rmm.tro_id = @tro_id
                        `);

                        if (ptcResult.recordset.length > 0) {
                            const prepToCold = ptcResult.recordset[0].prep_to_cold;
                            const currentDate = new Date();

                            const referenceDate = ptcResult.recordset[0].rmit_date ?
                                new Date(ptcResult.recordset[0].rmit_date) :
                                new Date(ptcResult.recordset[0].cooked_date);
                            const referenceType = ptcResult.recordset[0].rmit_date ? 'rmit_date' : 'cooked_date';

                            const timeDiffMinutes = (currentDate - referenceDate) / (1000 * 60);
                            let remainingTimeHours = prepToCold - (timeDiffMinutes / 60);

                            const hours = Math.floor(remainingTimeHours);
                            const minutes = Math.floor((remainingTimeHours - hours) * 60);

                            pic_time = hours + (minutes / 100);
                            pic_time = parseFloat(pic_time.toFixed(2));

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, ใช้เวลาอ้างอิงจาก: ${referenceType}`);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, prep_to_cold จาก RawMatGroup:`, prepToCold);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลืออยู่ (ชั่วโมง.นาที):`, pic_time);
                        }
                    } else {
                        const ptcQuery = await transaction
                            .request()
                            .input("rmfp_id", sql.Int, rmfp_id)
                            .input("tro_id", sql.VarChar(4), tro_id)
                            .query(`
                            SELECT
                                FORMAT(htr.cooked_date, 'yyyy-MM-dd HH:mm:ss') AS cooked_date,
                                FORMAT(htr.rmit_date, 'yyyy-MM-dd HH:mm:ss') AS rmit_date,
                                FORMAT(htr.out_cold_date, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date,
                                FORMAT(htr.out_cold_date_two, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_two,
                                FORMAT(htr.out_cold_date_three, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_three
                            FROM TrolleyRMMapping rmm
                            JOIN History htr ON rmm.mapping_id = htr.mapping_id
                            WHERE rmm.rmfp_id = @rmfp_id AND rmm.tro_id = @tro_id
                        `);

                        if (ptcQuery.recordset.length > 0) {
                            const outColdDates = [
                                ptcQuery.recordset[0].out_cold_date_three,
                                ptcQuery.recordset[0].out_cold_date_two,
                                ptcQuery.recordset[0].out_cold_date
                            ].filter(date => date);

                            let referenceDate;
                            let referenceType = '';

                            if (outColdDates.length > 0) {
                                referenceDate = new Date(outColdDates[0]);
                                referenceType = 'out_cold_date';
                            } else {
                                referenceDate = ptcQuery.recordset[0].rmit_date ?
                                    new Date(ptcQuery.recordset[0].rmit_date) :
                                    new Date(ptcQuery.recordset[0].cooked_date);
                                referenceType = ptcQuery.recordset[0].rmit_date ? 'rmit_date' : 'cooked_date';
                            }

                            const currentDate = new Date();
                            const timeDiffMinutes = (currentDate - referenceDate) / (1000 * 60);

                            debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, ใช้เวลาอ้างอิงจาก: ${referenceType}`);

                            if (prep_to_cold_time === 0.00) {
                                const totalMinutesRemaining = -timeDiffMinutes;
                                const updatedHours = Math.floor(Math.abs(totalMinutesRemaining) / 60);
                                const updatedMinutes = Math.floor(Math.abs(totalMinutesRemaining) % 60);
                                pic_time = -1 * (updatedHours + (updatedMinutes / 100));

                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, กรณี prep_to_cold_time เป็น 0.00`);
                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลือ (ติดลบ):`, pic_time);
                            } else {
                                const isNegative = prep_to_cold_time < 0;
                                const absValue = Math.abs(prep_to_cold_time);
                                const hours = Math.floor(absValue);
                                const minutes = Math.round((absValue - hours) * 100);

                                let totalMinutes = (isNegative ? -1 : 1) * (hours * 60 + minutes);
                                const totalMinutesRemaining = totalMinutes - timeDiffMinutes;

                                const isResultNegative = totalMinutesRemaining < 0;
                                const absMinutesRemaining = Math.abs(totalMinutesRemaining);
                                const updatedHours = Math.floor(absMinutesRemaining / 60);
                                const updatedMinutes = Math.round(absMinutesRemaining % 60);

                                pic_time = (isResultNegative ? -1 : 1) * (updatedHours + (updatedMinutes / 100));

                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, prep_to_cold_time เดิม:`, prep_to_cold_time);
                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่ผ่านไปแล้ว (นาที):`, timeDiffMinutes);
                                debugLog(`MP ID : ${mapping_id} ,RMFP ID: ${rmfp_id}, เวลาที่เหลืออยู่ (ชั่วโมง.นาที):`, pic_time);
                            }

                            pic_time = parseFloat(pic_time.toFixed(2));
                        }
                    }
                }

                debugLog(`MP ID ${mapping_id}, RMFP ID: ${rmfp_id}, cold_time update:`, coldTimeValue);
                debugLog(`MP ID ${mapping_id}, RMFP ID: ${rmfp_id}, prep_to_cold_time:`, pic_time);
                debugLog(`MP ID ${mapping_id}, RMFP ID: ${rmfp_id}, rework_time update:`, ReworkTime);

                // 🔧 แก้ไข: อัปเดต rm_cold_status พร้อมกับ stay_place และ dest ในคำสั่งเดียว
                const updateResult = await transaction
                    .request()
                    .input("rmfp_id", sql.Int, rmfp_id)
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .input("rm_cold_status", sql.VarChar, selectedOption)
                    .input("stay_place", sql.VarChar, "เข้าห้องเย็น")
                    .input("dest", sql.VarChar, "ห้องเย็น")
                    .input("cold_time", sql.Float, coldTimeValue)
                    .input("prep_to_cold_time", sql.Float, pic_time)
                    .input("rework_time", sql.Float, ReworkTime)
                    .input("mix_time", sql.Float, MixTime)
                    .query(`
                    UPDATE TrolleyRMMapping
                    SET
                        rm_cold_status = @rm_cold_status,
                        stay_place     = @stay_place,
                        dest           = @dest,
                        cold_time      = @cold_time,
                        prep_to_cold_time = @prep_to_cold_time,
                        rework_time    = @rework_time,
                        mix_time       = @mix_time
                    WHERE
                        tro_id = @tro_id AND rmfp_id = @rmfp_id
                `);

                if (updateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: `ไม่สามารถอัปเดตข้อมูลวัตถุดิบ RMFP ID: ${rmfp_id} ได้`
                    });
                }

                successfulUpdates++;
            }

            // ตรวจสอบว่าอัปเดตครบทุก item หรือไม่
            if (successfulUpdates !== rmResults.recordset.length) {
                await safeRollback(transaction);
                console.error(`❌ Partial update failed: updated=${successfulUpdates}, total=${rmResults.recordset.length}`);
                return res.status(400).json({
                    success: false,
                    message: `อัปเดตข้อมูลไม่ครบ อัปเดตสำเร็จ ${successfulUpdates}/${rmResults.recordset.length} รายการ`
                });
            }

            // ✅ Slot update สำเร็จแล้ว (อัปเดต BEFORE TrolleyRMMapping loop)
            debugLog(`✅ All TrolleyRMMapping records updated successfully: tro_id=${tro_id}, count=${successfulUpdates}`);

            // ✅ STEP 3: อัปเดตประวัติการเข้าห้องเย็น
            const mappingResults = await transaction.request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT mapping_id FROM TrolleyRMMapping WHERE tro_id = @tro_id");

            if (mappingResults.recordset.length > 0) {
                let historyUpdateCount = 0;

                for (const row of mappingResults.recordset) {
                    const mapping_id = row.mapping_id;

                    const historyUpdateResult = await transaction.request()
                        .input("mapping_id", sql.Int, mapping_id)
                        .query(`
                        UPDATE History
                        SET
                            come_cold_date =
                                CASE
                                    WHEN come_cold_date IS NULL THEN GETDATE()
                                    ELSE come_cold_date
                                END,
                            come_cold_date_two =
                                CASE
                                    WHEN come_cold_date IS NOT NULL AND come_cold_date_two IS NULL THEN GETDATE()
                                    ELSE come_cold_date_two
                                END,
                            come_cold_date_three =
                                CASE
                                    WHEN come_cold_date IS NOT NULL AND come_cold_date_two IS NOT NULL AND come_cold_date_three IS NULL THEN GETDATE()
                                    ELSE come_cold_date_three
                                END
                        WHERE mapping_id = @mapping_id
                    `);

                    if (historyUpdateResult.rowsAffected[0] > 0) {
                        historyUpdateCount++;
                    }
                }

                if (historyUpdateCount !== mappingResults.recordset.length) {
                    await safeRollback(transaction);
                    console.error(`❌ History update incomplete: updated=${historyUpdateCount}, total=${mappingResults.recordset.length}`);
                    return res.status(400).json({
                        success: false,
                        message: `ไม่สามารถอัปเดตประวัติการเข้าห้องเย็นได้ครบทุกรายการ (อัปเดตสำเร็จ ${historyUpdateCount}/${mappingResults.recordset.length})`
                    });
                }
                debugLog(`✅ History updated successfully: tro_id=${tro_id}, count=${historyUpdateCount}`);
            }

            // ✅ Commit transaction เมื่อทุกอย่างสำเร็จ
            await transaction.commit();
            debugLog(`✅ Transaction committed successfully: tro_id=${tro_id}, cs_id=${cs_id}, slot_id=${slot_id}`);

            // ส่ง socket event หลัง commit สำเร็จ
            io.to('saveRMForProdRoom').emit('dataUpdated', []);

            return res.status(200).json({ success: true, message: `รับเข้า ${selectedOption}` });

        } catch (err) {
            try {
                await safeRollback(transaction);
            } catch (rollbackErr) {
                console.error("Rollback error", rollbackErr);
            }

            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

        router.put("/coldstorage/input/coldstorage", async (req, res) => {
    try {
        debugLog("Raw Request Body:", req.body);

        const {
            tro_id, slot_id, rm_cold_status, rm_status,
            dest, operator, materials, storage_purpose,
            expiry_date, remark
        } = req.body;

        if (!tro_id || !rm_status || !dest || !materials) {
            console.warn("Missing fields:", { tro_id, slot_id, rm_status, dest, materials });
            return res.status(400).json({ error: "Missing required fields" });
        }

        const pool = await connectToDatabase();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const material of materials) {
                const mapping_id = material.mapping_id;

                const histamineValue = material.histamine;

                const updatedRmDataResult = await new sql.Request(transaction)
                    .input("mapping_id", mapping_id)
                    .query(`
                        SELECT cold_to_pack_time, mix_time, rework_time
                        FROM TrolleyRMMapping
                        WHERE mapping_id = @mapping_id
                    `);
                const updatedRmData = updatedRmDataResult.recordset[0];

                let historyUpdateQuery = `
                    UPDATE History
                    SET
                        receiver_out_cold = CASE
                            WHEN come_cold_date IS NOT NULL AND out_cold_date IS NULL
                            THEN @operator ELSE receiver_out_cold END,

                        receiver_out_cold_two = CASE
                            WHEN come_cold_date_two IS NOT NULL AND out_cold_date_two IS NULL
                            THEN @operator ELSE receiver_out_cold_two END,

                        receiver_out_cold_three = CASE
                            WHEN come_cold_date_three IS NOT NULL AND out_cold_date_three IS NULL
                            THEN @operator ELSE receiver_out_cold_three END
                `;

                const roundCheckResult = await new sql.Request(transaction)
                    .input("mapping_id", mapping_id)
                    .query(`
                        SELECT TOP 1
                            come_cold_date, out_cold_date,
                            come_cold_date_two, out_cold_date_two,
                            come_cold_date_three, out_cold_date_three
                        FROM History
                        WHERE mapping_id = @mapping_id
                        ORDER BY hist_id DESC
                    `);

                let currentRound = 1;
                if (roundCheckResult.recordset.length > 0) {
                    const h = roundCheckResult.recordset[0];
                    if (h.come_cold_date_three && !h.out_cold_date_three) currentRound = 3;
                    else if (h.come_cold_date_two && !h.out_cold_date_two) currentRound = 2;
                    else currentRound = 1;
                }

                let historyExtra = "";

                const histReq = new sql.Request(transaction)
                    .input("mapping_id", mapping_id)
                    .input("operator", sql.NVarChar, operator)
                    .input("dest", sql.VarChar, dest)
                    .input("cold_to_pack_time", updatedRmData.cold_to_pack_time)
                    .input("mix_time", updatedRmData.mix_time)
                    .input("rework_time", updatedRmData.rework_time);

                const spField = currentRound === 3 ? 'at_pd_storage_purpose_3'
                    : currentRound === 2 ? 'at_pd_storage_purpose_2'
                        : 'at_pd_storage_purpose';
                const hField = currentRound === 3 ? 'at_pd_histamine_3'
                    : currentRound === 2 ? 'at_pd_histamine_2'
                        : 'at_pd_histamine';
                const expField = currentRound === 3 ? 'at_pd_expiry_date_3'
                    : currentRound === 2 ? 'at_pd_expiry_date_2'
                        : 'at_pd_expiry_date';
                const remarkField = currentRound === 3 ? 'at_pd_cold_remark_3'
                    : currentRound === 2 ? 'at_pd_cold_remark_2'
                        : 'at_pd_cold_remark';

                if (storage_purpose && storage_purpose.trim() !== "") {
                    histReq.input("storage_purpose_val", sql.NVarChar, storage_purpose.trim());
                    historyExtra += `, ${spField} = @storage_purpose_val`;
                }

                if (histamineValue != null && !isNaN(histamineValue)) {
                    histReq.input("histamine_val", sql.Float, histamineValue);
                    historyExtra += `, ${hField} = @histamine_val`;
                }

                if (expiry_date && String(expiry_date).trim() !== "") {
                    histReq.input("expiry_date_val", sql.Date, expiry_date);
                    historyExtra += `, ${expField} = @expiry_date_val`;
                }

                if (remark && String(remark).trim() !== "") {
                    histReq.input("remark_val", sql.NVarChar, String(remark).trim());
                    historyExtra += `, ${remarkField} = @remark_val`;
                }

                historyUpdateQuery += historyExtra + ` WHERE mapping_id = @mapping_id;`;

                await histReq.query(historyUpdateQuery);
            }

            await transaction.commit();

            try {
                for (const material of materials) {
                    await pool
                        .request()
                        .input("mapping_id_reset", material.mapping_id)
                        .query(`UPDATE TrolleyRMMapping SET confirmed_location = NULL WHERE mapping_id = @mapping_id_reset`);
                }
            } catch (resetErr) {
                console.error(`⚠️ confirmed_location reset ล้มเหลว (ไม่กระทบการเช็คเอาท์หลัก): tro_id=${tro_id}`, resetErr);
            }

            io.to('saveRMForProdRoom').emit('dataUpdated', {
                message: "วัตถุดิบถูกนำออกจากห้องเย็นแล้ว",
                updatedAt: new Date(),
                tro_id,
                operator
            });
            io.to('QcCheckRoom').emit('dataUpdated', { tro_id });

            res.status(200).json({ message: "Data updated successfully" });

        } catch (innerError) {
            await safeRollback(transaction);
            console.error("Transaction error:", innerError);
            res.status(500).json({ error: innerError.message });
        }

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "An error occurred while updating the data." });
    }

});


    router.put("/largecold/checkin/update/Trolley", async (req, res) => {
        const { tro_id, cs_id, section_leader } = req.body;  // ✅ เอา slot_id ออก

        const pool = await connectToDatabase();
        const transaction = pool.transaction();

        try {
            await transaction.begin();

            // ── STEP 1: ตรวจสอบว่ารถเข็นมีอยู่ในระบบ ────────────────────────────
            const trolleyResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT tro_status, rsrv_timestamp FROM Trolley WHERE tro_id = @tro_id");

            if (trolleyResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "รถเข็นไม่พบในระบบ" });
            }

            // ── STEP 2: ตรวจสอบว่ารถเข็นไม่ได้อยู่ในห้องเย็นแล้ว ────────────────
            const trolleyInColdResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT cs_id, slot_id FROM Slot WHERE tro_id = @tro_id");

            if (trolleyInColdResult.recordset.length > 0) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `รถเข็นนี้อยู่ในห้องเย็นอยู่แล้ว (ช่อง ${trolleyInColdResult.recordset[0].slot_id})`
                });
            }

            // ── STEP 3: ✅ หา slot ว่างใน cs_id นั้น (tro_id = NULL) ──────────────
            const availableSlotResult = await transaction
                .request()
                .input("cs_id", sql.Int, cs_id)
                .query(`
                SELECT TOP 1 slot_id
                FROM Slot
                WHERE cs_id = @cs_id AND tro_id IS NULL
                ORDER BY slot_id ASC
            `);

            if (availableSlotResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(400).json({ success: false, message: "ไม่มีช่องว่างในห้องเย็นนี้" });
            }

            const slot_id = availableSlotResult.recordset[0].slot_id;  // ✅ ได้ slot_id จาก DB
            debugLog(`✅ Found available slot: cs_id=${cs_id}, slot_id=${slot_id}`);

            const { tro_status, rsrv_timestamp } = trolleyResult.recordset[0];

            // ── STEP 4: ตรวจสอบวัตถุดิบใน TrolleyRMMapping ──────────────────────
            const rmResults = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query(`
                SELECT dest, rmm_line_name, rm_status, cold_time,
                       prep_to_cold_time, mix_time,
                       rmfp_id, mapping_id
                FROM TrolleyRMMapping WITH (UPDLOCK, ROWLOCK)
                WHERE tro_id = @tro_id
            `);

            // ── กรณีรถเข็นว่าง (ไม่มีวัตถุดิบ) ──────────────────────────────────
            if (rmResults.recordset.length === 0) {
                if (tro_status === false) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "รถเข็นคันนี้ถูกใช้งานแล้ว" });
                }

                if (rsrv_timestamp === null || tro_status === 1 || tro_status === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ไม่ตรงข้อกำหนดการรับเข้า"
                    });
                }

                // UPDATE Slot
                const slotUpdateResult = await transaction
                    .request()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .input("cs_id", sql.Int, cs_id)
                    .input("slot_id", sql.VarChar, slot_id)
                    .query("UPDATE Slot SET tro_id = @tro_id, reserved_at = NULL WHERE cs_id = @cs_id AND slot_id = @slot_id");

                if (slotUpdateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ไม่สามารถอัปเดตช่องเก็บได้" });
                }

                // UPDATE Trolley status
                const trolleyUpdateResult = await transaction
                    .request()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .query("UPDATE Trolley SET tro_status = 0, rsrv_timestamp = null WHERE tro_id = @tro_id");

                if (trolleyUpdateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ไม่สามารถอัปเดตสถานะรถเข็นได้" });
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: "รับเข้ารถเข็นว่าง", slot_id });
            }


            // ── STEP 5: Lock Slot ────────────────────────────────────────────────
            const slotLockResult = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .input("cs_id", sql.Int, cs_id)
                .input("slot_id", sql.VarChar, slot_id)
                .query(`
                UPDATE Slot
                SET tro_id = @tro_id, reserved_at = NULL
                WHERE cs_id = @cs_id AND slot_id = @slot_id
                  AND tro_id IS NULL
            `);

            if (slotLockResult.rowsAffected[0] === 0) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: "ไม่สามารถอัปเดตช่องเก็บได้ - ช่องเก็บอาจถูกใช้งานโดยรถเข็นอื่น"
                });
            }

            debugLog(`✅ Slot locked: cs_id=${cs_id}, slot_id=${slot_id}, tro_id=${tro_id}`);

            // ── STEP 6: UPDATE TrolleyRMMapping แต่ละ item ───────────────────────
            let successfulUpdates = 0;

            for (const item of rmResults.recordset) {
                const { cold_time, prep_to_cold_time, mix_time, rmfp_id, mapping_id } = item;

                let coldTimeValue = cold_time;
                let pic_time = prep_to_cold_time;
                let MixTime = mix_time;

                debugLog(`MP ID: ${mapping_id}, RMFP ID: ${rmfp_id}, cold_time:`, cold_time);
                debugLog(`MP ID: ${mapping_id}, RMFP ID: ${rmfp_id}, ptc_time:`, prep_to_cold_time);
                debugLog(`MP ID: ${mapping_id}, RMFP ID: ${rmfp_id}, mix_time:`, mix_time);

                // cold_time: ดึงจาก RawMatGroup ถ้าเป็น null
                if (cold_time === null) {
                    const rmgResult = await transaction
                        .request()
                        .input("rmfp_id", sql.Int, rmfp_id)
                        .query(`
                        SELECT rmg.cold
                        FROM RMForProd rmf
                        JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
                        WHERE rmf.rmfp_id = @rmfp_id
                    `);

                    if (rmgResult.recordset.length > 0) {
                        coldTimeValue = rmgResult.recordset[0].cold;
                    }
                }

                // mix_time: คำนวณเวลาที่เหลือจาก mixed_date
                if (mix_time !== null) {
                    const mixQuery = await transaction
                        .request()
                        .input("mapping_id", sql.Int, mapping_id)
                        .query(`
                        SELECT FORMAT(mixed_date, 'yyyy-MM-dd HH:mm:ss') AS mixed_date
                        FROM History
                        WHERE mapping_id = @mapping_id AND mixed_date IS NOT NULL
                    `);

                    if (mixQuery.recordset.length > 0 && mixQuery.recordset[0].mixed_date) {
                        const mixedDate = new Date(mixQuery.recordset[0].mixed_date);
                        const timeDiffMinutes = (new Date() - mixedDate) / (1000 * 60);

                        if (mix_time === 0.00) {
                            const abs = Math.abs(-timeDiffMinutes);
                            MixTime = -1 * (Math.floor(abs / 60) + (Math.floor(abs % 60) / 100));
                        } else {
                            const isNeg = mix_time < 0;
                            const absVal = Math.abs(mix_time);
                            const totalMin = (isNeg ? -1 : 1) * (Math.floor(absVal) * 60 + Math.round((absVal % 1) * 100));
                            const remaining = totalMin - timeDiffMinutes;
                            const isResNeg = remaining < 0;
                            const absRem = Math.abs(remaining);
                            MixTime = (isResNeg ? -1 : 1) * (Math.floor(absRem / 60) + (Math.floor(absRem % 60) / 100));
                        }

                        MixTime = parseFloat(MixTime.toFixed(2));
                    }
                }

                // ✅ prep_to_cold_time เท่านั้น (ไม่มี rework_time แล้ว)
                if (prep_to_cold_time === null) {
                    const ptcResult = await transaction
                        .request()
                        .input("rmfp_id", sql.Int, rmfp_id)
                        .input("tro_id", sql.VarChar(4), tro_id)
                        .query(`
                        SELECT rmg.prep_to_cold,
                               FORMAT(htr.cooked_date, 'yyyy-MM-dd HH:mm:ss') AS cooked_date,
                               FORMAT(htr.rmit_date,   'yyyy-MM-dd HH:mm:ss') AS rmit_date
                        FROM TrolleyRMMapping rmm
                        JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
                        JOIN RawMatGroup rmg ON rmg.rm_group_id = rmf.rm_group_id
                        JOIN History htr ON rmm.mapping_id = htr.mapping_id
                        WHERE rmm.rmfp_id = @rmfp_id AND rmm.tro_id = @tro_id
                    `);

                    if (ptcResult.recordset.length > 0) {
                        const { prep_to_cold, rmit_date, cooked_date } = ptcResult.recordset[0];
                        const refDate = new Date(rmit_date || cooked_date);
                        const timeDiffMinutes = (new Date() - refDate) / (1000 * 60);
                        const remainHours = prep_to_cold - timeDiffMinutes / 60;
                        const h = Math.floor(remainHours);
                        const m = Math.floor((remainHours - h) * 60);
                        pic_time = parseFloat((h + m / 100).toFixed(2));
                    }
                } else {
                    const ptcQuery = await transaction
                        .request()
                        .input("rmfp_id", sql.Int, rmfp_id)
                        .input("tro_id", sql.VarChar(4), tro_id)
                        .query(`
                        SELECT FORMAT(htr.cooked_date,         'yyyy-MM-dd HH:mm:ss') AS cooked_date,
                               FORMAT(htr.rmit_date,           'yyyy-MM-dd HH:mm:ss') AS rmit_date,
                               FORMAT(htr.out_cold_date,       'yyyy-MM-dd HH:mm:ss') AS out_cold_date,
                               FORMAT(htr.out_cold_date_two,   'yyyy-MM-dd HH:mm:ss') AS out_cold_date_two,
                               FORMAT(htr.out_cold_date_three, 'yyyy-MM-dd HH:mm:ss') AS out_cold_date_three
                        FROM TrolleyRMMapping rmm
                        JOIN History htr ON rmm.mapping_id = htr.mapping_id
                        WHERE rmm.rmfp_id = @rmfp_id AND rmm.tro_id = @tro_id
                    `);

                    if (ptcQuery.recordset.length > 0) {
                        const rec = ptcQuery.recordset[0];
                        const outDates = [rec.out_cold_date_three, rec.out_cold_date_two, rec.out_cold_date].filter(Boolean);
                        const refDate = new Date(outDates.length > 0 ? outDates[0] : (rec.rmit_date || rec.cooked_date));
                        const timeDiffMinutes = (new Date() - refDate) / (1000 * 60);

                        if (prep_to_cold_time === 0.00) {
                            const abs = Math.abs(-timeDiffMinutes);
                            pic_time = -1 * (Math.floor(abs / 60) + (Math.floor(abs % 60) / 100));
                        } else {
                            const isNeg = prep_to_cold_time < 0;
                            const absVal = Math.abs(prep_to_cold_time);
                            const totalMin = (isNeg ? -1 : 1) * (Math.floor(absVal) * 60 + Math.round((absVal % 1) * 100));
                            const remaining = totalMin - timeDiffMinutes;
                            const isResNeg = remaining < 0;
                            const absRem = Math.abs(remaining);
                            pic_time = (isResNeg ? -1 : 1) * (Math.floor(absRem / 60) + (Math.round(absRem % 60) / 100));
                        }

                        pic_time = parseFloat(pic_time.toFixed(2));
                    }
                }

                debugLog(`MP ID: ${mapping_id}, RMFP ID: ${rmfp_id} → cold_time=${coldTimeValue}, pic_time=${pic_time}, mix=${MixTime}`);

                // UPDATE TrolleyRMMapping
                const updateResult = await transaction
                    .request()
                    .input("rmfp_id", sql.Int, rmfp_id)
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .input("stay_place", sql.VarChar, "เข้าห้องเย็นใหญ่")
                    .input("dest", sql.VarChar, "ในห้องเย็นใหญ่")
                    .input("cold_time", sql.Float, coldTimeValue)
                    .input("prep_to_cold_time", sql.Float, pic_time)
                    .input("mix_time", sql.Float, MixTime)
                    .query(`
                    UPDATE TrolleyRMMapping
                    SET stay_place        = @stay_place,
                        dest              = @dest,
                        cold_time         = @cold_time,
                        prep_to_cold_time = @prep_to_cold_time,
                        mix_time          = @mix_time
                    WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id
                `);

                if (updateResult.rowsAffected[0] === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: `ไม่สามารถอัปเดตข้อมูลวัตถุดิบ RMFP ID: ${rmfp_id} ได้`
                    });
                }

                successfulUpdates++;
            }

            if (successfulUpdates !== rmResults.recordset.length) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `อัปเดตข้อมูลไม่ครบ (${successfulUpdates}/${rmResults.recordset.length})`
                });
            }

            debugLog(`✅ TrolleyRMMapping updated: tro_id=${tro_id}, count=${successfulUpdates}`);

            // ── STEP 7: UPDATE History — เพิ่ม rd_section_colds ─────────────────────────
            const mappingResults = await transaction
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT mapping_id FROM TrolleyRMMapping WHERE tro_id = @tro_id");

            let historyUpdateCount = 0;

            for (const row of mappingResults.recordset) {
                const histReq = transaction
                    .request()
                    .input("mapping_id", sql.Int, row.mapping_id);

                let sectionColdExtra = "";
                if (section_leader && section_leader.trim() !== "") {
                    histReq.input("section_leader", sql.NVarChar, section_leader.trim());
                    sectionColdExtra = `, rd_section_colds = @section_leader`;
                    debugLog(`✅ rd_section_colds: ${section_leader} → mapping_id: ${row.mapping_id}`);
                }

                const historyUpdateResult = await histReq.query(`
                UPDATE History
                SET
                    cs_come_cold_date = CASE
                        WHEN cs_come_cold_date IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date END,

                    cs_come_cold_date_two = CASE
                        WHEN cs_out_cold_date IS NOT NULL AND cs_come_cold_date_two IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_two END,

                    cs_come_cold_date_three = CASE
                        WHEN cs_out_cold_date_two IS NOT NULL AND cs_come_cold_date_three IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_three END,

                    cs_come_cold_date_four = CASE
                        WHEN cs_out_cold_date_three IS NOT NULL AND cs_come_cold_date_four IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_four END,

                    cs_come_cold_date_five = CASE
                        WHEN cs_out_cold_date_four IS NOT NULL AND cs_come_cold_date_five IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_five END,

                    cs_come_cold_date_six = CASE
                        WHEN cs_out_out_date_five IS NOT NULL AND cs_come_cold_date_six IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_six END,

                    cs_come_cold_date_seven = CASE
                        WHEN cs_out_cold_date_six IS NOT NULL AND cs_come_cold_date_seven IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_seven END,

                    cs_come_cold_date_eight = CASE
                        WHEN cs_out_cold_date_seven IS NOT NULL AND cs_come_cold_date_eight IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_eight END,

                    cs_come_cold_date_nine = CASE
                        WHEN cs_out_cold_date_eight IS NOT NULL AND cs_come_cold_date_nine IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_nine END,

                    cs_come_cold_date_ten = CASE
                        WHEN cs_out_cold_date_nine IS NOT NULL AND cs_come_cold_date_ten IS NULL THEN GETDATE()
                        ELSE cs_come_cold_date_ten END

                    ${sectionColdExtra}

                WHERE mapping_id = @mapping_id
            `);

                if (historyUpdateResult.rowsAffected[0] > 0) historyUpdateCount++;
            }

            if (historyUpdateCount !== mappingResults.recordset.length) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `อัปเดตประวัติไม่ครบ (${historyUpdateCount}/${mappingResults.recordset.length})`
                });
            }

            debugLog(`✅ History updated: tro_id=${tro_id}, count=${historyUpdateCount}`);

            await transaction.commit();
            debugLog(`✅ Transaction committed: tro_id=${tro_id}, cs_id=${cs_id}, slot_id=${slot_id}`);

            io.to("saveRMForProdRoom").emit("dataUpdated", []);

            return res.status(200).json({
                success: true,
                message: "รับเข้าห้องเย็นสำเร็จ",
                slot_id
            });

        } catch (err) {
            try { await safeRollback(transaction); } catch (e) { console.error("Rollback error", e); }
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.put("/coldstorage/moveRawmatintolley", async (req, res) => {
        try {
            debugLog("Raw Request Body:", req.body);
            const {
                tro_id,
                new_tro_id,
                weight,
                slot_id,
                rmfp_id,
                mix_code,
                mapping_id,
                isMixed
            } = req.body;

            // 1) Validate input
            if (!tro_id || !new_tro_id || !weight || !slot_id) {
                return res.status(400).json({ success: false, error: "Missing required fields" });
            }

            if (isMixed) {
                if (!mix_code || !mapping_id) {
                    return res.status(400).json({
                        success: false,
                        error: "For mixed materials, mix_code and mapping_id are required"
                    });
                }
            } else {
                if (!rmfp_id) {
                    return res.status(400).json({
                        success: false,
                        error: "For normal materials, rmfp_id is required"
                    });
                }
            }

            const weightNum = parseFloat(weight);
            if (isNaN(weightNum) || weightNum <= 0) {
                console.warn(`❌ น้ำหนักไม่ถูกต้อง: ${weight}`);
                return res.status(400).json({ error: "Weight must be a positive number" });
            }

            // 2) Connect DB
            const pool = await connectToDatabase();
            if (!pool) {
                console.warn("❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
                return res.status(500).json({ error: "Database connection failed" });
            }

            // 3) Begin transaction (ใช้ SERIALIZABLE เพื่อกัน race เรื่องน้ำหนัก/ถาด)
            const tx = new sql.Transaction(pool);
            await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

            // helper: ทุก query ต้องผูกกับ tx
            const t = () => new sql.Request(tx);

            try {
                // ตรวจว่ามีรถเข็นปลายทาง
                const checkDestTrolley = await t()
                    .input("tro_id", sql.VarChar, new_tro_id)
                    .query(`SELECT tro_id FROM Trolley WITH (UPDLOCK, HOLDLOCK) WHERE tro_id = @tro_id`);

                if (checkDestTrolley.recordset.length === 0) {
                    await safeRollback(tx);
                    return res.status(404).json({ error: "Destination trolley not found", details: { new_tro_id } });
                }

                // 4) ดึงแถวต้นทาง (เลือกเงื่อนไขให้ถูกกับโหมด)
                let sourceQuery, bind = t();
                if (isMixed) {
                    sourceQuery = `
          SELECT mapping_id, batch_id, tro_id, rmfp_id, tray_count, weight_RM,
                 tro_production_id, process_id, qc_id, level_eu,
                 prep_to_cold_time, cold_time, rework_time, prep_to_pack_time, cold_to_pack_time,
                 rm_status, rm_cold_status, stay_place, dest, mix_code, prod_mix,
                 allocation_date, removal_date, status, production_batch, created_by, rmm_line_name, mix_time
          FROM TrolleyRMMapping WITH (UPDLOCK, HOLDLOCK)
          WHERE mapping_id = @mapping_id
        `;
                    bind.input("mapping_id", mapping_id);
                } else {
                    sourceQuery = `
          SELECT TOP 1 mapping_id, batch_id, tro_id, rmfp_id, tray_count, weight_RM,
                 tro_production_id, process_id, qc_id, level_eu,
                 prep_to_cold_time, cold_time, rework_time, prep_to_pack_time, cold_to_pack_time,
                 rm_status, rm_cold_status, stay_place, dest, mix_code, prod_mix,
                 status, production_batch, rmm_line_name, mix_time
          FROM TrolleyRMMapping WITH (UPDLOCK, HOLDLOCK)
          WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id
          ORDER BY mapping_id
        `;
                    bind.input("tro_id", sql.VarChar, tro_id).input("rmfp_id", rmfp_id);
                }

                const result = await bind.query(sourceQuery);
                if (result.recordset.length === 0) {
                    await safeRollback(tx);
                    return res.status(404).json({ error: "Source mapping not found" });
                }

                const sourceRecord = result.recordset[0];
                const {
                    mapping_id: sourceMappingId,
                    tray_count: existingTrayCount,
                    weight_RM: currentTotalWeight
                } = sourceRecord;

                // 5) ตรวจน้ำหนักพอไหม
                if (currentTotalWeight < weightNum) {
                    await safeRollback(tx);
                    return res.status(400).json({
                        error: "Not enough weight in the trolley",
                        details: { available: currentTotalWeight, requested: weightNum }
                    });
                }

                // 6) คำนวณถาดตามสัดส่วน
                const weightRatio = weightNum / currentTotalWeight;
                const traysToMove = Math.ceil(existingTrayCount * weightRatio);
                if (traysToMove > existingTrayCount) {
                    await safeRollback(tx);
                    return res.status(400).json({
                        error: "Not enough trays in the trolley",
                        details: { available: existingTrayCount, required: traysToMove }
                    });
                }

                const currentDateTime = new Date().toISOString();
                const currentUser = req.user?.username || 'ย้ายวัตถุดิบใส่รถเข็น';

                // 7) โหลด History ของแถวต้นทาง
                const historyRes = await t()
                    .input("mapping_id", sourceMappingId)
                    .query(`SELECT TOP 1 * FROM History WITH (UPDLOCK, HOLDLOCK) WHERE mapping_id = @mapping_id ORDER BY hist_id DESC`);
                if (historyRes.recordset.length === 0) {
                    await safeRollback(tx);
                    return res.status(404).json({ error: `History record not found for mapping_id: ${sourceMappingId}` });
                }
                const historyData = historyRes.recordset[0];

                // 8) ลดน้ำหนัก/ถาดจากต้นทาง (ระวัง mixed: ยึด mapping_id เป็นหลัก)
                if (isMixed) {
                    await t()
                        .input("mapping_id", sourceMappingId)
                        .input("weight_RM", weightNum)
                        .input("tray_count_decrease", traysToMove)
                        .input("updated_at", currentDateTime)
                        .query(`
            UPDATE TrolleyRMMapping
            SET weight_RM = weight_RM - @weight_RM,
                tray_count = tray_count - @tray_count_decrease,
                updated_at = @updated_at
            WHERE mapping_id = @mapping_id
              AND weight_RM >= @weight_RM
              AND tray_count >= @tray_count_decrease
          `);
                } else {
                    await t()
                        .input("tro_id", sql.VarChar, tro_id)
                        .input("rmfp_id", rmfp_id)
                        .input("weight_RM", weightNum)
                        .input("tray_count_decrease", traysToMove)
                        .input("updated_at", currentDateTime)
                        .query(`
            UPDATE TrolleyRMMapping
            SET weight_RM = weight_RM - @weight_RM,
                tray_count = tray_count - @tray_count_decrease,
                updated_at = @updated_at
            WHERE tro_id = @tro_id
              AND rmfp_id = @rmfp_id
              AND weight_RM >= @weight_RM
              AND tray_count >= @tray_count_decrease
          `);
                }

                // 8.1 อัปเดต History ต้นทาง (ให้สะท้อนคงเหลือ)
                await t()
                    .input("mapping_id", sourceMappingId)
                    .input("weight_RM", currentTotalWeight - weightNum)
                    .input("tray_count", existingTrayCount - traysToMove)
                    .input("updated_at", currentDateTime)
                    .query(`
          UPDATE History
          SET weight_RM = @weight_RM,
              tray_count = @tray_count,
              updated_at = @updated_at
          WHERE mapping_id = @mapping_id
        `);

                // 8.2 ถ้าน้ำหนักเหลือ 0 ให้ set removal/status และปลด tro_id แถวที่เป็นศูนย์
                if (isMixed) {
                    await t()
                        .input("mapping_id", sourceMappingId)
                        .input("removal_date", currentDateTime)
                        .input("updated_at", currentDateTime)
                        .query(`
            UPDATE TrolleyRMMapping
            SET removal_date = @removal_date,
                updated_at = @updated_at,
                tro_id = NULL,
                status = 0,
                tl_status = '4800'
            WHERE mapping_id = @mapping_id AND weight_RM = 0
          `);
                } else {
                    await t()
                        .input("tro_id", sql.VarChar, tro_id)
                        .input("rmfp_id", rmfp_id)
                        .input("removal_date", currentDateTime)
                        .input("updated_at", currentDateTime)
                        .query(`
            UPDATE TrolleyRMMapping
            SET removal_date = @removal_date,
                updated_at = @updated_at,
                tro_id = NULL,
                status = 0,
                tl_status = '4815'
            WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id AND weight_RM = 0
          `);
                }

                // 9) จัดการปลายทาง: มีอยู่แล้วหรือยัง
                const existDest = await t()
                    .input("tro_id", sql.VarChar, new_tro_id)
                    .input("rmfp_id", sourceRecord.rmfp_id ?? rmfp_id ?? null)
                    .query(`
          SELECT TOP 1 * FROM TrolleyRMMapping WITH (UPDLOCK, HOLDLOCK)
          WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id
          ORDER BY mapping_id
        `);

                let destMappingId = existDest.recordset[0]?.mapping_id ?? null;

                if (existDest.recordset.length > 0) {
                    // 9.1 อัปเดตรายการเดิมในปลายทาง
                    const existingWeight = existDest.recordset[0].weight_RM || 0;
                    const existingTray = existDest.recordset[0].tray_count || 0;

                    await t()
                        .input("tro_id", sql.VarChar, new_tro_id)
                        .input("rmfp_id", sourceRecord.rmfp_id ?? rmfp_id)
                        .input("weight_RM_add", weightNum)
                        .input("tray_count_add", traysToMove)
                        .input("updated_at", currentDateTime)
                        .query(`
            UPDATE TrolleyRMMapping
            SET weight_RM = weight_RM + @weight_RM_add,
                tray_count = tray_count + @tray_count_add,
                updated_at = @updated_at
            WHERE tro_id = @tro_id AND rmfp_id = @rmfp_id
          `);

                    // 9.1.1 History ของแถวปลายทาง (มีหรือยัง)
                    const existHist = await t()
                        .input("mapping_id", destMappingId)
                        .query(`SELECT COUNT(*) AS cnt FROM History WITH (UPDLOCK, HOLDLOCK) WHERE mapping_id = @mapping_id`);

                    if (existHist.recordset[0].cnt === 0) {
                        // insert history ใหม่ โดยอิงข้อมูลเดิม + จำนวนที่เพิ่ม
                        await t()
                            .input("mapping_id", destMappingId)
                            .input("withdraw_date", historyData.withdraw_date)
                            .input("cooked_date", historyData.cooked_date)
                            .input("rmit_date", historyData.rmit_date)
                            .input("qc_date", historyData.qc_date)
                            .input("come_cold_date", historyData.come_cold_date)
                            .input("out_cold_date", historyData.out_cold_date)
                            .input("come_cold_date_two", historyData.come_cold_date_two)
                            .input("out_cold_date_two", historyData.out_cold_date_two)
                            .input("come_cold_date_three", historyData.come_cold_date_three)
                            .input("out_cold_date_three", historyData.out_cold_date_three)
                            .input("mixed_date", historyData.mixed_date)
                            .input("sc_pack_date", historyData.sc_pack_date)
                            .input("rework_date", historyData.rework_date)
                            .input("receiver", historyData.receiver)
                            .input("receiver_prep_two", historyData.receiver_prep_two)
                            .input("receiver_qc", historyData.receiver_qc)
                            .input("receiver_out_cold", historyData.receiver_out_cold)
                            .input("receiver_out_cold_two", historyData.receiver_out_cold_two)
                            .input("receiver_out_cold_three", historyData.receiver_out_cold_three)
                            .input("receiver_oven_edit", historyData.receiver_oven_edit)
                            .input("receiver_pack_edit", historyData.receiver_pack_edit)
                            .input("remark_pack_edit", historyData.remark_pack_edit)
                            .input("location", historyData.location)
                            .input("tray_count", (existDest.recordset[0].tray_count || 0) + traysToMove)
                            .input("weight_RM", (existDest.recordset[0].weight_RM || 0) + weightNum)
                            .input("md_time", historyData.md_time)
                            .input("tro_id", sql.VarChar, new_tro_id)
                            .input("rmm_line_name", sourceRecord.rmm_line_name)
                            .input("dest", sourceRecord.dest)
                            .input("name_edit_prod_two", historyData.name_edit_prod_two)
                            .input("name_edit_prod_three", historyData.name_edit_prod_three)
                            .input("first_prod", historyData.first_prod)
                            .input("two_prod", historyData.two_prod)
                            .input("three_prod", historyData.three_prod)
                            .input("receiver_qc_cold", historyData.receiver_qc_cold)
                            .input("remark_rework", historyData.remark_rework)
                            .input("remark_rework_cold", historyData.remark_rework_cold)
                            .input("edit_rework", historyData.edit_rework)
                            .input("prepare_mor_night", historyData.prepare_mor_night)
                            .query(`
              INSERT INTO History (
                mapping_id, withdraw_date, cooked_date, rmit_date, qc_date,
                come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two,
                come_cold_date_three, out_cold_date_three, mixed_date, sc_pack_date, rework_date,
                receiver, receiver_prep_two, receiver_qc, receiver_out_cold,
                receiver_out_cold_two, receiver_out_cold_three, receiver_oven_edit,
                receiver_pack_edit, remark_pack_edit, location, tray_count, weight_RM,
                md_time, tro_id, rmm_line_name, dest, name_edit_prod_two, name_edit_prod_three,
                first_prod, two_prod, three_prod, receiver_qc_cold, remark_rework, remark_rework_cold,
                edit_rework, prepare_mor_night
              )
              VALUES (
                @mapping_id, @withdraw_date, @cooked_date, @rmit_date, @qc_date,
                @come_cold_date, @out_cold_date, @come_cold_date_two, @out_cold_date_two,
                @come_cold_date_three, @out_cold_date_three, @mixed_date, @sc_pack_date, @rework_date,
                @receiver, @receiver_prep_two, @receiver_qc, @receiver_out_cold,
                @receiver_out_cold_two, @receiver_out_cold_three, @receiver_oven_edit,
                @receiver_pack_edit, @remark_pack_edit, @location, @tray_count, @weight_RM,
                @md_time, @tro_id, @rmm_line_name, @dest, @name_edit_prod_two, @name_edit_prod_three,
                @first_prod, @two_prod, @three_prod, @receiver_qc_cold, @remark_rework, @remark_rework_cold,
                @edit_rework, @prepare_mor_night
              )
            `);
                    } else {
                        // update history เดิม
                        await t()
                            .input("mapping_id", destMappingId)
                            .input("weight_RM", existingWeight + weightNum)
                            .input("tray_count", existingTray + traysToMove)
                            .input("updated_at", currentDateTime)
                            .query(`
              UPDATE History
              SET weight_RM = @weight_RM,
                  tray_count = @tray_count,
                  updated_at = @updated_at
              WHERE mapping_id = @mapping_id
            `);
                    }
                } else {
                    // 9.2 ไม่มีรายการปลายทาง → สร้างใหม่
                    const insMap = await t()
                        .input("tro_id", sql.VarChar, new_tro_id)
                        .input("rmfp_id", sourceRecord.rmfp_id ?? rmfp_id)
                        .input("batch_id", sourceRecord.batch_id ?? null)
                        .input("tro_production_id", sourceRecord.tro_production_id ?? null)
                        .input("process_id", sourceRecord.process_id ?? null)
                        .input("qc_id", sourceRecord.qc_id ?? null)
                        .input("tray_count", traysToMove)
                        .input("weight_RM", weightNum)
                        .input("level_eu", sourceRecord.level_eu ?? null)
                        .input("prep_to_cold_time", sourceRecord.prep_to_cold_time ?? null)
                        .input("cold_time", sourceRecord.cold_time ?? null)
                        .input("prep_to_pack_time", sourceRecord.prep_to_pack_time ?? null)
                        .input("cold_to_pack_time", sourceRecord.cold_to_pack_time ?? null)
                        .input("mix_time", sourceRecord.mix_time ?? null)
                        .input("rework_time", sourceRecord.rework_time ?? null)
                        .input("rm_status", sourceRecord.rm_status ?? null)
                        .input("rm_cold_status", sourceRecord.rm_cold_status ?? null)
                        .input("stay_place", sourceRecord.stay_place ?? null)
                        .input("dest", sourceRecord.dest ?? null)
                        .input("mix_code", sourceRecord.mix_code ?? mix_code ?? null)
                        .input("prod_mix", sourceRecord.prod_mix ?? null)
                        .input("allocation_date", currentDateTime)
                        .input("removal_date", null)
                        .input("status", sourceRecord.status ?? 1)
                        .input("production_batch", sourceRecord.production_batch ?? null)
                        .input("created_by", currentUser)
                        .input("created_at", currentDateTime)
                        .input("updated_at", currentDateTime)
                        .input("rmm_line_name", sourceRecord.rmm_line_name ?? null)
                        .input("tl_status", '1.2')
                        .query(`
            INSERT INTO TrolleyRMMapping (
              tro_id, rmfp_id, batch_id, tro_production_id, process_id,
              qc_id, tray_count, weight_RM,
              level_eu, prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time,
              mix_time, rework_time, rm_status, rm_cold_status,
              stay_place, dest, mix_code, prod_mix, allocation_date,
              removal_date, status, production_batch, created_by, created_at, updated_at, rmm_line_name,tl_status
            )
            OUTPUT INSERTED.mapping_id
            VALUES (
              @tro_id, @rmfp_id, @batch_id, @tro_production_id, @process_id,
              @qc_id, @tray_count, @weight_RM,
              @level_eu, @prep_to_cold_time, @cold_time, @prep_to_pack_time, @cold_to_pack_time,
              @mix_time, @rework_time, @rm_status, @rm_cold_status,
              @stay_place, @dest, @mix_code, @prod_mix, @allocation_date,
              @removal_date, @status, @production_batch, @created_by, @created_at, @updated_at, @rmm_line_name,@tl_status
            )
          `);

                    destMappingId = insMap.recordset[0].mapping_id;

                    // History ของปลายทาง (สร้างใหม่)
                    await t()
                        .input("mapping_id", destMappingId)
                        .input("withdraw_date", historyData.withdraw_date)
                        .input("cooked_date", historyData.cooked_date)
                        .input("rmit_date", historyData.rmit_date)
                        .input("qc_date", historyData.qc_date)
                        .input("come_cold_date", historyData.come_cold_date)
                        .input("out_cold_date", historyData.out_cold_date)
                        .input("come_cold_date_two", historyData.come_cold_date_two)
                        .input("out_cold_date_two", historyData.out_cold_date_two)
                        .input("come_cold_date_three", historyData.come_cold_date_three)
                        .input("out_cold_date_three", historyData.out_cold_date_three)
                        .input("mixed_date", historyData.mixed_date)
                        .input("sc_pack_date", historyData.sc_pack_date)
                        .input("rework_date", historyData.rework_date)
                        .input("receiver", historyData.receiver)
                        .input("receiver_prep_two", historyData.receiver_prep_two)
                        .input("receiver_qc", historyData.receiver_qc)
                        .input("receiver_out_cold", historyData.receiver_out_cold)
                        .input("receiver_out_cold_two", historyData.receiver_out_cold_two)
                        .input("receiver_out_cold_three", historyData.receiver_out_cold_three)
                        .input("receiver_oven_edit", historyData.receiver_oven_edit)
                        .input("receiver_pack_edit", historyData.receiver_pack_edit)
                        .input("remark_pack_edit", historyData.remark_pack_edit)
                        .input("location", historyData.location)
                        .input("tray_count", traysToMove)
                        .input("weight_RM", weightNum)
                        .input("md_time", historyData.md_time)
                        .input("tro_id", sql.VarChar, new_tro_id)
                        .input("rmm_line_name", sourceRecord.rmm_line_name)
                        .input("dest", sourceRecord.dest)
                        .input("name_edit_prod_two", historyData.name_edit_prod_two)
                        .input("name_edit_prod_three", historyData.name_edit_prod_three)
                        .input("first_prod", historyData.first_prod)
                        .input("two_prod", historyData.two_prod)
                        .input("three_prod", historyData.three_prod)
                        .input("receiver_qc_cold", historyData.receiver_qc_cold)
                        .input("prepare_mor_night", historyData.prepare_mor_night)
                        .input("remark_rework", historyData.remark_rework)
                        .input("remark_rework_cold", historyData.remark_rework_cold)
                        .input("edit_rework", historyData.edit_rework)
                        .query(`
            INSERT INTO History (
              mapping_id, withdraw_date, cooked_date, rmit_date, qc_date,
              come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two,
              come_cold_date_three, out_cold_date_three, mixed_date, sc_pack_date, rework_date,
              receiver, receiver_prep_two, receiver_qc, receiver_out_cold,
              receiver_out_cold_two, receiver_out_cold_three, receiver_oven_edit,
              receiver_pack_edit, remark_pack_edit, location, tray_count, weight_RM,
              md_time, tro_id, rmm_line_name, dest, name_edit_prod_two, name_edit_prod_three,
              first_prod, two_prod, three_prod, receiver_qc_cold, prepare_mor_night,
              remark_rework, remark_rework_cold, edit_rework
            )
            VALUES (
              @mapping_id, @withdraw_date, @cooked_date, @rmit_date, @qc_date,
              @come_cold_date, @out_cold_date, @come_cold_date_two, @out_cold_date_two,
              @come_cold_date_three, @out_cold_date_three, @mixed_date, @sc_pack_date, @rework_date,
              @receiver, @receiver_prep_two, @receiver_qc, @receiver_out_cold,
              @receiver_out_cold_two, @receiver_out_cold_three, @receiver_oven_edit,
              @receiver_pack_edit, @remark_pack_edit, @location, @tray_count, @weight_RM,
              @md_time, @tro_id, @rmm_line_name, @dest, @name_edit_prod_two, @name_edit_prod_three,
              @first_prod, @two_prod, @three_prod, @receiver_qc_cold, @prepare_mor_night,
              @remark_rework, @remark_rework_cold, @edit_rework
            )
          `);
                }

                // 9.3 คัดลอก Batch records จาก mapping เก่ามาที่ mapping ใหม่
                const batchRecords = await t()
                    .input("source_mapping_id", sourceMappingId)
                    .query(`
        SELECT 
            batch_id, 
            batch_after,
            batch_before,
            mapping_id
        FROM Batch WITH (HOLDLOCK)
        WHERE mapping_id = @source_mapping_id
    `);

                // ถ้ามี batch records ให้คัดลอกไปที่ mapping ใหม่
                if (batchRecords.recordset.length > 0) {
                    for (const batch of batchRecords.recordset) {
                        await t()
                            .input("mapping_id", destMappingId)
                            .input("batch_after", batch.batch_after)
                            .input("batch_before", batch.batch_before)
                            .query(`
                INSERT INTO Batch (
                    mapping_id,
                    batch_after,
                    batch_before
                )
                VALUES (
                    @mapping_id,
                    @batch_after,
                    @batch_before
                )
            `);
                    }

                    debugLog(`✅ คัดลอก ${batchRecords.recordset.length} batch records ไปยัง mapping_id: ${destMappingId}`);
                }

                // 10) เช็คน้ำหนักรวมต้นทาง
                const sourceWeightRes = await t()
                    .input("tro_id", sql.VarChar, tro_id)
                    .query(`
          SELECT SUM(weight_RM) AS total_weight
          FROM TrolleyRMMapping WITH (HOLDLOCK)
          WHERE tro_id = @tro_id
        `);
                const sourceTotalWeight = sourceWeightRes.recordset[0]?.total_weight || 0;

                if (sourceTotalWeight === 0) {
                    // 10.1 ปลดช่องจอด
                    await t()
                        .input("slot_id", sql.VarChar, slot_id)
                        .query(`UPDATE Slot SET tro_id = NULL ,status ='3867' WHERE slot_id = @slot_id`);
                    // 10.2 set รถเข็นว่าง
                    await t()
                        .input("tro_id", sql.VarChar, tro_id)
                        .query(`UPDATE Trolley SET tro_status = '1',status = '2.0' WHERE tro_id = @tro_id`);
                }

                // 11) น้ำหนักรวมปลายทาง
                const destWeightRes = await t()
                    .input("tro_id", sql.VarChar, new_tro_id)
                    .query(`
          SELECT SUM(weight_RM) AS total_weight
          FROM TrolleyRMMapping WITH (HOLDLOCK)
          WHERE tro_id = @tro_id
        `);
                const destTotalWeight = destWeightRes.recordset[0]?.total_weight || 0;

                await tx.commit();

                return res.status(200).json({
                    message: "Raw material moved successfully",
                    details: {
                        sourceWeight: sourceTotalWeight,
                        destinationWeight: destTotalWeight,
                        movedWeight: weightNum,
                        movedTrays: traysToMove,
                        sourceMappingId: sourceMappingId,
                        destMappingId: destMappingId
                    }
                });
            } catch (err) {
                try { await safeRollback(tx); } catch (_) { }
                console.error("Transaction Error:", err);
                return res.status(500).json({ error: "Transaction failed", message: err.message });
            }
        } catch (error) {
            console.error("Error:", error.message);
            console.error("Stack trace:", error.stack);
            return res.status(500).json({
                error: "Internal Server Error",
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    router.put("/coldstorage/moveTrolley", async (req, res) => {
        const { tro_id, new_slot_id } = req.body;

        try {
            const pool = await connectToDatabase(); // เชื่อมต่อกับฐานข้อมูล

            // ตรวจสอบว่า tro_id มีอยู่ในระบบหรือไม่
            const trolleyResult = await pool
                .request()
                .input("tro_id", sql.VarChar(4), tro_id)
                .query("SELECT tro_status FROM Trolley WHERE tro_id = @tro_id");

            if (trolleyResult.recordset.length === 0) {
                return res.status(400).json({ success: false, message: "รถเข็นไม่พร้อมใช้งาน" });
            }

            const tro_status = trolleyResult.recordset[0].tro_status;

            // ตรวจสอบสถานะของรถเข็น (เช่น ต้องไม่เป็นรถเข็นว่าง)
            if (tro_status === 1) {
                return res.status(400).json({ success: false, message: "รถเข็นไม่มีวัตถุดิบ" });
            }

            // เริ่ม Transaction พร้อม SERIALIZABLE เพื่อกัน race condition
            const transaction = new sql.Transaction(pool);
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

            // helper function สำหรับ query ที่ผูกกับ transaction
            const t = () => transaction.request();

            try {
                // ตรวจสอบ slot ใหม่ใน transaction และ lock row
                const slotResult = await t()
                    .input("new_slot_id", sql.VarChar(4), new_slot_id)
                    .query("SELECT tro_id, slot_status FROM Slot WITH (UPDLOCK, HOLDLOCK) WHERE slot_id = @new_slot_id");

                if (slotResult.recordset.length === 0) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ไม่พบช่องเก็บของในระบบ" });
                }

                const slot = slotResult.recordset[0];

                // ตรวจสอบว่าช่องนี้ว่าง (tro_id = NULL)
                if (slot.tro_id !== null) {
                    await safeRollback(transaction);
                    return res.status(400).json({ success: false, message: "ช่องเก็บของนี้ไม่ว่าง" });
                }

                // อัปเดตช่องเก็บของเดิมให้ว่าง (tro_id = NULL) พร้อม lock
                await t()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .query("UPDATE Slot SET tro_id = NULL ,status ='3965' WHERE tro_id = @tro_id");

                // อัปเดตช่องเก็บของใหม่ให้มีรถเข็นนี้
                await t()
                    .input("tro_id", sql.VarChar(4), tro_id)
                    .input("new_slot_id", sql.VarChar(4), new_slot_id)
                    .query("UPDATE Slot SET tro_id = @tro_id , status ='3971' WHERE slot_id = @new_slot_id");

                // Commit Transaction
                await transaction.commit();

                return res.status(200).json({ success: true, message: "ย้ายรถเข็นสำเร็จ" });

            } catch (err) {
                await safeRollback(transaction);
                console.error("Transaction failed:", err);
                return res.status(500).json({ success: false, message: "Transaction failed", error: err.message });
            }

        } catch (err) {
            console.error("Database connection error", err);
            return res.status(500).json({ success: false, message: "Database connection error", error: err.message });
        }
    });


    // ประวัติห้องเย็น
    router.get("/coldstorage/history", async (req, res) => {
        // Get search parameters and filters
        const {
            page = 1,
            pageSize = 100,
            searchTerm = '',
            sortBy = 'latestTime',
            sortOrder = 'DESC',
            startDate = '',
            endDate = '',
            filterType = 'exit', // Default is 'exit' (out of cold storage), can be 'enter' (enter cold storage)
            status = ''
        } = req.query;

        // Convert page and pageSize to numbers
        const pageNum = parseInt(page, 10) || 1;
        const pageSizeNum = parseInt(pageSize, 10) || 100;

        try {
            const pool = await connectToDatabase();
            // Use converted variables for page and pageSize
            const offset = (pageNum - 1) * pageSizeNum;

            // Format dates to cover the entire day
            let formattedStartDate = startDate;
            let formattedEndDate = endDate;

            // If format is YYYY-MM-DD (without time), add time
            if (formattedStartDate.length === 10) {
                formattedStartDate += ' 00:00:00';
            }

            if (formattedEndDate.length === 10) {
                formattedEndDate += ' 23:59:59';
            }

            // Create additional conditions for WHERE clause
            let additionalWhereConditions = '';

            debugLog('Filtering params:', {
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                filterType
            });

            // Add condition: filter only entries with cold room entry or exit
            additionalWhereConditions += `
                AND (
                    h.come_cold_date IS NOT NULL
                    OR h.come_cold_date_two IS NOT NULL
                    OR h.come_cold_date_three IS NOT NULL
                    OR h.out_cold_date IS NOT NULL
                    OR h.out_cold_date_two IS NOT NULL
                    OR h.out_cold_date_three IS NOT NULL
                )
            `;

            // Add search condition
            if (searchTerm) {
                // ค้นในฐานข้อมูลทุกประวัติ: วัตถุดิบ / Batch / รถเข็น / mapping_id / แผนผลิต / HU / ช่อง
                additionalWhereConditions += `
                AND (
                    rm.mat_name LIKE @searchTerm OR rm.mat LIKE @searchTerm
                    OR h.tro_id LIKE @searchTerm
                    OR CAST(rmm.mapping_id AS VARCHAR(20)) LIKE @searchTerm
                    OR p.doc_no LIKE @searchTerm
                    OR h.hu LIKE @searchTerm
                    OR rmf.batch LIKE @searchTerm
                    OR CAST(s.slot_id AS VARCHAR(20)) LIKE @searchTerm
                    OR EXISTS (SELECT 1 FROM Batch bs WHERE bs.mapping_id = rmm.mapping_id AND (bs.batch_after LIKE @searchTerm OR bs.batch_before LIKE @searchTerm))
                )`;
            }

            // Add status condition
            if (status) {
                if (status === 'exitColdRoom') {
                    additionalWhereConditions += `
                    AND (
                        (h.out_cold_date_three IS NOT NULL AND h.come_cold_date_three IS NOT NULL)
                        OR
                        (h.out_cold_date_two IS NOT NULL AND h.come_cold_date_two IS NOT NULL AND h.come_cold_date_three IS NULL)
                        OR
                        (h.out_cold_date IS NOT NULL AND h.come_cold_date IS NOT NULL AND h.come_cold_date_two IS NULL)
                    )
                `;
                } else if (status === 'enterColdRoom') {
                    additionalWhereConditions += `
                    AND (
                        (h.come_cold_date_three IS NOT NULL AND h.out_cold_date_three IS NULL)
                        OR
                        (h.come_cold_date_two IS NOT NULL AND h.out_cold_date_two IS NULL)
                        OR
                        (h.come_cold_date IS NOT NULL AND h.out_cold_date IS NULL)
                    )
                `;
                } else if (status === 'pending') {
                    additionalWhereConditions += `
                    AND h.come_cold_date IS NULL
                `;
                }
            }

            // Add date range filter condition
            if (startDate && endDate) {
                if (filterType === 'exit') {
                    // Filter by exit time from cold room
                    additionalWhereConditions += `
                    AND (
                        (
                            h.out_cold_date_three IS NOT NULL
                            AND CONVERT(DATETIME, h.out_cold_date_three)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                        OR
                        (
                            h.out_cold_date_three IS NULL
                            AND h.out_cold_date_two IS NOT NULL
                            AND CONVERT(DATETIME, h.out_cold_date_two)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                        OR
                        (
                            h.out_cold_date_three IS NULL
                            AND h.out_cold_date_two IS NULL
                            AND h.out_cold_date IS NOT NULL
                            AND CONVERT(DATETIME, h.out_cold_date)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                    )
                `;
                } else if (filterType === 'enter') {
                    // Filter by entry time to cold room
                    additionalWhereConditions += `
                    AND (
                        (
                            h.come_cold_date_three IS NOT NULL
                            AND CONVERT(DATETIME, h.come_cold_date_three)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                        OR
                        (
                            h.come_cold_date_three IS NULL
                            AND h.come_cold_date_two IS NOT NULL
                            AND CONVERT(DATETIME, h.come_cold_date_two)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                        OR
                        (
                            h.come_cold_date_three IS NULL
                            AND h.come_cold_date_two IS NULL
                            AND h.come_cold_date IS NOT NULL
                            AND CONVERT(DATETIME, h.come_cold_date)
                            BETWEEN CONVERT(DATETIME, @startDate) AND CONVERT(DATETIME, @endDate)
                        )
                    )
                `;
                }
            }

            // Count total query
            const countQuery = `
            SELECT COUNT(*) AS total
            FROM History h
            JOIN TrolleyRMMapping rmm ON h.mapping_id = rmm.mapping_id
            JOIN RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
            JOIN ProdRawMat pr ON rmf.prod_rm_id = pr.prod_rm_id
            JOIN RawMat rm ON pr.mat = rm.mat
            JOIN Production p ON pr.prod_id = p.prod_id
            LEFT JOIN Slot s ON rmm.tro_id = s.tro_id
            WHERE 1=1
            ${additionalWhereConditions}
        `;

            // Main query
            const mainQuery = `
            SELECT
                rm.mat_name AS rawMaterialName,
                rm.mat AS mat,
                ISNULL(
    (
        SELECT STRING_AGG(b2.batch_after, CHAR(13) + CHAR(10))
        FROM Batch b2
        WHERE b2.mapping_id = rmm.mapping_id
              AND b2.batch_after IS NOT NULL
    ),
    rmf.batch
) AS batch,
                p.doc_no + ' (' + h.rmm_line_name + ')' AS code,
                h.tro_id AS trolleyId,
                s.slot_id,
                h.weight_RM AS weight,
                h.tray_count AS trayCount,
                q.sq_remark,
                q.md_remark,
                rmm.level_eu,
                q.defect_remark,
                q.qccheck,
                q.mdcheck,
                q.defectcheck,
                q.sq_acceptance,
                q.defect_acceptance,
                h.name_edit_prod_two,
                h.name_edit_prod_three,
                h.first_prod,
                h.two_prod,
                h.three_prod,
                h.qccheck_cold,
                h.receiver_qc_cold,
                h.prepare_mor_night,
                h.remark_rework,
                h.receiver_qc_cold,
                CONCAT(q.WorkAreaCode, \'-\', mwa.WorkAreaName, '/', q.md_no) AS machine_MD,
                CONVERT(VARCHAR, h.rmit_date, 120) AS prepCompleteTime,
                FORMAT(rmm.prep_to_cold_time, 'N2') AS ptc_time,
                FORMAT(rmg.prep_to_cold, 'N2') AS standard_ptc,
                CONVERT(VARCHAR, h.withdraw_date, 120) AS withdraw_date,
                CONVERT(VARCHAR, h.come_cold_date, 120) AS enterColdTime1,
                CONVERT(VARCHAR, h.out_cold_date, 120) AS exitColdTime1,
                CONVERT(VARCHAR, h.come_cold_date_two, 120) AS enterColdTime2,
                CONVERT(VARCHAR, h.out_cold_date_two, 120) AS exitColdTime2,
                CONVERT(VARCHAR, h.come_cold_date_three, 120) AS enterColdTime3,
                CONVERT(VARCHAR, h.out_cold_date_three, 120) AS exitColdTime3,
                CONVERT(VARCHAR, h.cooked_date, 120) AS cooked_date,
                CONVERT(VARCHAR, h.rmit_date, 120) AS rmit_date,
                h.receiver_out_cold AS exitOperator1,
                h.receiver_out_cold_two AS exitOperator2,
                h.receiver_out_cold_three AS exitOperator3,
                h.rework_time,
                h.mix_time,
                h.cold_to_pack_time,
                rmg.cold_to_pack,
                h.cold_dest
            FROM
                History h
            JOIN
                TrolleyRMMapping rmm ON h.mapping_id = rmm.mapping_id
            JOIN
                RMForProd rmf ON rmm.rmfp_id = rmf.rmfp_id
            JOIN
                ProdRawMat pr ON rmm.tro_production_id = pr.prod_rm_id
            JOIN
                RawMat rm ON pr.mat = rm.mat
            JOIN
                Production p ON pr.prod_id = p.prod_id
            LEFT JOIN
                Qc q ON rmm.qc_id = q.qc_id
            LEFT JOIN
                WorkAreas mwa ON q.WorkAreaCode = mwa.WorkAreaCode
            JOIN
                RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
            LEFT JOIN
                Slot s ON rmm.tro_id = s.tro_id
            ${additionalWhereConditions}
            ORDER BY
    CASE
        WHEN h.come_cold_date_three IS NOT NULL THEN h.come_cold_date_three
        WHEN h.out_cold_date_three IS NOT NULL THEN h.out_cold_date_three
        WHEN h.come_cold_date_two IS NOT NULL THEN h.come_cold_date_two
        WHEN h.out_cold_date_two IS NOT NULL THEN h.out_cold_date_two
        WHEN h.come_cold_date IS NOT NULL THEN h.come_cold_date
        ELSE h.out_cold_date
    END DESC
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY
        `;

            // Prepare requests
            const countRequest = pool.request();
            const mainRequest = pool.request();

            // Add parameters
            if (searchTerm) {
                countRequest.input('searchTerm', `%${searchTerm}%`);
                mainRequest.input('searchTerm', `%${searchTerm}%`);
            }

            // Add parameters for date range filtering
            if (startDate && endDate) {
                countRequest.input('startDate', formattedStartDate);
                countRequest.input('endDate', formattedEndDate);
                mainRequest.input('startDate', formattedStartDate);
                mainRequest.input('endDate', formattedEndDate);
            }

            mainRequest.input('offset', offset);
            mainRequest.input('pageSize', pageSizeNum); // Use converted value

            // Get total count
            const totalCountResult = await countRequest.query(countQuery);
            const totalCount = totalCountResult.recordset[0].total;

            debugLog(`Found ${totalCount} total records matching criteria`);

            // Get data
            const result = await mainRequest.query(mainQuery);

            // Format data
            const formattedData = result.recordset.map(record => {
                const newRecord = { ...record };

                // Format date fields
                const dateFields = [
                    'prepCompleteTime',
                    'enterColdTime1', 'enterColdTime2', 'enterColdTime3',
                    'exitColdTime1', 'exitColdTime2', 'exitColdTime3'
                ];

                dateFields.forEach(field => {
                    if (newRecord[field]) {
                        newRecord[field] = newRecord[field].replace('T', ' ');
                    }
                });

                // Create entry/exit history
                newRecord.entryExitHistory = [];

                // Add cold room entry history
                [
                    { time: 'enterColdTime1', seq: 1 },
                    { time: 'enterColdTime2', seq: 2 },
                    { time: 'enterColdTime3', seq: 3 }
                ].forEach(entry => {
                    if (newRecord[entry.time]) {
                        newRecord.entryExitHistory.push({
                            type: 'enterColdRoom',
                            sequence: entry.seq,
                            time: newRecord[entry.time],
                            operator: 'unspecified'
                        });
                    }
                });

                // Add cold room exit history
                [
                    { time: 'exitColdTime1', seq: 1, nameField: 'exitOperator1' },
                    { time: 'exitColdTime2', seq: 2, nameField: 'exitOperator2' },
                    { time: 'exitColdTime3', seq: 3, nameField: 'exitOperator3' }
                ].forEach(entry => {
                    if (newRecord[entry.time]) {
                        newRecord.entryExitHistory.push({
                            type: 'exitColdRoom',
                            sequence: entry.seq,
                            time: newRecord[entry.time],
                            operator: newRecord[entry.nameField] || 'unspecified'
                        });
                    }
                });

                // Sort history by time
                newRecord.entryExitHistory.sort((a, b) => new Date(b.time) - new Date(a.time));

                // Add summary fields
                newRecord.latestStatus = newRecord.entryExitHistory.length > 0 ?
                    newRecord.entryExitHistory[0].type : '-';

                newRecord.latestStatusTime = newRecord.entryExitHistory.length > 0 ?
                    newRecord.entryExitHistory[0].time : null;

                // Add latest exit time field (used for filtering and display)
                const lastExitHistory = newRecord.entryExitHistory.find(h => h.type === 'exitColdRoom');
                newRecord.latestExitTime = lastExitHistory ? lastExitHistory.time : null;

                // Add latest entry time field
                const lastEnterHistory = newRecord.entryExitHistory.find(h => h.type === 'enterColdRoom');
                newRecord.latestEnterTime = lastEnterHistory ? lastEnterHistory.time : null;

                return newRecord;
            });

            // Send data with metadata
            return res.json({
                data: formattedData,
                total: totalCount,
                page: pageNum, // Use converted value
                pageSize: pageSizeNum, // Use converted value
                filterType: filterType, // Send filter type back to frontend
                filterParams: {
                    startDate: formattedStartDate,
                    endDate: formattedEndDate
                }
            });
        } catch (error) {
            console.error("Error fetching cold storage history:", error);
            return res.status(500).json({
                error: "Internal Server Error",
                message: error.message
            });
        }
    });










    // API สำหรับดึงข้อมูลน้ำหนักตามสถานะย้อนหลังตามช่วงเวลา
    router.get("/coldstorage/history/getWeightStats", async (req, res) => {
        try {
            const { hoursBack = 4 } = req.query;

            // คำนวณช่วงเวลาย้อนหลัง
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - (parseInt(hoursBack) * 60 * 60 * 1000));

            const pool = await connectToDatabase();

            // ดึงข้อมูลจากประวัติการเข้า-ออกห้องเย็น และคำนวณน้ำหนักตามสถานะ
            const result = await pool.request()
                .input("startTime", sql.DateTime, startTime)
                .input("endTime", sql.DateTime, endTime)
                .query(`
                WITH TimeIntervals AS (
                    -- สร้างจุดเวลาทุก 30 นาที ในช่วงเวลาที่ต้องการ
                    SELECT DATEADD(MINUTE, (30 * number), @startTime) AS interval_time
                    FROM master.dbo.spt_values
                    WHERE type = 'P' 
                    AND number BETWEEN 0 AND DATEDIFF(MINUTE, @startTime, @endTime) / 30
                )
                
                SELECT 
                    CONVERT(VARCHAR, t.interval_time, 120) AS timestamp,
                    ROUND(COALESCE(SUM(CASE 
                        WHEN h.come_cold_date <= t.interval_time
                        AND (h.out_cold_date IS NULL OR h.out_cold_date > t.interval_time)
                        AND DATEDIFF(MINUTE, h.come_cold_date, t.interval_time) < rmg.cold * 60 * 0.5
                        THEN rmt.weight_RM ELSE 0 END), 0), 2) AS greenWeight,
                        
                    ROUND(COALESCE(SUM(CASE 
                        WHEN h.come_cold_date <= t.interval_time
                        AND (h.out_cold_date IS NULL OR h.out_cold_date > t.interval_time)
                        AND DATEDIFF(MINUTE, h.come_cold_date, t.interval_time) BETWEEN rmg.cold * 60 * 0.5 AND rmg.cold * 60 * 0.99
                        THEN rmt.weight_RM ELSE 0 END), 0), 2) AS yellowWeight,
                    
                    ROUND(COALESCE(SUM(CASE 
                        WHEN h.come_cold_date <= t.interval_time
                        AND (h.out_cold_date IS NULL OR h.out_cold_date > t.interval_time)
                        AND DATEDIFF(MINUTE, h.come_cold_date, t.interval_time) >= rmg.cold * 60
                        THEN rmt.weight_RM ELSE 0 END), 0), 2) AS redWeight
                FROM 
                    TimeIntervals t
                LEFT JOIN 
                    History h ON 
                    (h.come_cold_date <= t.interval_time AND (h.out_cold_date IS NULL OR h.out_cold_date > t.interval_time))
                    OR (h.come_cold_date_two <= t.interval_time AND (h.out_cold_date_two IS NULL OR h.out_cold_date_two > t.interval_time))
                    OR (h.come_cold_date_three <= t.interval_time AND (h.out_cold_date_three IS NULL OR h.out_cold_date_three > t.interval_time))
                LEFT JOIN 
                    RMInTrolley rmt ON rmt.hist_id_rmit = h.hist_id
                LEFT JOIN 
                    RMForProd rmf ON rmt.rmfp_id = rmf.rmfp_id
                LEFT JOIN 
                    RawMatGroup rmg ON rmf.rm_group_id = rmg.rm_group_id
                WHERE
                    rmg.cold IS NOT NULL
                GROUP BY 
                    t.interval_time
                ORDER BY 
                    t.interval_time
            `);

            // เพิ่มคำนวณน้ำหนักรวม
            const formattedData = result.recordset.map(item => {
                const greenWeight = parseFloat(item.greenWeight) || 0;
                const yellowWeight = parseFloat(item.yellowWeight) || 0;
                const redWeight = parseFloat(item.redWeight) || 0;

                return {
                    timestamp: item.timestamp,
                    greenWeight,
                    yellowWeight,
                    redWeight,
                    totalWeight: parseFloat((greenWeight + yellowWeight + redWeight).toFixed(2))
                };
            });

            res.status(200).json(formattedData);
        } catch (err) {
            console.error("Error fetching historical weight statistics:", err);
            res.status(500).json({
                success: false,
                error: "Failed to fetch historical data",
                details: err.message
            });
        }
    });

    router.get("/coldstorage/EmptyTrolley", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool
                .request()
                .query(`
        SELECT 
          t.tro_id,
          cs.cs_name,
          s.slot_id
          
        FROM 
          Trolley t 
        JOIN 
          Slot s ON t.tro_id = s.tro_id
        LEFT JOIN 
          TrolleyRMMapping rmm ON t.tro_id = rmm.tro_id 
        JOIN 
          ColdStorage cs ON s.cs_id = cs.cs_id
        WHERE 
          t.tro_status = 0 
        AND 
          rmm.mapping_id IS NULL
        AND 
          s.slot_id IS NOT NULL 
      `);

            res.json(result.recordset);
        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    router.post("/coldstorages/scan/sap", async (req, res) => {
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

            const request = new sql.Request(transaction);

            // ✅ ดึงข้อมูลครบทุก field ที่ต้องใช้
            const checkHU = await request
                .input("hu", sql.Int, parseInt(hu, 10))
                .query(`
                SELECT TOP 1
                    withdraw_date,
                    withdraw_date_two,
                    withdraw_date_three,
                    withdraw_date_four,
                    input_cd_date,
                    input_cd_date_two,
                    input_cd_date_three
                FROM SAP_Receive
                WHERE hu = @hu AND status = 1
            `);

            if (checkHU.recordset.length === 0) {
                // ─── ไม่มี HU → INSERT รอบที่ 1 ───────────────────────────
                await request
                    .input("batch", batch)
                    .input("mat", mat)
                    .input("status", sql.Int, 1)
                    .query(`
                    INSERT INTO SAP_Receive (batch, mat, hu, withdraw_date, status)
                    VALUES (@batch, @mat, @hu, GETDATE(), @status)
                `);

                await transaction.commit();
                return res.json({
                    success: true,
                    round: 1,
                    action: "insert",
                    message: "บันทึกข้อมูลการสแกนเสร็จสิ้น (รอบที่ 1)",
                    summary: { batch, mat, hu },
                });

            } else {
                const row = checkHU.recordset[0];
                let updateQuery = "";
                let round = 0;

                if (!row.withdraw_date) {
                    // ─── รอบที่ 1: withdraw_date ยังว่าง ──────────────────
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET withdraw_date = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 1;

                } else if (!row.withdraw_date_two && row.input_cd_date) {
                    // ─── รอบที่ 2: ต้องมี input_cd_date ก่อน ──────────────
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET withdraw_date_two = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 2;

                } else if (!row.withdraw_date_three && row.input_cd_date_two) {
                    // ─── รอบที่ 3: ต้องมี input_cd_date_two ก่อน ──────────
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET withdraw_date_three = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 3;

                } else if (!row.withdraw_date_four && row.input_cd_date_three) {
                    // ─── รอบที่ 4: ต้องมี input_cd_date_three ก่อน ─────────
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET withdraw_date_four = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 4;

                } else if (!row.input_cd_date) {
                    // ─── ยังไม่มี input_cd_date → ยังออกรอบ 2 ไม่ได้ ──────
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ยังไม่มีการรับเข้าห้องเย็น (input_cd_date) ไม่สามารถจ่ายรอบถัดไปได้",
                    });

                } else if (!row.input_cd_date_two) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ยังไม่มีการรับเข้าห้องเย็นรอบ 2 (input_cd_date_two) ไม่สามารถจ่ายรอบถัดไปได้",
                    });

                } else if (!row.input_cd_date_three) {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "ยังไม่มีการรับเข้าห้องเย็นรอบ 3 (input_cd_date_three) ไม่สามารถจ่ายรอบถัดไปได้",
                    });

                } else {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "HU นี้ครบ 4 รอบแล้ว ไม่สามารถเพิ่มได้อีก",
                    });
                }

                await request.query(updateQuery);
                await transaction.commit();
                return res.json({
                    success: true,
                    round,
                    action: "update",
                    message: `อัปเดตข้อมูลการสแกนเสร็จสิ้น (รอบที่ ${round})`,
                    summary: { batch, mat, hu },
                });
            }

        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.post("/coldstorages/scan/sap/out/cs", async (req, res) => {
        const { mat, batch, hu, weight } = req.body;


        if (!mat || !batch || !hu || !weight) {
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


            // ✅ insert RMForProd
            const request = new sql.Request(transaction);
            await request
                .input("batch", batch)
                .input("mat", mat)
                .input("hu", hu)
                .input("weight", weight)
                .input("status", "1")
                .query(`
        INSERT INTO SAP_Receive (batch, mat,hu,weight,cs_out_datetime_minus_18,status)
        VALUES (@batch, @mat, @hu, @weight, GETDATE(), @status)
      `);


            await transaction.commit();


            res.json({
                success: true,
                message: "บันทึกข้อมูลการสแกนเสร็จสิ้น",
                summary: { batch, mat, hu, weight }, // ✅ ตัวอย่าง summary
            });
        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // router.post("/coldstorages/scan/sap/start/defrost", async (req, res) => {

    //     const { mat, batch, hu, weight } = req.body;

    //     if (!mat || !batch || !hu || !weight) {
    //         return res.status(400).json({
    //             success: false,
    //             message: "Missing or invalid required fields",
    //         });
    //     }

    //     let transaction;

    //     try {

    //         const pool = await connectToDatabase();

    //         transaction = new sql.Transaction(pool);

    //         await transaction.begin();

    //         const request = new sql.Request(transaction);

    //         // ✅ UPDATE อย่างเดียว ไม่มีเงื่อนไข ไม่มี INSERT
    //         const result = await request
    //             .input("hu", hu)
    //             .input("mat", mat)
    //             .input("batch", batch)
    //             .input("weight", weight)
    //             .query(`
    //                 UPDATE SAP_Receive
    //                 SET
    //                     mat = @mat,
    //                     batch = @batch,
    //                     weight = @weight,
    //                     start_defrost_date = GETDATE()
    //                 WHERE hu = @hu
    //             `);

    //         await transaction.commit();

    //         res.json({
    //             success: true,
    //             message: "อัปเดตข้อมูลสำเร็จ",
    //             rowsAffected: result.rowsAffected[0],
    //             summary: { batch, mat, hu, weight }
    //         });

    //     } catch (err) {

    //         if (transaction) {
    //             await safeRollback(transaction);
    //         }

    //         console.error("SQL error", err);

    //         res.status(500).json({
    //             success: false,
    //             error: err.message
    //         });
    //     }
    // });


    router.post("/coldstorages/scan/sap/start/defrost", async (req, res) => {
        const { mat, batch, hu, weight } = req.body;

        if (!mat || !batch || !hu || !weight) {
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

            const request = new sql.Request(transaction);

            // ✅ ดึงข้อมูลครบทุก field ที่ต้องใช้เช็คเงื่อนไข
            const checkHU = await request
                .input("hu", sql.Int, parseInt(hu, 10))
                .query(`
                SELECT TOP 1
                    start_defrost_date,
                    start_defrost_date_two,
                    start_defrost_date_three,
                    start_defrost_date_four,
                    input_cd_date,
                    input_cd_date_two,
                    input_cd_date_three
                FROM SAP_Receive
                WHERE hu = @hu AND status = 1
            `);

            if (checkHU.recordset.length === 0) {
                // ─── ไม่มี HU → INSERT รอบที่ 1 ───────────────────────────
                await request
                    .input("batch", batch)
                    .input("mat", mat)
                    .input("weight", sql.Decimal(18, 2), parseFloat(weight))
                    .input("status", sql.Int, 1)
                    .query(`
                    INSERT INTO SAP_Receive
                        (batch, mat, hu, weight, start_defrost_date, status)
                    VALUES
                        (@batch, @mat, @hu, @weight, GETDATE(), @status)
                `);

                await transaction.commit();
                return res.json({
                    success: true,
                    round: 1,
                    message: "บันทึกข้อมูลการสแกนเสร็จสิ้น (รอบที่ 1)",
                });

            } else {
                const row = checkHU.recordset[0];
                let updateQuery = "";
                let round = 0;

                if (!row.start_defrost_date_two) {
                    // ─── รอบที่ 2: start_defrost_date และ input_cd_date ต้องมีค่า ───
                    if (!row.start_defrost_date) {
                        await safeRollback(transaction);
                        return res.status(400).json({
                            success: false,
                            message: "ยังไม่มีการเริ่มละลายรอบที่ 1 (start_defrost_date)",
                        });
                    }
                    if (!row.input_cd_date) {
                        await safeRollback(transaction);
                        return res.status(400).json({
                            success: false,
                            message: "ยังไม่มีการรับเข้าห้องเย็นรอบที่ 1 (input_cd_date)",
                        });
                    }
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET start_defrost_date_two = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 2;

                } else if (!row.start_defrost_date_three) {
                    // ─── รอบที่ 3: start_defrost_date_two และ input_cd_date_two ต้องมีค่า ───
                    if (!row.input_cd_date_two) {
                        await safeRollback(transaction);
                        return res.status(400).json({
                            success: false,
                            message: "ยังไม่มีการรับเข้าห้องเย็นรอบที่ 2 (input_cd_date_two)",
                        });
                    }
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET start_defrost_date_three = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 3;

                } else if (!row.start_defrost_date_four) {
                    // ─── รอบที่ 4: start_defrost_date_three และ input_cd_date_three ต้องมีค่า ───
                    if (!row.input_cd_date_three) {
                        await safeRollback(transaction);
                        return res.status(400).json({
                            success: false,
                            message: "ยังไม่มีการรับเข้าห้องเย็นรอบที่ 3 (input_cd_date_three)",
                        });
                    }
                    updateQuery = `
                    UPDATE SAP_Receive
                    SET start_defrost_date_four = GETDATE()
                    WHERE hu = @hu AND status = 1
                `;
                    round = 4;

                } else {
                    await safeRollback(transaction);
                    return res.status(400).json({
                        success: false,
                        message: "HU นี้ครบ 4 รอบแล้ว ไม่สามารถเพิ่มได้อีก",
                    });
                }

                await request.query(updateQuery);
                await transaction.commit();
                return res.json({
                    success: true,
                    round,
                    message: `บันทึกข้อมูลการสแกนเสร็จสิ้น (รอบที่ ${round})`,
                });
            }

        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.post("/coldstorages/scan/sap/end/defrost", async (req, res) => {
        const { mat, batch, hu, weight } = req.body;

        if (!mat || !batch || !hu || !weight) {
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

            const request = new sql.Request(transaction);

            // ✅ ค้นหา HU และดึงค่า start/end defrost ทุกรอบ
            const checkHU = await request
                .input("hu", sql.Int, parseInt(hu, 10))
                .query(`
                SELECT TOP 1
                    start_defrost_date,       end_defrost_date,
                    start_defrost_date_two,   end_defrost_date_two,
                    start_defrost_date_three, end_defrost_date_three,
                    start_defrost_date_four,  end_defrost_date_four
                FROM SAP_Receive
                WHERE hu = @hu AND status = 1
            `);

            if (checkHU.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบข้อมูล HU: ${hu} ในระบบ`,
                });
            }

            const row = checkHU.recordset[0];

            let updateQuery = "";
            let round = 0;

            if (row.start_defrost_date && !row.end_defrost_date) {
                // รอบที่ 1: start มีค่า แต่ end ยังว่าง
                updateQuery = `
                UPDATE SAP_Receive
                SET end_defrost_date = GETDATE(), weight = @weight
                WHERE hu = @hu AND status = 1
            `;
                round = 1;
            } else if (row.start_defrost_date_two && !row.end_defrost_date_two) {
                // รอบที่ 2
                updateQuery = `
                UPDATE SAP_Receive
                SET end_defrost_date_two = GETDATE(), weight = @weight
                WHERE hu = @hu AND status = 1
            `;
                round = 2;
            } else if (row.start_defrost_date_three && !row.end_defrost_date_three) {
                // รอบที่ 3
                updateQuery = `
                UPDATE SAP_Receive
                SET end_defrost_date_three = GETDATE(), weight = @weight
                WHERE hu = @hu AND status = 1
            `;
                round = 3;
            } else if (row.start_defrost_date_four && !row.end_defrost_date_four) {
                // รอบที่ 4
                updateQuery = `
                UPDATE SAP_Receive
                SET end_defrost_date_four = GETDATE(), weight = @weight
                WHERE hu = @hu AND status = 1
            `;
                round = 4;
            } else {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: "ไม่พบรอบที่รอ end_defrost หรือครบทุกรอบแล้ว",
                });
            }

            await request
                .input("weight", sql.Decimal(18, 2), parseFloat(weight))
                .query(updateQuery);

            await transaction.commit();

            return res.json({
                success: true,
                round,
                message: `บันทึกเวลาละลายเสร็จสิ้น (รอบที่ ${round})`,
                summary: { batch, mat, hu, weight },
            });

        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    router.post("/coldstorages/scan/sap/come/cs", async (req, res) => {
        const { mat, batch, hu, weight } = req.body;

        if (!mat || !batch || !hu || !weight) {
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

            // ✅ ค้นหา hu ในตาราง
            const checkReq = new sql.Request(transaction);
            const checkResult = await checkReq
                .input("hu", hu)
                .query(`SELECT sap_re_id, start_defrost_date FROM SAP_Receive WHERE hu = @hu`);

            if (checkResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบข้อมูล HU: ${hu} ในระบบ`,
                });
            }

            // ✅ ตรวจสอบว่ามี start_defrost_date หรือยัง
            const row = checkResult.recordset[0];
            if (!row.start_defrost_date) {
                await safeRollback(transaction);
                return res.status(400).json({
                    success: false,
                    message: `ยังไม่ได้บันทึกเวลาเริ่มละลาย สำหรับ HU: ${hu}`,
                });
            }

            // ✅ พบ hu และมี start_defrost_date → UPDATE cs_come_cold_after_df_date และ weight
            const updateReq = new sql.Request(transaction);
            await updateReq
                .input("hu", hu)
                .input("weight", weight)
                .query(`
        UPDATE SAP_Receive
        SET cs_come_cold_after_df_date = GETDATE(),
            weight           = @weight
        WHERE hu = @hu
      `);

            await transaction.commit();

            res.json({
                success: true,
                message: "บันทึกเวลาละลายเสร็จสิ้น",
                action: "update",
                summary: { batch, mat, hu, weight },
            });

        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // PUT/PATCH update remark in SAP_Receive
    router.put("/coldstorages/remark/sap", async (req, res) => {
        const { sap_re_id, remark } = req.body;

        if (!sap_re_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: sap_re_id",
            });
        }

        let transaction;
        try {
            const pool = await connectToDatabase();
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            const request = new sql.Request(transaction);
            const result = await request
                .input("sap_re_id", sql.Int, sap_re_id)
                .input("remark", sql.NVarChar(sql.MAX), remark || null)
                .query(`
                UPDATE SAP_Receive
                SET remark = @remark
                WHERE sap_re_id = @sap_re_id
            `);

            if (result.rowsAffected[0] === 0) {
                await safeRollback(transaction);
                return res.status(404).json({
                    success: false,
                    message: "ไม่พบข้อมูลที่ต้องการแก้ไข",
                });
            }

            await transaction.commit();

            // ✅ ถ้ามี socket.io broadcast
            if (req.io) {
                req.io.to("QcCheckRoom").emit("qcUpdated", { sap_re_id, remark });
            }

            res.json({
                success: true,
                message: "บันทึก Remark เรียบร้อยแล้ว",
                data: { sap_re_id, remark },
            });
        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("SQL error", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    router.get("/coldstorages/scan/sap", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const dateParam = req.query.date;
            const targetDate = dateParam
                ? dateParam
                : new Date().toISOString().split("T")[0];

            const result = await pool
                .request()
                .input("targetDate", targetDate)
                .query(`
                SELECT 
                    s.sap_re_id,
                    s.batch,
                    s.mat,
                    s.hu,
                    s.weight,
                    s.remark,
                    CONVERT(varchar, s.withdraw_date, 120) AS withdraw_date, 
                CONVERT(varchar, s.start_defrost_date, 120) AS start_defrost_date, 
                CONVERT(varchar, s.end_defrost_date, 120) AS end_defrost_date, 
                CONVERT(varchar, s.start_defrost_date_two, 120) AS start_defrost_date_two, 
                CONVERT(varchar, s.end_defrost_date_two, 120) AS end_defrost_date_two, 
                CONVERT(varchar, s.start_defrost_date_three, 120) AS start_defrost_date_three, 
                CONVERT(varchar, s.end_defrost_date_three, 120) AS end_defrost_date_three, 
                CONVERT(varchar, s.start_defrost_date_four, 120) AS start_defrost_date_four, 
                CONVERT(varchar, s.end_defrost_date_four, 120) AS end_defrost_date_four, 
                CONVERT(varchar, s.input_pd_date, 120) AS input_pd_date, 
                CONVERT(varchar, s.output_pd_date, 120) AS output_pd_date,
                CONVERT(varchar, s.input_cd_date, 120) AS input_cd_date,
                CONVERT(varchar, s.withdraw_date_two , 120) AS withdraw_date_two ,
                CONVERT(varchar, s.input_pd_date_two, 120) AS input_pd_date_two, 
                CONVERT(varchar, s.output_pd_date_two, 120) AS output_pd_date_two, 
                CONVERT(varchar, s.input_cd_date_two, 120) AS input_cd_date_two, 
                CONVERT(varchar, s.withdraw_date_three, 120) AS withdraw_date_three ,
                CONVERT(varchar, s.input_pd_date_three, 120) AS input_pd_date_three, 
                CONVERT(varchar, s.output_pd_date_three, 120) AS output_pd_date_three,
                CONVERT(varchar, s.input_cd_date_three, 120) AS input_cd_date_three ,
                CONVERT(varchar, s.withdraw_date_four, 120) AS withdraw_date_four 
                FROM SAP_Receive s
                WHERE status = 1
                  AND CAST(s.withdraw_date AS DATE) = @targetDate
            `);

            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("Error fetching SAP defrost data:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    });

    router.get("/coldstorages/scan/sap/month", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const request = pool.request();

            // รับวันที่จาก query param หรือใช้วันปัจจุบัน
            const dateParam = req.query.withdraw_date
                ? new Date(req.query.withdraw_date)
                : new Date();

            // Format เป็น YYYY-MM-DD
            const targetDate = dateParam.toISOString().split('T')[0];

            request.input('targetDate', targetDate);

            const result = await request.query(`
            SELECT  
                s.sap_re_id, 
                s.batch, 
                s.mat, 
                s.hu, 
                s.weight,
                s.remark, 
                CONVERT(varchar, s.withdraw_date, 120) AS withdraw_date, 
                CONVERT(varchar, s.start_defrost_date, 120) AS start_defrost_date, 
                CONVERT(varchar, s.end_defrost_date, 120) AS end_defrost_date, 
                CONVERT(varchar, s.start_defrost_date_two, 120) AS start_defrost_date_two, 
                CONVERT(varchar, s.end_defrost_date_two, 120) AS end_defrost_date_two, 
                CONVERT(varchar, s.start_defrost_date_three, 120) AS start_defrost_date_three, 
                CONVERT(varchar, s.end_defrost_date_three, 120) AS end_defrost_date_three, 
                CONVERT(varchar, s.start_defrost_date_four, 120) AS start_defrost_date_four, 
                CONVERT(varchar, s.end_defrost_date_four, 120) AS end_defrost_date_four, 
                CONVERT(varchar, s.input_pd_date, 120) AS input_pd_date, 
                CONVERT(varchar, s.output_pd_date, 120) AS output_pd_date,
                CONVERT(varchar, s.input_cd_date, 120) AS input_cd_date,
                CONVERT(varchar, s.withdraw_date_two , 120) AS withdraw_date_two ,
                CONVERT(varchar, s.input_pd_date_two, 120) AS input_pd_date_two, 
                CONVERT(varchar, s.output_pd_date_two, 120) AS output_pd_date_two, 
                CONVERT(varchar, s.input_cd_date_two, 120) AS input_cd_date_two, 
                CONVERT(varchar, s.withdraw_date_three, 120) AS withdraw_date_three ,
                CONVERT(varchar, s.input_pd_date_three, 120) AS input_pd_date_three, 
                CONVERT(varchar, s.output_pd_date_three, 120) AS output_pd_date_three,
                CONVERT(varchar, s.input_cd_date_three, 120) AS input_cd_date_three ,
                CONVERT(varchar, s.withdraw_date_four, 120) AS withdraw_date_four 

            FROM SAP_Receive s 
            WHERE  CAST(s.withdraw_date AS DATE) = @targetDate
            ORDER BY s.withdraw_date DESC
        `);

            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("Error fetching SAP defrost data:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });



    router.get("/coldstorages/scan/sap/end/defrost", async (req, res) => {

        try {

            const pool = await connectToDatabase();

            const dateParam = req.query.date;

            const targetDate = dateParam
                ? dateParam
                : new Date().toISOString().split("T")[0];

            const result = await pool
                .request()
                .input("targetDate", targetDate)
                .query(`
                SELECT 
                    s.sap_re_id,
                    s.batch,
                    s.mat,
                    s.hu,
                    s.remark,
                    s.weight,

                    FORMAT(
                        s.start_defrost_date,
                        'yyyy-MM-dd HH:mm:ss'
                    ) AS start_defrost_date,

                    FORMAT(
                        s.end_defrost_date,
                        'yyyy-MM-dd HH:mm:ss'
                    ) AS end_defrost_date

                FROM SAP_Receive s

                WHERE status = 1
                  AND CAST(s.end_defrost_date AS DATE) = @targetDate

                ORDER BY s.end_defrost_date DESC
            `);

            res.json({
                success: true,
                data: result.recordset
            });

        } catch (error) {

            console.error("Error fetching SAP defrost data:", error);

            res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    });


    router.get("/coldstorages/scan/sap/come/cs", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const dateParam = req.query.date;
            const targetDate = dateParam
                ? dateParam
                : new Date().toISOString().split("T")[0];

            const result = await pool
                .request()
                .input("targetDate", targetDate)
                .query(`
        SELECT 
          s.sap_re_id,
          s.batch,
          s.mat,
          s.hu,
          s.remark,
          s.weight,
          FORMAT(s.start_defrost_date,        'yyyy-MM-dd HH:mm:ss') AS start_defrost_date,
          FORMAT(s.end_defrost_date,           'yyyy-MM-dd HH:mm:ss') AS end_defrost_date,
          FORMAT(s.cs_come_cold_after_df_date, 'yyyy-MM-dd HH:mm:ss') AS cs_come_cold_after_df_date
        FROM SAP_Receive s
        WHERE status = 1
          AND CAST(s.cs_come_cold_after_df_date AS DATE) = @targetDate
        ORDER BY s.cs_come_cold_after_df_date DESC
      `);

            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("Error fetching SAP defrost data:", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    });
    router.get("/coldstorages/scan/sap/start/defrost", async (req, res) => {

        try {

            const pool = await connectToDatabase();

            const dateParam = req.query.date;

            const targetDate = dateParam
                ? dateParam
                : new Date().toISOString().split("T")[0];

            const result = await pool
                .request()
                .input("targetDate", targetDate)
                .query(`
                SELECT 
                    s.sap_re_id,
                    s.batch,
                    s.mat,
                    s.hu,
                    s.remark,
                    s.weight,

                    FORMAT(
                        s.start_defrost_date,
                        'yyyy-MM-dd HH:mm:ss'
                    ) AS start_defrost_date

                 

                FROM SAP_Receive s

                WHERE status = 1
                  AND CAST(s.start_defrost_date AS DATE) = @targetDate

                ORDER BY s.start_defrost_date DESC
            `);

            res.json({
                success: true,
                data: result.recordset
            });

        } catch (error) {

            console.error("Error fetching SAP defrost data:", error);

            res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    });

    router.get("/coldstorages/scan/sap/out/cs", async (req, res) => {
        try {
            const pool = await connectToDatabase();

            const dateParam = req.query.date;
            const targetDate = dateParam
                ? dateParam
                : new Date().toISOString().split("T")[0];

            const result = await pool
                .request()
                .input("targetDate", targetDate)
                .query(`
        SELECT 
          s.sap_re_id,
          s.batch,
          s.mat,
          s.hu,
          s.remark,
          s.weight,
          FORMAT(s.cs_out_datetime_minus_18, 'yyyy-MM-dd HH:mm:ss') AS cs_out_datetime_minus_18
        FROM SAP_Receive s
        WHERE status = 1
          AND CAST(s.cs_out_datetime_minus_18 AS DATE) = @targetDate
        ORDER BY s.cs_out_datetime_minus_18 DESC
      `);

            res.json({ success: true, data: result.recordset });
        } catch (error) {
            console.error("Error fetching SAP defrost data:", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    });








    router.put("/coldstorages/sap/update-hu", async (req, res) => {
        const { old_hu, new_hu, new_weight } = req.body;

        if (!old_hu || !new_hu) {
            return res.status(400).json({ success: false, error: "กรุณาระบุ old_hu และ new_hu" });
        }

        const newHuInt = parseInt(new_hu, 10);
        if (isNaN(newHuInt)) {
            return res.status(400).json({ success: false, error: "new_hu ต้องเป็นตัวเลข" });
        }

        const newWeightInt = new_weight != null ? parseInt(new_weight, 10) : null;

        let transaction;
        try {
            const pool = await connectToDatabase();
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            // ── ดึงข้อมูลเดิมจาก SAP_Receive WHERE hu = old_hu ──────────────────
            const srcResult = await new sql.Request(transaction)
                .input("old_hu", sql.Int, parseInt(old_hu, 10))
                .query(`
                    SELECT TOP 1
                        batch, mat, status, remark, weight,
                        start_defrost_date, end_defrost_date,
                        start_defrost_date_two, end_defrost_date_two,
                        start_defrost_date_three, end_defrost_date_three,
                        start_defrost_date_four, end_defrost_date_four,
                        input_pd_date, input_pd_date_two, input_pd_date_three,
                        output_pd_date, output_pd_date_two, output_pd_date_three,
                        withdraw_date, withdraw_date_two, withdraw_date_three, withdraw_date_four,
                        input_cd_date, input_cd_date_two, input_cd_date_three,
                        pd_send, pd_send2, pd_send3,
                        cs_re, cs_re_2, cs_re_3,
                        cs_wd_2, cs_wd_3, cs_wd_4,
                        storage_purpose, storage_purpose_2, storage_purpose_3,
                        histamine, histamine_2, histamine_3
                    FROM SAP_Receive
                    WHERE hu = @old_hu
                    ORDER BY sap_re_id DESC
                `);

            if (srcResult.recordset.length === 0) {
                await safeRollback(transaction);
                return res.status(404).json({ success: false, error: `ไม่พบข้อมูล HU: ${old_hu}` });
            }

            const s = srcResult.recordset[0];

            // ── INSERT row ใหม่พร้อม new_hu ──────────────────────────────────────
            await new sql.Request(transaction)
                .input("new_hu", sql.Int, newHuInt)
                .input("batch", sql.NVarChar(100), s.batch ?? null)
                .input("mat", sql.NVarChar(100), s.mat ?? null)
                .input("status", sql.Int, s.status ?? null)
                .input("remark", sql.NVarChar(300), s.remark ?? null)
                .input("weight", sql.Int, newWeightInt ?? s.weight ?? null)
                .input("start_defrost_date", sql.DateTime, s.start_defrost_date ?? null)
                .input("end_defrost_date", sql.DateTime, s.end_defrost_date ?? null)
                .input("start_defrost_date_two", sql.DateTime, s.start_defrost_date_two ?? null)
                .input("end_defrost_date_two", sql.DateTime, s.end_defrost_date_two ?? null)
                .input("start_defrost_date_three", sql.DateTime, s.start_defrost_date_three ?? null)
                .input("end_defrost_date_three", sql.DateTime, s.end_defrost_date_three ?? null)
                .input("start_defrost_date_four", sql.DateTime, s.start_defrost_date_four ?? null)
                .input("end_defrost_date_four", sql.DateTime, s.end_defrost_date_four ?? null)
                .input("input_pd_date", sql.DateTime, s.input_pd_date ?? null)
                .input("input_pd_date_two", sql.DateTime, s.input_pd_date_two ?? null)
                .input("input_pd_date_three", sql.DateTime, s.input_pd_date_three ?? null)
                .input("output_pd_date", sql.DateTime, s.output_pd_date ?? null)
                .input("output_pd_date_two", sql.DateTime, s.output_pd_date_two ?? null)
                .input("output_pd_date_three", sql.DateTime, s.output_pd_date_three ?? null)
                .input("withdraw_date", sql.DateTime, s.withdraw_date ?? null)
                .input("withdraw_date_two", sql.DateTime, s.withdraw_date_two ?? null)
                .input("withdraw_date_three", sql.DateTime, s.withdraw_date_three ?? null)
                .input("withdraw_date_four", sql.DateTime, s.withdraw_date_four ?? null)
                .input("input_cd_date", sql.DateTime, s.input_cd_date ?? null)
                .input("input_cd_date_two", sql.DateTime, s.input_cd_date_two ?? null)
                .input("input_cd_date_three", sql.DateTime, s.input_cd_date_three ?? null)
                .input("pd_send", sql.NVarChar(50), s.pd_send ?? null)
                .input("pd_send2", sql.NVarChar(50), s.pd_send2 ?? null)
                .input("pd_send3", sql.NVarChar(50), s.pd_send3 ?? null)
                .input("cs_re", sql.NVarChar(50), s.cs_re ?? null)
                .input("cs_re_2", sql.NVarChar(50), s.cs_re_2 ?? null)
                .input("cs_re_3", sql.NVarChar(50), s.cs_re_3 ?? null)
                .input("cs_wd_2", sql.NVarChar(50), s.cs_wd_2 ?? null)
                .input("cs_wd_3", sql.NVarChar(50), s.cs_wd_3 ?? null)
                .input("cs_wd_4", sql.NVarChar(50), s.cs_wd_4 ?? null)
                .input("storage_purpose", sql.NVarChar(50), s.storage_purpose ?? null)
                .input("storage_purpose_2", sql.NVarChar(50), s.storage_purpose_2 ?? null)
                .input("storage_purpose_3", sql.NVarChar(50), s.storage_purpose_3 ?? null)
                .input("histamine", sql.NVarChar(50), s.histamine ?? null)
                .input("histamine_2", sql.NVarChar(50), s.histamine_2 ?? null)
                .input("histamine_3", sql.NVarChar(50), s.histamine_3 ?? null)
                .input("before_hu", sql.Int, parseInt(old_hu, 10))
                .query(`
                    INSERT INTO SAP_Receive (
                        hu, batch, mat, status, remark, weight,
                        start_defrost_date, end_defrost_date,
                        start_defrost_date_two, end_defrost_date_two,
                        start_defrost_date_three, end_defrost_date_three,
                        start_defrost_date_four, end_defrost_date_four,
                        input_pd_date, input_pd_date_two, input_pd_date_three,
                        output_pd_date, output_pd_date_two, output_pd_date_three,
                        withdraw_date, withdraw_date_two, withdraw_date_three, withdraw_date_four,
                        input_cd_date, input_cd_date_two, input_cd_date_three,
                        pd_send, pd_send2, pd_send3,
                        cs_re, cs_re_2, cs_re_3,
                        cs_wd_2, cs_wd_3, cs_wd_4,
                        storage_purpose, storage_purpose_2, storage_purpose_3,
                        histamine, histamine_2, histamine_3,
                        before_hu
                    ) VALUES (
                        @new_hu, @batch, @mat, @status, @remark, @weight,
                        @start_defrost_date, @end_defrost_date,
                        @start_defrost_date_two, @end_defrost_date_two,
                        @start_defrost_date_three, @end_defrost_date_three,
                        @start_defrost_date_four, @end_defrost_date_four,
                        @input_pd_date, @input_pd_date_two, @input_pd_date_three,
                        @output_pd_date, @output_pd_date_two, @output_pd_date_three,
                        @withdraw_date, @withdraw_date_two, @withdraw_date_three, @withdraw_date_four,
                        @input_cd_date, @input_cd_date_two, @input_cd_date_three,
                        @pd_send, @pd_send2, @pd_send3,
                        @cs_re, @cs_re_2, @cs_re_3,
                        @cs_wd_2, @cs_wd_3, @cs_wd_4,
                        @storage_purpose, @storage_purpose_2, @storage_purpose_3,
                        @histamine, @histamine_2, @histamine_3,
                        @before_hu
                    )
                `);

            await transaction.commit();

            io.emit("dataUpdated", { hu: newHuInt });

            res.json({ success: true, message: `คัดลอกข้อมูล HU ${old_hu} → ${newHuInt} สำเร็จ` });
        } catch (err) {
            if (transaction) await safeRollback(transaction);
            console.error("[PUT /coldstorages/sap/update-hu] error:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.put("/coldstorage/clearTrolley", async (req, res) => {
        try {
            const { tro_id } = req.body;
            const pool = await connectToDatabase();

            // เริ่มต้น Transaction พร้อม SERIALIZABLE
            const transaction = new sql.Transaction(pool);
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

            // helper function สำหรับ query ที่ผูกกับ transaction
            const t = () => transaction.request();

            try {
                // อัปเดทสถานะรถเข็นเป็น 1 (ว่าง) พร้อม lock
                const trolleyResult = await t()
                    .input('tro_id', sql.VarChar(4), tro_id)
                    .query(`
                    UPDATE Trolley
                    SET tro_status = 1,status = '2.1'
                    OUTPUT INSERTED.tro_id
                    WHERE tro_id = @tro_id
                `);

                if (trolleyResult.recordset.length === 0) {
                    await safeRollback(transaction);
                    return res.status(404).json({ error: "รถเข็นไม่พร้อมใช้งาน", tro_id });
                }

                // อัปเดต tro_id เป็น NULL ใน table Slot พร้อม lock
                await t()
                    .input('tro_id', sql.VarChar(4), tro_id)
                    .query(`
                    UPDATE Slot
                    SET tro_id = NULL ,status ='4587'
                    WHERE tro_id = @tro_id
                `);

                // Commit Transaction
                await transaction.commit();

                res.status(200).json({ message: "อัพเดตสถานะรถเข็นและล้าง tro_id ใน Slot สำเร็จ" });

            } catch (err) {
                // Rollback ถ้ามี error
                await safeRollback(transaction);
                console.error("Transaction failed:", err);
                res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัพเดตข้อมูล", detail: err.message });
            }

        } catch (error) {
            console.error("Database connection error:", error);
            res.status(500).json({ error: "Database connection error", detail: error.message });
        }
    });

    // ── Dropdown APIs for DelayTimeTrackingRM filters ─────────────────────────

    router.get("/dropdown/lines", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT line_id, line_name, line_type_id
          FROM [Line]
          ORDER BY line_name
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/lines]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/doc-no", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT doc_no
          FROM [Production]
          WHERE doc_no IS NOT NULL AND doc_no <> ''
          ORDER BY doc_no
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/doc-no]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/code", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT code
          FROM [Production]
          WHERE code IS NOT NULL AND code <> ''
          ORDER BY code
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/code]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/batch-before", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT batch_before
          FROM [Batch]
          WHERE batch_before IS NOT NULL AND batch_before <> ''
          ORDER BY batch_before
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/batch-before]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/batch-after", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT batch_after
          FROM [Batch]
          WHERE batch_after IS NOT NULL AND batch_after <> ''
          ORDER BY batch_after
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/batch-after]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/hu", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT hu
          FROM [SAP_Receive]
          WHERE hu IS NOT NULL
          ORDER BY hu
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/hu]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/mat", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT mat, mat_name
          FROM [RawMat]
          WHERE mat IS NOT NULL
          ORDER BY mat_name
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/mat]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get("/dropdown/mat-name", async (req, res) => {
        try {
            const pool = await connectToDatabase();
            const result = await pool.request().query(`
          SELECT DISTINCT mat_name
          FROM [RawMat]
          WHERE mat_name IS NOT NULL AND mat_name <> ''
          ORDER BY mat_name
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error("[GET /dropdown/mat-name]", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ─── ย้ายวัตถุดิบระหว่างรถเข็น (split weight) ────────────────────────────────────
    // POST /api/coldstorage/transfer-mapping
    // body: { mapping_id, target_tro_id, transfer_weight }
    // - UPDATE weight_RM ของ row เดิม
    // - INSERT QC ใหม่ (copy จาก qc_id เดิม)
    // - INSERT TrolleyRMMapping ใหม่ (copy ทุก column, tro_id/weight_RM/qc_id/from_mapping_id ต่างกัน)
    // - INSERT History ใหม่ (copy ทุก column, mapping_id/tro_id/weight_RM ต่างกัน)
    // - INSERT Batch ใหม่ (copy จาก mapping_id เดิม)
    router.post("/coldstorage/transfer-mapping", async (req, res) => {
        const { mapping_id, target_tro_id, transfer_weight } = req.body;

        if (!mapping_id || !target_tro_id || transfer_weight === undefined) {
            return res.status(400).json({ success: false, error: "กรุณาระบุ mapping_id, target_tro_id และ transfer_weight" });
        }

        const w = parseFloat(transfer_weight);
        if (isNaN(w) || w <= 0) {
            return res.status(400).json({ success: false, error: "transfer_weight ต้องเป็นตัวเลขที่มากกว่า 0" });
        }

        let pool, transaction, began = false;

        try {
            pool = await connectToDatabase();

            // 1. ดึง row เดิม
            const origResult = await pool.request()
                .input("mapping_id", sql.Int, parseInt(mapping_id))
                .query(`SELECT weight_RM, qc_id FROM TrolleyRMMapping WHERE mapping_id = @mapping_id`);

            if (origResult.recordset.length === 0)
                return res.status(404).json({ success: false, error: "ไม่พบ mapping_id ที่ระบุ" });

            const orig = origResult.recordset[0];
            const origWeight = parseFloat(orig.weight_RM);

            if (w > origWeight)
                return res.status(400).json({ success: false, error: `น้ำหนักที่ย้ายต้องไม่เกิน ${origWeight} กก.` });

            // 2. ตรวจสอบรถเข็นปลายทาง
            const troCheck = await pool.request()
                .input("tro_id", sql.VarChar(50), target_tro_id)
                .query(`SELECT tro_id FROM Trolley WHERE tro_id = @tro_id`);

            if (troCheck.recordset.length === 0)
                return res.status(404).json({ success: false, error: `ไม่พบรถเข็น ${target_tro_id} ในระบบ` });

            transaction = new sql.Transaction(pool);
            await transaction.begin();
            began = true;

            // 3. UPDATE weight_RM ของ row เดิม
            const remainingWeight = parseFloat((origWeight - w).toFixed(4));
            await transaction.request()
                .input("mapping_id", sql.Int, parseInt(mapping_id))
                .input("new_weight", sql.Decimal(18, 4), remainingWeight)
                .query(`UPDATE TrolleyRMMapping SET weight_RM = @new_weight, updated_at = GETDATE() WHERE mapping_id = @mapping_id`);

            // 4. Copy QC ถ้ามี
            let new_qc_id = null;
            if (orig.qc_id) {
                const newQCResult = await transaction.request()
                    .input("qc_id", sql.Int, orig.qc_id)
                    .query(`
                        INSERT INTO QC (
                            color, odor, texture, sq_acceptance, sq_remark,
                            md, md_remark, defect, defect_remark, defect_acceptance,
                            qc_datetime, md_no, qccheck, mdcheck, defectcheck,
                            WorkAreaCode, Moisture, Temp, md_time, percent_fine,
                            general_remark, prepare_mor_night
                        )
                        OUTPUT INSERTED.qc_id
                        SELECT
                            color, odor, texture, sq_acceptance, sq_remark,
                            md, md_remark, defect, defect_remark, defect_acceptance,
                            qc_datetime, md_no, qccheck, mdcheck, defectcheck,
                            WorkAreaCode, Moisture, Temp, md_time, percent_fine,
                            general_remark, prepare_mor_night
                        FROM QC WHERE qc_id = @qc_id
                    `);
                new_qc_id = newQCResult.recordset[0]?.qc_id ?? null;
            }

            // 5. INSERT TrolleyRMMapping ใหม่ (copy จาก row เดิม)
            const newMappingResult = await transaction.request()
                .input("source_mapping_id", sql.Int, parseInt(mapping_id))
                .input("target_tro_id", sql.VarChar(50), target_tro_id)
                .input("transfer_weight", sql.Decimal(18, 4), w)
                .input("new_qc_id", sql.Int, new_qc_id)
                .query(`
                    INSERT INTO TrolleyRMMapping (
                        tro_id, rmfp_id, batch_id, tro_production_id, process_id, qc_id,
                        weight_in_trolley, tray_count, weight_per_tray, weight_RM, level_eu,
                        prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time, rework_time,
                        rm_status, rm_cold_status, stay_place, dest, mix_code, prod_mix,
                        allocation_date, removal_date, [status], production_batch, created_by,
                        created_at, updated_at, rmm_line_name, mix_time, from_mapping_id,
                        tl_status, group_no, detail, row_status
                    )
                    OUTPUT INSERTED.mapping_id
                    SELECT
                        @target_tro_id, rmfp_id, batch_id, tro_production_id, process_id, @new_qc_id,
                        weight_in_trolley, tray_count, weight_per_tray, @transfer_weight, level_eu,
                        prep_to_cold_time, cold_time, prep_to_pack_time, cold_to_pack_time, rework_time,
                        rm_status, rm_cold_status, stay_place, dest, mix_code, prod_mix,
                        allocation_date, removal_date, [status], production_batch, created_by,
                        GETDATE(), GETDATE(), rmm_line_name, mix_time, @source_mapping_id,
                        tl_status, group_no, detail, row_status
                    FROM TrolleyRMMapping
                    WHERE mapping_id = @source_mapping_id
                `);

            const new_mapping_id = newMappingResult.recordset[0]?.mapping_id;
            if (!new_mapping_id) throw new Error("ไม่สามารถสร้าง TrolleyRMMapping ใหม่ได้");

            // 6. INSERT History ใหม่ (copy ทุก column, override tro_id/mapping_id/weight_RM)
            await transaction.request()
                .input("source_mapping_id", sql.Int, parseInt(mapping_id))
                .input("new_mapping_id", sql.Int, new_mapping_id)
                .input("target_tro_id", sql.VarChar(50), target_tro_id)
                .input("transfer_weight", sql.Decimal(18, 4), w)
                .query(`
                    INSERT INTO History (
                        tro_id, mapping_id,
                        withdraw_date, cooked_date, rmit_date, qc_date,
                        come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two,
                        come_cold_date_three, out_cold_date_three, sc_pack_date, rework_date,
                        receiver, receiver_prep_two, receiver_qc,
                        receiver_out_cold, receiver_out_cold_two, receiver_out_cold_three,
                        receiver_oven_edit, receiver_pack_edit, remark_pack_edit, location,
                        mixed_date, md_time, Moisture, Temp, percent_fine,
                        tray_count, weight_RM, rmm_line_name, dest,
                        mix_time, rework_time, cold_to_pack_time, prep_to_pack_time,
                        cold_dest, prepare_mor_night, rm_status, stay_place,
                        qccheck_cold, remark_rework_cold, remark_rework, receiver_qc_cold,
                        mix_date, edit_rework, first_prod, two_prod, three_prod,
                        name_edit_prod_two, name_edit_prod_three,
                        created_at, updated_at, start_mixed_date, start_gravy_date,
                        pack_checkin_date, gm_date, viscosity, temps, weight_per_cup, rmit_date_mix,
                        come_cold_date_RFID, out_cold_date_RFID,
                        come_cold_date_two_rfid, out_cold_date_two_rfid,
                        com_cold_date_three_rfid, out_cold_date_three_rfid,
                        start_defrost_date, end_defrost_date, remark_dalay,
                        cs_come_cold_date, cs_out_cold_date,
                        cs_come_cold_date_two, cs_out_cold_date_two,
                        cs_come_cold_date_three, cs_out_cold_date_three,
                        cs_come_cold_date_four, cs_out_cold_date_four,
                        cs_come_cold_date_five, cs_out_out_date_five,
                        cs_come_cold_date_six, cs_out_cold_date_six,
                        cs_come_cold_date_seven, cs_out_cold_date_seven,
                        cs_come_cold_date_eight, cs_out_cold_date_eight,
                        cs_come_cold_date_nine, cs_out_cold_date_nine,
                        cs_come_cold_date_ten, cs_out_cold_date_ten,
                        cs_come_after_df_date, re_out_cold, re_large_cold,
                        storage_purpose, rd_section_colds, hu, remark,
                        start_defrost_date_two, end_defrost_date_two, weight,
                        input_pd_date, input_pd_date_two, input_pd_date_three,
                        output_pd_date, output_pd_date_two, output_pd_date_three,
                        withdraw_date_two, withdraw_date_three,
                        input_cd_date, input_cd_date_two, input_cd_date_three,
                        pd_send, pd_send2, pd_send3,
                        cs_re, cs_re_2, cs_re_3,
                        storage_purpose_2, storage_purpose_3, histamine_2, histamine_3,
                        withdraw_date_four, cs_wd_2, cs_wd_3, cs_wd_4,
                        start_defrost_date_three, end_defrost_date_three,
                        start_defrost_date_four, end_defrost_date_four,
                        at_pd_storage_purpose, at_pd_storage_purpose_2, at_pd_storage_purpose_3,
                        at_pd_histamine, at_pd_histamine_2, at_pd_histamine_3,
                        histamine, id_igd, mat_pkg, batch_pkg,
                        at_pd_deposit_date, at_pd_deposit_date_2, at_pd_deposit_date_3,
                        at_pd_cold_remark, at_pd_cold_remark_2, at_pd_cold_remark_3
                    )
                    SELECT
                        @target_tro_id, @new_mapping_id,
                        withdraw_date, cooked_date, rmit_date, qc_date,
                        come_cold_date, out_cold_date, come_cold_date_two, out_cold_date_two,
                        come_cold_date_three, out_cold_date_three, sc_pack_date, rework_date,
                        receiver, receiver_prep_two, receiver_qc,
                        receiver_out_cold, receiver_out_cold_two, receiver_out_cold_three,
                        receiver_oven_edit, receiver_pack_edit, remark_pack_edit, location,
                        mixed_date, md_time, Moisture, Temp, percent_fine,
                        tray_count, @transfer_weight, rmm_line_name, dest,
                        mix_time, rework_time, cold_to_pack_time, prep_to_pack_time,
                        cold_dest, prepare_mor_night, rm_status, stay_place,
                        qccheck_cold, remark_rework_cold, remark_rework, receiver_qc_cold,
                        mix_date, edit_rework, first_prod, two_prod, three_prod,
                        name_edit_prod_two, name_edit_prod_three,
                        GETDATE(), GETDATE(), start_mixed_date, start_gravy_date,
                        pack_checkin_date, gm_date, viscosity, temps, weight_per_cup, rmit_date_mix,
                        come_cold_date_RFID, out_cold_date_RFID,
                        come_cold_date_two_rfid, out_cold_date_two_rfid,
                        com_cold_date_three_rfid, out_cold_date_three_rfid,
                        start_defrost_date, end_defrost_date, remark_dalay,
                        cs_come_cold_date, cs_out_cold_date,
                        cs_come_cold_date_two, cs_out_cold_date_two,
                        cs_come_cold_date_three, cs_out_cold_date_three,
                        cs_come_cold_date_four, cs_out_cold_date_four,
                        cs_come_cold_date_five, cs_out_out_date_five,
                        cs_come_cold_date_six, cs_out_cold_date_six,
                        cs_come_cold_date_seven, cs_out_cold_date_seven,
                        cs_come_cold_date_eight, cs_out_cold_date_eight,
                        cs_come_cold_date_nine, cs_out_cold_date_nine,
                        cs_come_cold_date_ten, cs_out_cold_date_ten,
                        cs_come_after_df_date, re_out_cold, re_large_cold,
                        storage_purpose, rd_section_colds, hu, remark,
                        start_defrost_date_two, end_defrost_date_two, weight,
                        input_pd_date, input_pd_date_two, input_pd_date_three,
                        output_pd_date, output_pd_date_two, output_pd_date_three,
                        withdraw_date_two, withdraw_date_three,
                        input_cd_date, input_cd_date_two, input_cd_date_three,
                        pd_send, pd_send2, pd_send3,
                        cs_re, cs_re_2, cs_re_3,
                        storage_purpose_2, storage_purpose_3, histamine_2, histamine_3,
                        withdraw_date_four, cs_wd_2, cs_wd_3, cs_wd_4,
                        start_defrost_date_three, end_defrost_date_three,
                        start_defrost_date_four, end_defrost_date_four,
                        at_pd_storage_purpose, at_pd_storage_purpose_2, at_pd_storage_purpose_3,
                        at_pd_histamine, at_pd_histamine_2, at_pd_histamine_3,
                        histamine, id_igd, mat_pkg, batch_pkg,
                        at_pd_deposit_date, at_pd_deposit_date_2, at_pd_deposit_date_3,
                        at_pd_cold_remark, at_pd_cold_remark_2, at_pd_cold_remark_3
                    FROM History
                    WHERE mapping_id = @source_mapping_id
                `);

            // 7. INSERT Batch ใหม่ (copy จาก mapping_id เดิม)
            await transaction.request()
                .input("source_mapping_id", sql.Int, parseInt(mapping_id))
                .input("new_mapping_id", sql.Int, new_mapping_id)
                .query(`
                    INSERT INTO Batch (batch_before, batch_after, mapping_id)
                    SELECT batch_before, batch_after, @new_mapping_id
                    FROM Batch
                    WHERE mapping_id = @source_mapping_id
                `);

            await transaction.commit();
            began = false;

            io.emit("updateFetch", {});

            debugLog(`[transfer-mapping] ✅ mapping ${mapping_id} → tro ${target_tro_id} | new_mapping_id=${new_mapping_id} | weight=${w}`);

            return res.status(200).json({
                success: true,
                message: "ย้ายวัตถุดิบสำเร็จ",
                new_mapping_id,
                new_qc_id,
            });

        } catch (err) {
            console.error("[POST /coldstorage/transfer-mapping] Error:", err.message);
            if (began && transaction) {
                try { await safeRollback(transaction); } catch (rbErr) { console.error("rollback failed:", rbErr.message); }
            }
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    module.exports = router;
    return router;

};