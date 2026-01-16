import React, { useEffect, useRef, useState } from "react";
import { navbarStyles as styles } from "../assets/dummyStyles.js";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { CalendarCheck, Car, Menu, PlusCircle, X, LogOut, User } from "lucide-react";
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
  { path: "/", icon: PlusCircle, label: "Add Car" },
  { path: "/manage-cars", icon: Car, label: "Manage Cars" },
  { path: "/bookings", icon: CalendarCheck, label: "Bookings" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [company, setCompany] = useState(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const [adminUser, setAdminUser] = useState(() => getAdminUser());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(e.target) &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

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
        console.warn("Failed to fetch company for navbar", err?.response?.data || err.message);
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
      <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-sm font-semibold text-white">
        {initials || <User className="w-4 h-4" />}
      </div>
    );
  };

  return (
    <nav className={styles.navbar(scrolled)}>
      <div className={styles.navbarInner}>
        <div className={styles.navbarCenter}>
          <div className={styles.navbarBackground(scrolled)}>
            <div className={styles.contentContainer}>
              <Link to="/" className={styles.logoLink}>
                <div className={styles.logoContainer}>
                  <img src={logo} alt="Logo" className={styles.logoImage} style={{ objectFit: "contain" }} />
                </div>
              </Link>

              <div className={styles.desktopNav}>
                <div className={styles.navLinksContainer}>
                  {navLinks.map((link, i) => {
                    const Icon = link.icon;
                    return (
                      <React.Fragment key={link.path}>
                        <Link to={link.path} className={styles.navLink}>
                          <Icon className="w-4 h-4" />
                          <span>{link.label}</span>
                        </Link>
                        {i < navLinks.length - 1 && <div className={styles.navDivider} />}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-2 text-sm text-gray-200">
                    {renderAvatar()}
                    <div className="flex flex-col leading-none">
                      <span className="font-medium text-sm text-gray-100">{adminUser?.name || adminUser?.email || "Admin"}</span>
                      <span className="text-xs text-gray-400">{adminUser?.email || ""}</span>
                    </div>
                  </div>

                  <button onClick={() => setShowCompanyModal(true)} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
                    <User className="w-4 h-4" />
                    <span>Company</span>
                  </button>

                  <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>

              <div className={styles.mobileMenuButton}>
                <button ref={buttonRef} onClick={() => setIsOpen((v) => !v)} className={styles.menuButton} aria-label="Toggle Menu" aria-expanded={isOpen}>
                  {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div ref={menuRef} className={styles.mobileMenu}>
          <div className={styles.mobileMenuContainer}>
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} to={link.path} className={styles.mobileNavLink} onClick={() => setIsOpen(false)}>
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="border-t border-gray-700 my-2" />

            <button onClick={() => { setIsOpen(false); setShowCompanyModal(true); }} className={styles.mobileNavLink}>
              <User className="w-5 h-5" />
              <span>Company</span>
            </button>

            <button onClick={() => { setIsOpen(false); handleLogout(); }} className={styles.mobileNavLink}>
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {showCompanyModal && <CompanyProfileModal onClose={() => setShowCompanyModal(false)} />}
    </nav>
  );
};

export default Navbar;