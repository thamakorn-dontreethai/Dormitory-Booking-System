// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import ConfirmationPage from './pages/ConfirmationPage';
import Admin from './pages/admin.jsx';
import AdminLogin from './pages/AdminLogin.jsx';


axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
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
        <Route path="/BookingPage" element={<BookingPage />} />
        <Route path="/ConfirmationPage" element={<ConfirmationPage />} />
        <Route path="/Admin" element={<Admin />} />
        <Route path="/AdminLogin" element={<AdminLogin />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
