import React from 'react';
import { navbarStyles as styles } from '../assets/dummyStyles.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { CalendarCheck, Car, Menu, PlusCircle, X } from 'lucide-react';
import { useRef } from 'react';
import { useEffect } from 'react';

const navLinks = [
    { path: "/", icon: PlusCircle, label: "Add Car" },
    { path: "/manage-cars", icon: Car, label: "Manage Cars" },
    { path: "/bookings", icon: CalendarCheck, label: "Bookings" },
];


const Navbar = () => {

    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

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
                    </div>
                </div>
            )}
        </div>
    )
}

export default Navbar