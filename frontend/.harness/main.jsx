import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import theme from "/src/theme/dochubTheme";
import "/src/index.css";
import SheetPage from "/src/component/Sheet/SheetPage";
localStorage.setItem("rm_type_id", "[1]"); localStorage.setItem("pos_id", "3");
createRoot(document.getElementById("root")).render(<ThemeProvider theme={theme}><MemoryRouter><div style={{height:"100vh",display:"flex",flexDirection:"column"}}><SheetPage role="cs1" /></div></MemoryRouter></ThemeProvider>);
