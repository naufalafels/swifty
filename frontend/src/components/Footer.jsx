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
                                alt="logo"
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
                            <a href="#" key={i} className={styles.socialIcon}>
                                <Icon />
                            </a>
                        ))}
                    </div>
                </div>

                {/* QUICK LINKS */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        Quick Links
                        <span className={styles.underline} />
                    </h3>
                    <ul className={styles.linkList}>
                        {['Home', 'Cars', 'Contact Us'].map((link, i) => (
                            <li key={i}>
                                <a 
                                    href={link === 'Home' ? '/' : link === 'Contact Us' ? '/contact' : '/cars'}
                                    className={styles.linkItem}
                                >
                                    {link}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CONTACT */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        Contact Us
                        <span className={styles.underline} />
                    </h3>

                    <ul className={styles.contactList}>
                        <li className={styles.contactList}>
                            <FaMapMarkedAlt className={styles.contactIcon} />
                            <span>Clarence Street, Merrylands, NSW 2160</span>
                        </li>
                    
                        <li className={styles.contactItem}>
                            <FaPhone className={styles.contactIcon} />
                            <span>+61 481 152 728</span>
                        </li>

                        <li className={styles.contactItem}>
                            <FaEnvelope className={styles.contactIcon} />
                            <span>Admin@imanglobal.com.au</span>
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

                    <form className=' space-y-3'>
                        <input 
                            type="email" 
                            placeholder='Your Email Address'
                            className={styles.input}
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
                <p>&copy; Swifty 2021. All Rights Reserved.</p>
                <p className=' mt-3 md:mt-0'>
                    Designed by{" "}
                    <a 
                        href="/"
                        target='_blank'
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