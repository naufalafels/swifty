import React from 'react'
import { footerStyles as styles } from '../assets/dummyStyles'
import { Link } from 'react-router-dom'
import logo from '../assets/swifty-logo.png'
import { FaPhone, FaEnvelope, FaFacebookF, FaInstagram, FaLinkedinIn, FaMapMarkedAlt, FaTwitter, FaYoutube } from 'react-icons/fa'
import { GiCarKey } from 'react-icons/gi'

const Footer = () => {
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

                {/* QUICK LINKS — FIX: use <Link> instead of <a href> for SPA routing */}
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
                        {/* FIX: was styles.contactList on <li>, should be styles.contactItem */}
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

                {/* NEWSLETTER */}
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