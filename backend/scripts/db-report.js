// รายงานว่าอะไรกินแรงฐานข้อมูล (อ่านอย่างเดียว) — ใช้หลังระบบรันไปสักพัก เพื่อรู้ว่าหน้าไหน / query ไหนต้องแก้ต่อ
//   cd backend && node scripts/db-report.js
// ต้องใช้สิทธิ์ VIEW SERVER STATE (ถ้า login ของ .env ไม่มี ให้รันใน SSMS ด้วย login ที่มีสิทธิ์: node scripts/db-report.js --sql แสดงคำสั่ง)
const mssql = require("mssql");

const SECTIONS = [
  ["query ที่ใช้ CPU รวมมากสุด (ตั้งแต่ plan อยู่ใน cache)", `
    SELECT TOP (15)
        qs.execution_count AS runs,
        qs.total_worker_time / 1000 AS cpu_ms_total,
        qs.total_worker_time / NULLIF(qs.execution_count, 0) / 1000 AS cpu_ms_avg,
        qs.total_elapsed_time / NULLIF(qs.execution_count, 0) / 1000 AS elapsed_ms_avg,
        qs.total_logical_reads / NULLIF(qs.execution_count, 0) AS reads_avg,
        qs.max_grant_kb / 1024 AS max_grant_mb,
        LEFT(REPLACE(REPLACE(SUBSTRING(st.text, qs.statement_start_offset / 2 + 1,
            (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset) / 2 + 1),
            CHAR(13), ' '), CHAR(10), ' '), 220) AS sql_text
    FROM sys.dm_exec_query_stats qs
    CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
    WHERE st.dbid = DB_ID() OR st.dbid IS NULL
    ORDER BY qs.total_worker_time DESC`],
  ["query ที่ช้าต่อครั้งมากสุด (รันอย่างน้อย 5 ครั้ง)", `
    SELECT TOP (10)
        qs.execution_count AS runs,
        qs.total_elapsed_time / NULLIF(qs.execution_count, 0) / 1000 AS elapsed_ms_avg,
        qs.total_worker_time / NULLIF(qs.execution_count, 0) / 1000 AS cpu_ms_avg,
        LEFT(REPLACE(REPLACE(SUBSTRING(st.text, qs.statement_start_offset / 2 + 1,
            (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset) / 2 + 1),
            CHAR(13), ' '), CHAR(10), ' '), 220) AS sql_text
    FROM sys.dm_exec_query_stats qs
    CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
    WHERE qs.execution_count >= 5 AND (st.dbid = DB_ID() OR st.dbid IS NULL)
    ORDER BY qs.total_elapsed_time / qs.execution_count DESC`],
  ["server รออะไรมากสุด (สะสมตั้งแต่ SQL Server เปิด)", `
    SELECT TOP (10) wait_type, waiting_tasks_count AS waits, wait_time_ms / 1000 AS wait_s, signal_wait_time_ms / 1000 AS cpu_queue_s
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (N'SLEEP_TASK', N'BROKER_TASK_STOP', N'BROKER_TO_FLUSH', N'SQLTRACE_BUFFER_FLUSH', N'CLR_AUTO_EVENT', N'CLR_MANUAL_EVENT',
        N'LAZYWRITER_SLEEP', N'CHECKPOINT_QUEUE', N'WAITFOR', N'XE_TIMER_EVENT', N'XE_DISPATCHER_WAIT', N'FT_IFTS_SCHEDULER_IDLE_WAIT',
        N'LOGMGR_QUEUE', N'REQUEST_FOR_DEADLOCK_SEARCH', N'DIRTY_PAGE_POLL', N'HADR_FILESTREAM_IOMGR_IOCOMPLETION', N'SP_SERVER_DIAGNOSTICS_SLEEP',
        N'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP', N'QDS_ASYNC_QUEUE', N'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', N'BROKER_EVENTHANDLER',
        N'SOS_WORK_DISPATCHER', N'BROKER_RECEIVE_WAITFOR', N'ONDEMAND_TASK_QUEUE', N'DISPATCHER_QUEUE_SEMAPHORE', N'XE_LIVE_TARGET_TVF',
        N'PREEMPTIVE_XE_DISPATCHER', N'PWAIT_EXTENSIBILITY_CLEANUP_TASK', N'SLEEP_DBSTARTUP', N'SLEEP_DCOMSTARTUP', N'SLEEP_MASTERDBREADY',
        N'SLEEP_MASTERMDREADY', N'SLEEP_MASTERUPGRADED', N'SLEEP_MSDBSTARTUP', N'SLEEP_SYSTEMTASK', N'SLEEP_TEMPDBSTARTUP', N'SNI_HTTP_ACCEPT',
        N'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', N'CXCONSUMER', N'PARALLEL_REDO_DRAIN_WORKER', N'PARALLEL_REDO_LOG_CACHE', N'PARALLEL_REDO_TRAN_LIST',
        N'PARALLEL_REDO_WORKER_SYNC', N'PARALLEL_REDO_WORKER_WAIT_WORK', N'VDI_CLIENT_OTHER', N'HADR_WORK_QUEUE', N'HADR_TIMER_TASK',
        N'HADR_CLUSAPI_CALL', N'HADR_NOTIFICATION_DEQUEUE', N'HADR_LOGCAPTURE_WAIT')
      AND wait_time_ms > 0
    ORDER BY wait_time_ms DESC`],
  ["ดัชนีที่ SQL Server แจ้งว่าขาด (ตามผลดี)", `
    SELECT TOP (15)
        OBJECT_NAME(mid.object_id) AS tbl, mid.equality_columns AS eq, mid.inequality_columns AS ineq, mid.included_columns AS incl,
        migs.user_seeks + migs.user_scans AS uses, CAST(migs.avg_user_impact AS int) AS impact_pct,
        CAST(migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) * (migs.user_seeks + migs.user_scans) AS bigint) AS improvement
    FROM sys.dm_db_missing_index_details mid
    JOIN sys.dm_db_missing_index_groups mig ON mig.index_handle = mid.index_handle
    JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
    WHERE mid.database_id = DB_ID()
    ORDER BY improvement DESC`],
  ["ดัชนีที่ระบบสร้างอัตโนมัติ (IX_pfcm_auto_) และการใช้งาน", `
    SELECT OBJECT_NAME(i.object_id) AS tbl, i.name, ISNULL(us.user_seeks, 0) AS seeks, ISNULL(us.user_scans, 0) AS scans, ISNULL(us.user_updates, 0) AS writes
    FROM sys.indexes i
    LEFT JOIN sys.dm_db_index_usage_stats us ON us.object_id = i.object_id AND us.index_id = i.index_id AND us.database_id = DB_ID()
    WHERE i.name LIKE N'IX_pfcm_auto_%' OR i.name LIKE N'IX_TrolleyRMMapping_%' OR i.name LIKE N'IX_History_%' OR i.name LIKE N'IX_DatatoPDF_%' OR i.name LIKE N'IX_RMForProd_%'
    ORDER BY tbl, i.name`],
  ["ค่าตั้งที่มีผลกับความเร็ว", `
    SELECT N'database MAXDOP' AS setting, CAST(value AS nvarchar(20)) AS value FROM sys.database_scoped_configurations WHERE name = N'MAXDOP'
    UNION ALL SELECT name, CAST(value_in_use AS nvarchar(20)) FROM sys.configurations
      WHERE name IN (N'max degree of parallelism', N'cost threshold for parallelism', N'max server memory (MB)', N'optimize for ad hoc workloads')
    UNION ALL SELECT N'cpu_count', CAST(cpu_count AS nvarchar(20)) FROM sys.dm_os_sys_info
    UNION ALL SELECT N'compatibility_level', CAST(compatibility_level AS nvarchar(20)) FROM sys.databases WHERE database_id = DB_ID()`],
];

(async () => {
  if (process.argv.includes("--sql")) {
    SECTIONS.forEach(([title, text]) => console.log(`-- ${title}${text};\n`));
    return;
  }
  const { connectToDatabase } = require("../database/db");
  const pool = await connectToDatabase();
  if (!pool) { console.error("เชื่อมต่อ DB ไม่ได้ (เช็ก .env)"); process.exit(1); }
  for (const [title, text] of SECTIONS) {
    console.log(`\n== ${title} ==`);
    try {
      const r = await pool.request().query(text);
      if (!r.recordset.length) { console.log("(ไม่มี)"); continue; }
      console.table(r.recordset);
    } catch (err) {
      console.log(`อ่านไม่ได้: ${err.message}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
