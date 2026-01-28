import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { BarChart3, ShieldCheck, FileText, ClipboardList, Receipt, FileSignature, Menu, X, LogOut, User, Settings, ChevronLeft, ChevronRight } from "lucide-react"; // UPDATED: Added ChevronLeft, ChevronRight for collapse toggle
import {
  getAdminToken,
  getAdminUser,
  clearAdminSession,
  adminLogout,
  ensureAuth,
} from "../utils/auth.js";
import CompanyProfileModal from "./CompanyProfileModal.jsx";
import api from "../utils/api";

const navLinks = [
  { path: "/analytics", icon: BarChart3, label: "Analytics" }, // NEW: Analytics as first
  { path: "/verification", icon: ShieldCheck, label: "Verification" }, // NEW
  { path: "/audit-logs", icon: FileText, label: "Audit Logs" }, // NEW
  { path: "/reports", icon: ClipboardList, label: "Reports" }, // NEW
  { path: "/refunds", icon: Receipt, label: "Refunds" }, // NEW
  { path: "/legal-docs", icon: FileSignature, label: "Legal Docs" }, // NEW
  { path: "/company", icon: Settings, label: "Company Profile" }, // UPDATED: Keep company, move to end
];

const Sidebar = () => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true); // UPDATED: Default to collapsed
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [company, setCompany] = useState(null);

  const [adminUser, setAdminUser] = useState(() => getAdminUser());

  // fetch company info after ensuring auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await ensureAuth();
        if (!ok) return;
        // api will attach Authorization header automatically from in-memory token
        const res = await api.get("/api/admin/company");
        if (mounted && res?.data?.company) setCompany(res.data.company);
        // refresh local user state
        setAdminUser(getAdminUser());
      } catch (err) {
        console.warn("Failed to fetch company for sidebar", err?.response?.data || err.message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await adminLogout(); // server logout + clears in-memory
    } catch (e) {
      console.warn("logout error", e);
    } finally {
      clearAdminSession();
      navigate("/login", { replace: true });
    }
  };

  const renderAvatar = () => {
    if (company && company.logo) {
      return <img src={company.logo} alt="company logo" className="w-8 h-8 rounded-full object-cover" />;
    }
    const name = adminUser?.name || adminUser?.email || "";
    const initials = name ? name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() : "";
    return (
      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
        {initials || "?"}
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`bg-gray-900 text-white p-4 transition-all duration-300 sticky top-0 h-screen overflow-y-auto flex flex-col ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with logo and collapse toggle */}
        <div className={`flex items-center justify-between mb-8 ${isCollapsed ? "justify-center" : ""}`}>
          <img src={logo} alt="Logo" className={`h-10 w-auto ${isCollapsed ? "" : "mr-3"}`} />
          {!isCollapsed && <span className="text-xl font-bold">Swifty Admin</span>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2 flex-1">
          {navLinks.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center p-3 rounded-lg hover:bg-gray-700 transition-colors ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? label : ""}
            >
              <Icon size={isCollapsed ? 24 : 20} className={isCollapsed ? "" : "mr-3"} />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className={`mt-auto ${isCollapsed ? "" : "mb-4"}`}>
          <div className={`flex items-center mb-4 ${isCollapsed ? "justify-center" : ""}`}>
            {renderAvatar()}
            {!isCollapsed && (
              <div className="ml-3">
                <p className="text-sm font-medium">{adminUser?.name || "Admin"}</p>
                <p className="text-xs text-gray-400">{adminUser?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center w-full p-3 rounded-lg hover:bg-gray-700 transition-colors ${isCollapsed ? "justify-center" : ""}`}
          >
            <LogOut size={isCollapsed ? 24 : 20} className={isCollapsed ? "" : "mr-3"} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Company Profile Modal */}
      {showCompanyModal && (
        <CompanyProfileModal onClose={() => setShowCompanyModal(false)} onSaved={(c) => setCompany(c)} />
      )}
    </>
  );
};

export default Sidebar;