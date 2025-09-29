// ============================================================
// ไฟล์: web/src/main.tsx
// ผู้เขียน: Work Permit System Tutor
// เวอร์ชัน: 2025-08-21 + auth logging
// ============================================================
import "./lib/firebase";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { startAuthLogging } from "./lib/authLogger";

startAuthLogging();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
