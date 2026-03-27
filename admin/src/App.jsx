import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Analytics from "./pages/Analytics.jsx";
import Verification from "./pages/Verification.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
// REMOVED: import Reports from "./pages/Reports.jsx";
import LegalDocs from "./pages/LegalDocs.jsx";
import Refunds from "./pages/Refunds.jsx";
import Invoices from "./pages/Invoices.jsx";           // NEW
import AdminProfile from "./pages/AdminProfile.jsx";   // CHANGED: was CompanyProfile
import AuthPage from "./pages/Auth.jsx";
import { useState, useEffect } from "react";
import { ensureAuth } from "./utils/auth.js";
import CookieConsent from "./components/CookiesConsent.jsx";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const authed = await ensureAuth();
        if (!mounted) return;
        setOk(!!authed);
      } catch (err) {
        if (!mounted) return;
        setOk(false);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-white">Checking authentication…</div>;
  if (!ok) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

const App = () => {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  if (isAuthRoute) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
        </Routes>
        <CookieConsent />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          {/* REMOVED: /reports route */}
          <Route path="/legal-docs" element={<ProtectedRoute><LegalDocs /></ProtectedRoute>} />
          <Route path="/refunds" element={<ProtectedRoute><Refunds /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />               {/* NEW */}
          <Route path="/admin-profile" element={<ProtectedRoute><AdminProfile /></ProtectedRoute>} />       {/* CHANGED */}
          {/* Keep /company as redirect for bookmarks */}
          <Route path="/company" element={<Navigate to="/admin-profile" replace />} />
          <Route path="*" element={<Navigate to="/analytics" replace />} />
        </Routes>
        <CookieConsent />
      </div>
    </div>
  );
};

export default App;