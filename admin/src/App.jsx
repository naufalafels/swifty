import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx"; // UPDATED: Use Sidebar component
import Analytics from "./pages/Analytics.jsx"; // NEW: Analytics page
import Verification from "./pages/Verification.jsx"; // NEW: User/Host verification page
import AuditLogs from "./pages/AuditLogs.jsx"; // NEW: Audit logs page
import Reports from "./pages/Reports.jsx"; // NEW: Reports page
import LegalDocs from "./pages/LegalDocs.jsx"; // NEW: Legal documents page
import Refunds from "./pages/Refunds.jsx"; // NEW: Refunds page
import AuthPage from "./pages/Auth.jsx";
import CompanyProfile from "./pages/CompanyProfile.jsx";
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
    <div className="flex min-h-screen bg-gray-100"> {/* NEW: Flex layout for sidebar and content */}
      <Sidebar />
      <div className="flex-1 overflow-auto"> {/* NEW: Main content area */}
        <Routes>
          <Route path="/" element={<Navigate to="/analytics" replace />} /> {/* UPDATED: Redirect root to analytics */}
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} /> {/* NEW: Analytics as default */}
          <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} /> {/* NEW */}
          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} /> {/* NEW */}
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} /> {/* NEW */}
          <Route path="/legal-docs" element={<ProtectedRoute><LegalDocs /></ProtectedRoute>} /> {/* NEW */}
          <Route path="/refunds" element={<ProtectedRoute><Refunds /></ProtectedRoute>} /> {/* NEW */}
          <Route path="/company" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/analytics" replace />} /> {/* UPDATED: Redirect unknown to analytics */}
        </Routes>
        <CookieConsent />
      </div>
    </div>
  );
};

export default App;