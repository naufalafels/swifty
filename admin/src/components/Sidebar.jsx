import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/v.png";
import axios from "axios"; // FIX: Import axios (was missing — `api` was never defined)
import { BarChart3, ShieldCheck, FileText, Receipt, FileSignature, FileBarChart, LogOut, User, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAdminToken,
  getAdminUser,
  clearAdminSession,
  adminLogout,
  ensureAuth,
} from "../utils/auth.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:7889"; // FIX: define API_BASE

// FIX: Removed Reports, replaced "Company Profile" with "Admin Profile", added Invoices
const navLinks = [
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/verification", icon: ShieldCheck, label: "Verification" },
  { path: "/audit-logs", icon: FileText, label: "Audit Logs" },
  { path: "/refunds", icon: Receipt, label: "Refunds" },
  { path: "/invoices", icon: FileBarChart, label: "Invoices" },       // NEW
  { path: "/legal-docs", icon: FileSignature, label: "Legal Docs" },
  { path: "/admin-profile", icon: User, label: "Admin Profile" },     // CHANGED: was "/company" → Company Profile
];

const Sidebar = () => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [adminUser, setAdminUser] = useState(() => getAdminUser());

  // Fetch admin user profile on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await ensureAuth();
        if (!ok) return;
        const token = getAdminToken(); // FIX: use token from cookies
        if (token) {
          const res = await axios.get(`${API_BASE}/api/admin/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (mounted && res?.data?.profile) {
            setAdminUser(res.data.profile);
          }
        }
        // Also refresh from in-memory
        const memUser = getAdminUser();
        if (mounted && memUser && !adminUser) setAdminUser(memUser);
      } catch (err) {
        console.warn("Failed to fetch admin profile for sidebar", err?.response?.data || err.message);
        // Fallback to in-memory user
        if (mounted) setAdminUser(getAdminUser());
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } catch (e) {
      console.warn("logout error", e);
    } finally {
      clearAdminSession();
      navigate("/login", { replace: true });
    }
  };

  const renderAvatar = () => {
    // FIX: Show admin's own profile picture instead of company logo
    if (adminUser?.profilePicture) {
      return <img src={adminUser.profilePicture} alt="avatar" className="w-8 h-8 rounded-full object-cover" />;
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
      <div
        className={`bg-gray-900 text-white p-4 transition-all duration-300 sticky top-0 h-screen overflow-y-auto flex flex-col ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className={`flex items-center justify-between mb-8 ${isCollapsed ? "justify-center" : ""}`}>
          <img src={logo} alt="Logo" className={`h-10 w-auto ${isCollapsed ? "" : "mr-3"}`} />
          {!isCollapsed && <span className="text-xl font-bold">Administration</span>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

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
    </>
  );
};

export default Sidebar;