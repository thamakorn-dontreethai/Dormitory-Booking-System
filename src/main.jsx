// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import ConfirmationPage from './pages/ConfirmationPage.jsx';
import Admin from './pages/Admin.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import BillsPage from './pages/BillsPage.jsx';


// ใส่ token ให้ทุก request: API ของ admin ใช้ adminToken, ที่เหลือใช้ token ของนิสิต
// (แยกกัน เพื่อให้ login นิสิตและ admin ในเบราว์เซอร์เดียวกันได้)
axios.interceptors.request.use((config) => {
  const isAdminApi = String(config.url || '').includes('/api/admin/');
  const token = localStorage.getItem(isAdminApi ? "adminToken" : "token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
//main
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/HomePage" element={<HomePage />} />
        <Route path="/LoginPage" element={<LoginPage />} />
        <Route path="/RegisterPage" element={<RegisterPage />} />
        <Route path="/BookingPage" element={<BookingPage />} />
        <Route path="/ConfirmationPage" element={<ConfirmationPage />} />
        <Route path="/PaymentPage" element={<PaymentPage />} />
        <Route path="/BillsPage" element={<BillsPage />} />
        <Route path="/Admin" element={<Admin />} />
        <Route path="/AdminLogin" element={<AdminLogin />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
