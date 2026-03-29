import React, { useEffect, useState } from 'react'
import { loginStyles } from '../assets/dummyStyles'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaEye, FaEyeSlash, FaLock, FaUser } from 'react-icons/fa'
import logo from '../assets/vroomoo.png'
import { toast, ToastContainer } from 'react-toastify'
import * as authService from '../utils/authService'
import { GoogleLogin } from '@react-oauth/google'

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
      const data = await authService.login(credentials);
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

      if (err?.response?.status === 429) {
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

  // Google Sign-In handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const data = await authService.googleSignIn(credentialResponse.credential);
      const msg = data?.message || 'Signed in with Google!';
      toast.success(msg, {
        theme: 'colored',
        autoClose: 1000,
        onClose: () => navigate('/', { replace: true }),
      });
    } catch (err) {
      console.error('Google sign-in error:', err);
      const msg = err?.response?.data?.message || 'Google sign-in failed';
      toast.error(msg, { theme: 'colored' });
    } finally {
      setLoading(false);
    }
  };

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

          {/* ── Google Sign-In (inline styles — no Tailwind conflict) ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '16px',
            marginBottom: '8px',
            gap: '12px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '0 8px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(251,146,60,0.25)' }} />
              <span style={{
                fontSize: '11px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(251,146,60,0.25)' }} />
            </div>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google sign-in was cancelled', { theme: 'colored' })}
              theme="outline"
              shape="pill"
              size="large"
              text="signin_with"
              width="280"
            />
          </div>

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