import React, { useEffect, useState } from 'react'
import { loginStyles } from '../assets/dummyStyles'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaEye, FaEyeSlash, FaLock, FaUser } from 'react-icons/fa'
import logo from '../assets/swifty-logo.png'
import { toast, ToastContainer } from 'react-toastify'
import * as authService from '../utils/authService'

const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsActive(true);
  }, []);

  const handleChange = (e) => {
    setCredentials((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use authService which keeps token in memory and attempts to use cookie-based refresh if backend sets refresh cookie
      const data = await authService.login(credentials);
      // login returns server payload; authService already stored access token (in memory) and user
      const msg = data?.message || 'Login Successful! Welcome back';
      toast.success(msg, {
        position: 'top-right',
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
        onClose: () => {
          const redirectPath = '/';
          navigate(redirectPath, { replace: true });
        },
        autoClose: 1000,
      });
    }

    catch (err) {
      console.error("Login error (frontend):", err);

      // Handle rate limit (429) with improved UX
      if (err?.response?.status === 429) {
        // Try to extract Retry-After header (seconds) to show more actionable message
        const retryAfterHeader = err.response?.headers?.['retry-after'];
        let waitInfo = '';
        if (retryAfterHeader) {
          const secs = Number(retryAfterHeader);
          if (!Number.isNaN(secs) && secs > 0) {
            waitInfo = ` Try again in ${Math.ceil(secs / 60)} minute(s).`;
          }
        }
        const serverMessage =
          err.response.data?.message ||
          `Too many login attempts. Please try again later.${waitInfo}`;
        // Persistent, prominent toast for rate-limits
        toast.error(serverMessage, { theme: "colored", autoClose: 8000 });
      } else if (err.response) {
        const serverMessage =
          err.response.data?.message ||
          err.response.data?.error ||
          `Server error: ${err.response.status}`;
        toast.error(serverMessage, { theme: "colored" });
      } else if (err.request) {
        toast.error("No response from server — is backend running?", {
          theme: "colored",
        });
      } else {
        toast.error(err.message || "Login failed", { theme: "colored" });
      }
    }
    finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className={loginStyles.pageContainer}>
      {/* Animated Dark Background */}
      <div className={loginStyles.animatedBackground.base}>
        <div className={`${loginStyles.animatedBackground.orb1} ${isActive ? 'translate-x-20 translate-y-10' : ''}`} />
        <div className={`${loginStyles.animatedBackground.orb2} ${isActive ? '-translate-x-20 -translate-y-10' : ''}`} />
        <div className={`${loginStyles.animatedBackground.orb3} ${isActive ? '-translate-x-10 translate-y-20' : ''}`} />
      </div>

      <a href="/" className={loginStyles.backButton}>
        <FaArrowLeft className=' text-sm sm:text-base' />
        <span className=' font-medium text-xs sm:text-sm'> Home </span>
      </a>

      {/* LOGIN CARD */}
      <div
        className={`${loginStyles.loginCard.container} ${isActive ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
      >
        <div className={loginStyles.loginCard.card}>
          <div className={loginStyles.loginCard.decor1} />
          <div className={loginStyles.loginCard.decor2} />

          {/* HEADER */}
          <div className={loginStyles.loginCard.headerContainer}>
            <div className={loginStyles.loginCard.logoContainer}>
              <div className={loginStyles.loginCard.logoText}>
                <img
                  src={logo}
                  alt="logo"
                  className=' h-[1em] w-auto block'
                  style={{
                    display: "block",
                    objectFit: "contain",
                  }}
                />
                <span className=' font-bold tracking-wider'>swifty</span>
              </div>
            </div>

            <h1 className={loginStyles.loginCard.title}>Driving Comfort</h1>
            <p className={loginStyles.loginCard.subtitle}>
              EFFICIENT MOBILITY EXPERIENCE
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className={loginStyles.form.container}>
            <div className={loginStyles.form.inputContainer}>
              <div className={loginStyles.form.inputWrapper}>
                <div className={loginStyles.form.inputIcon}>
                  <FaUser />
                </div>
                <input
                  type="email"
                  name='email'
                  value={credentials.email}
                  onChange={handleChange}
                  placeholder='Enter your email'
                  required
                  className={loginStyles.form.input}
                />
              </div>
            </div>

            <div className={loginStyles.form.inputContainer}>
              <div className={loginStyles.form.inputWrapper}>
                <div className={loginStyles.form.inputIcon}>
                  <FaLock />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name='password'
                  value={credentials.password}
                  onChange={handleChange}
                  placeholder='Enter your password'
                  required
                  className={loginStyles.form.input}
                />
                <div onClick={togglePasswordVisibility} className={loginStyles.form.passwordToggle}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>
            </div>

            <button type='submit' disabled={loading} className={loginStyles.form.submitButton}>
              <span className={loginStyles.form.buttonText}>
                {loading ? 'Logging in...' : 'YOU ARE ON YOUR WAY!'}
              </span>
              <div className={loginStyles.form.buttonHover} />
            </button>
          </form>

          <div className={loginStyles.signupSection}>
            <p className={loginStyles.signupText}>Don't have an account?</p>
            <a href="/signup" className={loginStyles.signupButton}>
              CREATE ACCOUNT
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
        theme="colored"
        toastStyle={{
          backgroundColor: '#fb923c',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(249, 115, 22, 0.25)'
        }}
      />
    </div>
  )
}

export default Login