import { useState } from "react";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ParentComponent from "./Asset/ParentComponent";
import ScanCheckinPage from "./Asset/ScanCheckinPage";
import { Box, Tabs, Tab } from "@mui/material";
import TableRowsIcon from "@mui/icons-material/TableRows";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

const BatchSAPPage = () => {
  const [tab, setTab] = useState(0);

  return (
    <div
      style={{ backgroundColor: "#fff" }}
      className="flex-1 overflow-auto relative z-10"
    >
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="ทำรายการ Time Stamp รับเข้าวัตถุดิบจากห้องเย็นใหญ่" />
      </main>

      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { fontSize: "13px", fontWeight: 600, minHeight: "44px", textTransform: "none" },
              "& .Mui-selected": { color: "#1565C0" },
              "& .MuiTabs-indicator": { backgroundColor: "#1565C0" },
            }}
          >
            <Tab icon={<TableRowsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="ตารางข้อมูล & Time Stamp" />
            <Tab icon={<QrCodeScannerIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Scan QR / Barcode รับเข้า" />
          </Tabs>
        </Box>

        {tab === 0 && <ParentComponent />}
        {tab === 1 && <ScanCheckinPage />}
      </main>

      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default BatchSAPPage;
