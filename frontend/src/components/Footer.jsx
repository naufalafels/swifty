import React from 'react'
import { footerStyles as styles } from '../assets/dummyStyles'
import { Link } from 'react-router-dom'
import logo from '../assets/swifty-logo.png'
import { FaPhone, FaEnvelope, FaFacebookF, FaInstagram, FaLinkedinIn, FaMapMarkedAlt, FaTwitter, FaYoutube, FaCar } from 'react-icons/fa'
import { GiCarKey } from 'react-icons/gi'
import * as authService from '../utils/authService'

const Footer = () => {
  // Check if user is logged in and is a host
  const user = authService.getCurrentUser?.();
  const isHost = Array.isArray(user?.roles) && user.roles.includes('host');

  return (
    <footer className={styles.container}>
        <div className={styles.topElements}>
            <div className={styles.circle1} />
            <div className={styles.circle2} />
            <div className={styles.roadLine} />
        </div>

        <div className={styles.innerContainer}>
            <div className={styles.grid}>
                <div className={styles.brandSection}>
                    <Link to="/" className=' flex items-center'>
                        <div className={styles.logoContainer}>
                            <img 
                                src={logo} 
                                alt="Swifty Car Rental logo"
                                className='h-[1em] w-auto block'
                                style={{
                                    display: "block",
                                    objectFit: "contain",
                                }}
                            />
                            <span className={styles.logoText}>swifty</span>
                        </div>
                    </Link>
                    <p className={styles.description}>
                        The ultimate fuel-saving car rental service because we care for your comfort to reach your destination.
                    </p>

                    <div className={styles.socialIcons}>
                        {[
                            FaFacebookF, 
                            FaTwitter, 
                            FaInstagram, 
                            FaLinkedinIn, 
                            FaYoutube
                        ].map((Icon, i) => (
                            <a href="#" key={i} className={styles.socialIcon} aria-label={`Social link ${i + 1}`}>
                                <Icon />
                            </a>
                        ))}
                    </div>
                </div>

                {/* QUICK LINKS — expanded with more routes */}
                <nav aria-label="Quick links">
                    <h3 className={styles.sectionTitle}>
                        Quick Links
                        <span className={styles.underline} />
                    </h3>
                    <ul className={styles.linkList}>
                        {[
                            { label: 'Home', to: '/' },
                            { label: 'Cars', to: '/cars' },
                            { label: 'Contact Us', to: '/contact' },
                            { label: 'My Bookings', to: '/bookings' },
                            { label: 'My Profile', to: '/profile' },
                        ].map((link, i) => (
                            <li key={i}>
                                <Link
                                    to={link.to}
                                    className={styles.linkItem}
                                >
                                    <span className={styles.bullet} />
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* CONTACT */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        Contact Us
                        <span className={styles.underline} />
                    </h3>

                    <ul className={styles.contactList}>
                        <li className={styles.contactItem}>
                            <FaMapMarkedAlt className={styles.contactIcon} />
                            <span>Bayan Baru, 11950, Pulau Pinang, Malaysia </span>
                        </li>
                    
                        <li className={styles.contactItem}>
                            <FaPhone className={styles.contactIcon} />
                            <span>+61 481 152 728</span>
                        </li>

                        <li className={styles.contactItem}>
                            <FaEnvelope className={styles.contactIcon} />
                            <span>admin@swifty.com</span>
                        </li>
                    </ul>
                
                    <div className={styles.hoursContainer}>
                        <h4 className={styles.hoursTitle}>Business Hours</h4>
                        <div className={styles.hoursText}>
                            <p>Mon - Fri: 8:00 AM - 8:00 PM</p>
                            <p>Sat: 9:00 AM - 6:00 PM</p>
                            <p>Sun & Holidays: 10:00 AM - 4:00 PM</p>
                        </div>
                    </div>
                </div>

                {/* NEWSLETTER + BECOME A HOST / HOST CENTRE */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        Newsletter
                        <span className={styles.underline} />
                    </h3>
                    <p className={styles.newsletterText}>
                        Subscribe for special offers and updates
                    </p>

                    <form className=' space-y-3' onSubmit={(e) => e.preventDefault()}>
                        <input 
                            type="email" 
                            placeholder='Your Email Address'
                            className={styles.input}
                            aria-label="Email address for newsletter"
                        />

                        <button type='submit' className={styles.subscribeButton}>
                            <GiCarKey className="mr-2 text-lg sm:text-xl"/>
                            Subscribe Now
                        </button>
                    </form>

                    {/* Dynamic: "Host Centre" (blue) if host, "Become a Host" (blue) if not */}
                    <Link
                        to={isHost ? "/host/dashboard" : "/host/onboard"}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base border border-sky-500 hover:border-sky-600"
                    >
                        <FaCar className="text-lg" />
                        {isHost ? "Host Centre" : "Become a Host"}
                    </Link>
                </div>
            </div>

            {/* BOTTOM COPYRIGHT */}
            <div className={styles.copyright}>
                <p>&copy; {new Date().getFullYear()} Swifty. All Rights Reserved.</p>
                <p className=' mt-3 md:mt-0'>
                    Designed by{" "}
                    <a 
                        href="/"
                        target='_blank'
                        rel="noopener noreferrer"
                        className={styles.designerLink}
                    >
                        Naufalafels Software Services
                    </a>
                </p>
            </div>
        </div>
    </footer>
  )
}

export default Footer