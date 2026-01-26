import React, { useEffect, useState } from 'react'
import { signupStyles } from '../assets/dummyStyles'
import { FaArrowLeft, FaCheck, FaEnvelope, FaEye, FaEyeSlash, FaLock, FaUser } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import logo from "../assets/swifty-logo.png"
import { ToastContainer, toast } from "react-toastify"
import api from '../utils/api'; // central axios instance
import * as authService from '../utils/authService';

const SignUp = () => {

    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsActive(true);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!acceptedTerms) {
            toast.error('Please Accept Terms & Conditions', { theme: 'dark' })
            return;
        }
        setLoading(true);

        try {
            // Respect cookie consent: if user declined, send without credentials (backend must honor this and return token in body)
            const consent = typeof window !== 'undefined' ? localStorage.getItem('cookie_consent') : null;
            const allowCookies = consent !== 'declined'; // default allow unless explicitly declined

            const res = await api.post('/api/auth/register', formData, {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: allowCookies, // per-request override
            });

            if (res.status >= 200 && res.status < 300) {
                const data = res.data || {};
                // if server returns an access token, set it in memory
                const token = data?.accessToken || data?.token || null;
                const user = data?.user || null;
                if (token) authService.setAccessToken(token);
                if (user) authService.setCurrentUser(user);

                toast.success('Account created successfully! Comfortable Journey Ahead!', {
                    position: "top-right",
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    theme: 'dark',
                    autoClose: 1200,
                    onClose: () => navigate('/login')
                });

                setLoading(false);
                return;
            }
            toast.error("Unexpected server response during registration.", {
                theme: 'dark'
            })
        }
        catch (err) {
            // Detailed axios error handling
            console.error("Signup error (frontend):", err);

            if (err.response) {
                // Server responded with a status outside 2xx
                console.log(
                    "Server response (debug):",
                    err.response.status,
                    err.response.data
                );
                const serverMessage =
                    err.response.data?.message ||
                    err.response.data?.error ||
                    `Server error: ${err.response.status}`;
                toast.error(serverMessage, { theme: "dark" });
            } else if (err.request) {
                // Request made but no response
                console.log("No response received (debug):", err.request);
                toast.error(
                    "No response from server — ensure backend is running and CORS is configured.",
                    {
                        theme: "dark",
                    }
                );
            } else {
                // Something else happened
                toast.error(err.message || "Registration failed", { theme: "dark" });
            }
        }

        finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className={signupStyles.pageContainer}>
            {/* Animated Background */}
            <div className={signupStyles.animatedBackground.base}>
                <div
                    className={`${signupStyles.animatedBackground.orb1} ${isActive
                        ? "translate-x-10 sm:translate-x-20 translate-y-5 sm:translate-y-10"
                        : ""
                        }`}
                ></div>
                <div
                    className={`${signupStyles.animatedBackground.orb2} ${isActive
                        ? "-translate-x-10 sm:-translate-x-20 -translate-y-5 sm:-translate-y-10"
                        : ""
                        }`}
                ></div>
                <div
                    className={`${signupStyles.animatedBackground.orb3} ${isActive
                        ? "-translate-x-5 sm:-translate-x-10 translate-y-10 sm:translate-y-20"
                        : ""
                        }`}
                ></div>
            </div>

            <a href="/" className={signupStyles.backButton}>
                <FaArrowLeft className=' text-xs sm:text-sm group-hover:-translate-x-1 transition-transform' />
                <span className='font-medium text-xs sm:text-sm'>Home</span>
            </a>

            <div
                className={`${signupStyles.signupCard.container} ${isActive ? "scale-100 opacity-100" : "scale-90 opacity-0"
                    }`}
            >
                <div
                    className={signupStyles.signupCard.card}
                    style={{
                        boxShadow: "0 15px 35px rgba(0,0,0,0.2)",
                        borderRadius: "24px"
                    }}
                >
                    <div className={signupStyles.signupCard.decor1} />
                    <div className={signupStyles.signupCard.decor2} />

                    <div className={signupStyles.signupCard.headerContainer}>
                        <div className={signupStyles.signupCard.logoContainer}>
                            <div className={signupStyles.signupCard.logoText}>
                                <img
                                    src={logo}
                                    alt="logo"
                                    className=' h-[1.2em] w-auto block object-contain'
                                    style={{
                                        display: "block",
                                    }}
                                />
                                <span className=' font-bold tracking-wider text-white mt-1'>
                                    swifty
                                </span>
                            </div>
                        </div>
                        <h1 className={signupStyles.signupCard.title}>Join Us Today!</h1>
                        <p className={signupStyles.signupCard.subtitle}>
                            Create your awesome account
                        </p>
                    </div>

                    {/* FORM */}
                    <form onSubmit={handleSubmit} className={signupStyles.form.container}>
                        <div className={signupStyles.form.inputContainer}>
                            <div className={signupStyles.form.inputWrapper}>
                                <div className={signupStyles.form.inputIcon}>
                                    <FaUser className=' text-sm sm:text-base' />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={signupStyles.form.input}
                                    placeholder='Full Name'
                                    required
                                    style={{ borderRadius: "16px" }}
                                />
                            </div>
                        </div>

                        <div className={signupStyles.form.inputContainer}>
                            <div className={signupStyles.form.inputWrapper}>
                                <div className={signupStyles.form.inputIcon}>
                                    <FaEnvelope className=' text-sm sm:text-base' />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={signupStyles.form.input}
                                    placeholder='Email Address'
                                    required
                                    style={{ borderRadius: "16px" }}
                                />
                            </div>
                        </div>

                        <div className={signupStyles.form.inputContainer}>
                            <div className={signupStyles.form.inputWrapper}>
                                <div className={signupStyles.form.inputIcon}>
                                    <FaLock className=' text-sm sm:text-base' />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={signupStyles.form.input}
                                    placeholder='Create Password'
                                    required
                                    style={{ borderRadius: "16px" }}
                                />

                                <div
                                    onClick={togglePasswordVisibility}
                                    className={signupStyles.form.passwordToggle}
                                >
                                    {showPassword ? (
                                        <FaEyeSlash className=' text-sm sm:text-base' />
                                    ) : (
                                        <FaEye className=' text-sm sm:text-base ' />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* TNC */}
                        <div className=' flex items-start mt-2 sm:mt-3 md:mt-4'>
                            <div className=' flex items-center h-5 mt-0.5 sm:mt-1'>
                                <input
                                    type="checkbox"
                                    id='terms'
                                    name='terms'
                                    checked={acceptedTerms}
                                    onChange={() => setAcceptedTerms(!acceptedTerms)}
                                    className={signupStyles.form.checkbox}
                                    required
                                    style={{ boxShadow: "none" }}
                                />
                            </div>

                            <div className=' ml-2 sm:ml-3 text-xs sm:text-sm'>
                                <label
                                    htmlFor="terms"
                                    className={signupStyles.form.checkboxLabel}
                                >
                                    I agree to the {" "}
                                    <span className={signupStyles.form.checkboxLink}>
                                        Terms & Conditions
                                    </span>
                                </label>
                            </div>
                        </div>

                        <button
                            style={{
                                borderRadius: "16px",
                                boxShadow: "0 5px 15px rgba(8,90,20,0.6)",
                            }}
                            type='submit'
                            disabled={loading}
                            className={signupStyles.form.submitButton}
                        >
                            <span className={signupStyles.form.buttonText}>
                                <FaCheck className='text-white text-sm sm:text-base md:text-lg' />
                                {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
                            </span>
                            <div className={signupStyles.form.buttonHover} />
                        </button>
                    </form>

                    <div
                        style={{
                            borderColor: "rgba(255,255,255,0.06)"
                        }}
                        className={signupStyles.signinSection}
                    >
                        <p className={signupStyles.signinText}>Already have an account?</p>
                        <a
                            href="/login"
                            className={signupStyles.signinButton}
                            style={{
                                borderRadius: "16px",
                                boxShadow: "0 2px 10px rgba(245, 124, 0, 0.08)",
                            }}
                        >
                            LOGIN TO YOUR ACCOUNT
                        </a>
                    </div>
                </div>
            </div>

            <ToastContainer
                position="top-right"
                autoClose={1000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                toastStyle={{
                    backgroundColor: "#fb923c",
                    color: "#ffffff",
                    borderRadius: "16px",
                    boxShadow: "0 4px 20px rgba(245,124,0,0.18)",
                    fontFamily: "'Montserrat', sans-serif",
                }}
            />

            {/* Font Import */}
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Montserrat', sans-serif; }
            `}
            </style>
        </div>
    )
}

export default SignUp