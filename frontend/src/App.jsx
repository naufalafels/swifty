import React, { useEffect, useState } from 'react';
import { Route, Routes, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './components/Signup';
import ContactPage from './pages/ContactPage';
import CarsPage from './pages/CarsPage';
import CarDetailPage from './pages/CarDetailPage';
import { FaArrowUp } from 'react-icons/fa';
import VerifyPaymentPage from './pages/VerifyPaymentPage';
import MyBookingsPage from './pages/MyBookingsPage';
import KycPage from './pages/KycPage';
import HostOnboardPage from './pages/HostOnboardPage';
import HostDashboard from './pages/HostDashboard';
import HostAddCars from './pages/HostAddCars';
import ProfilePage from './pages/ProfilePage';
import ProfileSecurityPage from './pages/ProfileSecurityPage';
import ProfilePrivacyPage from './pages/ProfilePrivacyPage';
import PaymentResultPage from './pages/PaymentResultPage';
import * as authService from './utils/authService';
import CookieConsent from './components/CookieConsent';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Branded loading spinner for auth checks
const AuthLoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
    <p className="text-sm text-slate-400 tracking-wide">Verifying your session…</p>
  </div>
);

// PROTECTED ROUTE that supports async token refresh on page load
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const authed = await authService.ensureAuth();
      if (mounted) {
        setOk(!!authed);
        setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking) {
    return <AuthLoadingScreen />;
  }
  if (!ok) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

const RedirectIfAuthenticated = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await authService.ensureAuth();
      if (mounted) {
        setAuthed(!!ok);
        setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking) return null;
  if (authed) return <Navigate to='/' replace />;
  return children;
};

const App = () => {
  const [showButton, setShowButton] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setShowButton(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/contact' element={<ContactPage />} />
        <Route path='/cars' element={<CarsPage />} />
        <Route path='/cars/:id' element={<CarDetailPage />} />
        <Route
          path='/bookings'
          element={
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />

        <Route path='/login'
          element={
            <RedirectIfAuthenticated>
              <Login />
            </RedirectIfAuthenticated>
          }
        />
        <Route path='/signup'
          element={
            <RedirectIfAuthenticated>
              <SignUp />
            </RedirectIfAuthenticated>
          }
        />

        {/* Renter KYC */}
        <Route path='/kyc'
          element={
            <ProtectedRoute>
              <KycPage />
            </ProtectedRoute>
          }
        />

        {/* Host onboarding (legacy) */}
        <Route path='/host/onboard'
          element={
            <ProtectedRoute>
              <HostOnboardPage />
            </ProtectedRoute>
          }
        />

        {/* Host add-cars (dedicated flow) */}
        <Route path='/host/add-cars'
          element={
            <ProtectedRoute>
              <HostAddCars />
            </ProtectedRoute>
          }
        />

        {/* Host dashboard */}
        <Route path='/host/dashboard'
          element={
            <ProtectedRoute>
              <HostDashboard />
            </ProtectedRoute>
          }
        />

        {/* Profile */}
        <Route path='/profile'
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path='/profile/security'
          element={
            <ProtectedRoute>
              <ProfileSecurityPage />
            </ProtectedRoute>
          }
        />
        <Route path='/profile/privacy'
          element={
            <ProtectedRoute>
              <ProfilePrivacyPage />
            </ProtectedRoute>
          }
        />

        <Route path='/verify-payment' element={<VerifyPaymentPage />} />

        {/* Payment result pages */}
        <Route path='/success' element={<PaymentResultPage />} />
        <Route path='/cancel' element={<PaymentResultPage />} />

        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>

      {/* FIX: Scroll-to-top — brand color, z-index, proper touch target (min 44x44), smooth transition */}
      <button
        onClick={scrollUp}
        aria-label="Scroll to top"
        className={`fixed bottom-5 right-5 z-50 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white p-3.5 rounded-full shadow-lg shadow-orange-500/30 transition-all duration-300 ${
          showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <FaArrowUp className="w-4 h-4" />
      </button>

      {/* Add ToastContainer for global toasts */}
      <ToastContainer />

      {/* Cookie consent banner */}
      <CookieConsent />
    </>
  );
};

export default App;