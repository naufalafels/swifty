// src/components/Navbar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaTimes, FaUser, FaSignOutAlt, FaBell } from "react-icons/fa";
import logo from "../assets/swifty-logo.png";
import { navbarStyles as styles } from "../assets/dummyStyles.js";
import api from "../utils/api";
import * as authService from "../utils/authService";
import io from "socket.io-client";

const ME_ENDPOINT = "/api/auth/me";
const LOGOUT_ENDPOINT = "/api/auth/logout";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:7889` : "http://localhost:7889");

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [socket, setSocket] = useState(null);

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
    { to: "/profile", label: "Profile" },
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
      if (
        showNotif &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, showNotif]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
      if (e.key === "Escape" && showNotif) setShowNotif(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, showNotif]);

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

  const goHost = () => {
    if (!isLoggedIn) {
      navigate("/login", { replace: false, state: { from: "/host/dashboard" } });
    } else if (isHost) {
      navigate("/host/dashboard");
    } else {
      navigate("/host/onboard");
    }
  };

  // Notifications (message-driven) with dropdown
  useEffect(() => {
    const u = authService.getCurrentUser?.();
    if (!u) return;

    let mounted = true;

    // Seed from host history if host
    if (Array.isArray(u.roles) && u.roles.includes("host")) {
      api.get("/api/messages/host").then((res) => {
        if (mounted && Array.isArray(res.data)) {
          const seed = res.data.slice(-10).map((m) => ({
            type: "message",
            text: m.message,
            from: m.userEmail || m.userName || m.fromUserId,
            ts: m.timestamp || m.createdAt || new Date().toISOString(),
          }));
          setNotifItems(seed);
          setNotifCount(seed.length);
        }
      }).catch(() => {
        if (mounted) setNotifCount(0);
      });
    }

    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], withCredentials: true });
    setSocket(s);
    s.emit("joinUserRoom", u.id);
    s.on("privateMessage", (data) => {
      setNotifItems((prev) => {
        const next = [
          { type: "message", text: data.message, from: data.userEmail || data.userName || data.fromUserId, ts: data.timestamp || new Date().toISOString() },
          ...prev,
        ].slice(0, 10);
        return next;
      });
      setNotifCount((n) => n + 1);
    });

    return () => {
      mounted = false;
      s.disconnect();
    };
  }, []);

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

              <div className="flex items-center gap-3 relative">
                <button
                  onClick={() => setShowNotif((p) => !p)}
                  className="relative"
                  aria-label="Notifications"
                >
                  <FaBell className="text-lg text-gray-200" />
                  {notifCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </button>

                {showNotif && (
                  <div className="absolute right-0 top-10 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
                    <div className="p-3 border-b border-gray-800 text-sm text-white font-semibold">Notifications</div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-800">
                      {notifItems.length === 0 ? (
                        <div className="p-3 text-xs text-gray-400">No notifications yet.</div>
                      ) : (
                        notifItems.map((n, idx) => (
                          <div key={idx} className="p-3 text-xs text-gray-200">
                            <div className="font-semibold text-orange-200">{n.from || "Activity"}</div>
                            <div className="text-gray-300 line-clamp-2">{n.text}</div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              {new Date(n.ts).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={goHost}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition"
                >
                  {isHost ? "Host Centre" : "Become a Host"}
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
                {isHost ? "Host Centre" : "Become a Host"}
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