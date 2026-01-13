import React from 'react';
import { navbarStyles as styles } from '../assets/dummyStyles.js';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { CalendarCheck, Car, Menu, PlusCircle, X, LogOut, User } from 'lucide-react';
import { useRef } from 'react';
import { useEffect } from 'react';
import { getAdminToken, getAdminUser, clearAdminSession } from '../utils/auth.js';

const navLinks = [
    { path: "/", icon: PlusCircle, label: "Add Car" },
    { path: "/manage-cars", icon: Car, label: "Manage Cars" },
    { path: "/bookings", icon: CalendarCheck, label: "Bookings" },
];

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Navbar = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // admin user info (optional display)
    const adminUser = getAdminUser();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
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

    const handleLogout = async () => {
      try {
        const token = getAdminToken();
        // call backend logout if available (optional)
        if (token) {
          try {
            await fetch(`${API_BASE}/api/auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              credentials: 'include'
            });
          } catch (e) {
            // ignore backend logout failure, proceed to clear client session
            console.warn('Backend logout call failed', e);
          }
        }
      } catch (err) {
        console.warn('Logout fetch error', err);
      } finally {
        clearAdminSession();
        navigate('/login');
      }
    };

    return (
        <div className={styles.navbar(scrolled)}>
            <div className={styles.navbarInner}>
                <div className={styles.navbarCenter}>
                    <div className={styles.navbarBackground(scrolled)}>
                        <div className={styles.contentContainer}>
                            <Link to="/" className={styles.logoLink}>
                                <div className={styles.logoContainer}>
                                    <img
                                        src={logo}
                                        alt="Logo"
                                        className={styles.logoImage}
                                        style={{
                                            objectFit: "contain",
                                        }}
                                    />
                                </div>
                            </Link>

                            <div className={styles.desktopNav}>
                                <div className={styles.navLinksContainer}>
                                    {navLinks.map((link, i) => {
                                        const Icon = link.icon;

                                        return (
                                            <React.Fragment key={link.path}>
                                                <Link to={link.path} className={styles.navLink}>
                                                    <Icon className=' w-4 h-4' />
                                                    <span>{link.label}</span>
                                                </Link>

                                                {i < navLinks.length - 1 && (
                                                    <div className={styles.navDivider} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* Right side actions: Company profile and Logout */}
                                <div className="flex items-center gap-3 ml-4">
                                  <Link to="/company" className="flex items-center gap-2 text-sm text-gray-200 hover:text-white">
                                    <User className="w-4 h-4" />
                                    <span>Company</span>
                                  </Link>

                                  <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                  </button>
                                </div>
                            </div>

                            <div className={styles.mobileMenuButton}>
                                <button
                                    ref={buttonRef}
                                    onClick={() => setIsOpen((v) => !v)}
                                    className={styles.menuButton}
                                    aria-label="Toggle Menu"
                                    aria-expanded={isOpen}
                                >
                                    {isOpen ? (
                                        <X className=' h-5 w-5' />
                                    ) : (
                                        <Menu className=' h-5 w-5' />
                                    )}
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
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={styles.mobileNavLink}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Icon className=' w-5 h-5' />
                                    <span>{link.label}</span>
                                </Link>
                            );
                        })}

                        {/* Divider */}
                        <div className="border-t border-gray-700 my-2" />

                        {/* Company link */}
                        <Link
                          to="/company"
                          className={styles.mobileNavLink}
                          onClick={() => setIsOpen(false)}
                        >
                          <User className=' w-5 h-5' />
                          <span>Company</span>
                        </Link>

                        {/* Logout entry in mobile menu */}
                        <button
                          onClick={() => { setIsOpen(false); handleLogout(); }}
                          className={styles.mobileNavLink}
                        >
                          <LogOut className=' w-5 h-5' />
                          <span>Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Navbar