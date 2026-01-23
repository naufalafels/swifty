// src/components/Navbar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaTimes, FaUser, FaSignOutAlt } from "react-icons/fa";
import logo from "../assets/swifty-logo.png";
import { navbarStyles as styles } from "../assets/dummyStyles.js";
import api from "../utils/api";
import * as authService from "../utils/authService";

const ME_ENDPOINT = "/api/auth/me";
const LOGOUT_ENDPOINT = "/api/auth/logout";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const abortRef = useRef(null);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/cars", label: "Cars" },
    { to: "/contact", label: "Contact" },
    { to: "/bookings", label: "My Bookings" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const validateToken = useCallback(
    async (signal) => {
      try {
        const ok = await authService.ensureAuth();
        if (!ok) {
          setIsLoggedIn(false);
          setUser(null);
          return;
        }
        const res = await api.get(ME_ENDPOINT, { signal });
        const profile = res?.data?.user ?? res?.data ?? null;
        if (profile) {
          setIsLoggedIn(true);
          setUser(profile);
          try {
            authService.setCurrentUser(profile);
          } catch {}
        } else {
          setIsLoggedIn(true);
          setUser(null);
        }
      } catch (err) {
        if (err?.response && err.response.status === 401) {
          authService.setAccessToken(null);
          authService.setCurrentUser(null);
          setIsLoggedIn(false);
          setUser(null);
        } else {
          setUser(null);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;
    validateToken(controller.signal);
    return () => {
      try { controller.abort(); } catch {}
      abortRef.current = null;
    };
  }, [validateToken]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (abortRef.current) {
          try { abortRef.current.abort(); } catch {}
        }
        const controller = new AbortController();
        abortRef.current = controller;
        validateToken(controller.signal);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [validateToken]);

  const handleLogout = useCallback(async () => {
    try {
      await api.post(LOGOUT_ENDPOINT, {}, { withCredentials: true, timeout: 2000 });
    } catch {}
    await authService.logout();
    setIsLoggedIn(false);
    setUser(null);
    setIsOpen(false);
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setIsOpen(false);
    setIsLoggedIn(!!authService.getAccessToken());
    try {
      setUser(authService.getCurrentUser());
    } catch {
      setUser(null);
    }
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const isHost = Array.isArray(user?.roles) && user.roles.includes("host");

  // If host -> host dashboard, if logged-in non-host -> onboard, if guest -> login then dashboard
  const goHost = () => {
    if (!isLoggedIn) {
      navigate("/login", { replace: false, state: { from: "/host/dashboard" } });
    } else if (isHost) {
      navigate("/host/dashboard");
    } else {
      navigate("/host/onboard");
    }
  };

  return (
    <nav
      className={`${styles.nav.base} ${
        scrolled ? styles.nav.scrolled : styles.nav.notScrolled
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <div
            className={`${styles.floatingNav.base} ${
              scrolled
                ? styles.floatingNav.scrolled
                : styles.floatingNav.notScrolled
            }`}
            role="region"
            aria-roledescription="navigation"
          >
            <div className="flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center">
                <div className={styles.logoContainer}>
                  <img
                    src={logo}
                    alt="Swifty logo"
                    className="h-[1em] w-auto block"
                    style={{ display: "block", objectFit: "contain" }}
                  />
                </div>
              </Link>

              <div className={styles.navLinksContainer}>
                <div className={styles.navLinksInner}>
                  {navLinks.map((link, index) => (
                    <React.Fragment key={link.to}>
                      <Link
                        to={link.to}
                        className={`${styles.navLink.base} ${
                          isActive(link.to)
                            ? styles.navLink.active
                            : styles.navLink.inactive
                        }`}
                      >
                        {link.label}
                      </Link>

                      {index < navLinks.length - 1 && (
                        <div className={styles.separator} aria-hidden="true" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={goHost}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition"
                >
                  {isHost ? "Host Center" : "Become a Host"}
                </button>

                <div className={styles.userActions}>
                  {isLoggedIn ? (
                    <button
                      onClick={handleLogout}
                      className={styles.authButton}
                      aria-label="Logout"
                      title={user?.name || "Logout"}
                    >
                      <FaSignOutAlt className="text-base" />
                      <span className={styles.authText}>Logout</span>
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className={styles.authButton}
                      aria-label="Login"
                    >
                      <FaUser className="text-base" />
                      <span className={styles.authText}>Login</span>
                    </Link>
                  )}
                </div>

                <div className="md:hidden flex items-center">
                  <button
                    ref={buttonRef}
                    onClick={() => setIsOpen((p) => !p)}
                    className={styles.mobileMenuButton}
                    aria-expanded={isOpen}
                    aria-controls="mobile-menu"
                    aria-label={isOpen ? "Close menu" : "Open menu"}
                  >
                    {isOpen ? (
                      <FaTimes className="h-5 w-5" />
                    ) : (
                      <FaBars className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        ref={menuRef}
        className={`${styles.mobileMenu.container} ${
          isOpen ? styles.mobileMenu.open : styles.mobileMenu.closed
        }`}
        aria-hidden={!isOpen}
      >
        <div className={styles.mobileMenuInner}>
          <div className="px-4 pt-3 pb-4 space-y-2">
            <div className={styles.mobileGrid}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={`${styles.mobileLink.base} ${
                    isActive(link.to)
                      ? styles.mobileLink.active
                      : styles.mobileLink.inactive
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className={styles.divider} />

            <div className="pt-1 space-y-2">
              <button
                onClick={() => { setIsOpen(false); goHost(); }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 bg-amber-100 text-amber-900 font-semibold border border-amber-200"
              >
                {isHost ? "Host Center" : "Become a Host"}
              </button>

              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className={styles.mobileAuthButton}
                >
                  <FaSignOutAlt className="mr-3 text-base" />
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className={styles.mobileAuthButton}
                >
                  <FaUser className="mr-3 text-base" />
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;