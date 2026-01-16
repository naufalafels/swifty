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
import * as authService from './utils/authService';

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
    return <div className="min-h-screen flex items-center justify-center text-white">Checking authentication...</div>;
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

  // SHOW HIDE BUTTON ON SCROLL
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

        <Route
          path='/cars/:id'
          element={
            <ProtectedRoute>
              <CarDetailPage />
            </ProtectedRoute>
          }
        />

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

        <Route path='/success' element={<VerifyPaymentPage />} />
        <Route path='/cancel' element={<VerifyPaymentPage />} />

        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>

      {showButton && (
        <button
          onClick={scrollUp}
          className=' fixed cursor-pointer bottom-8 right-8 p-3 rounded-full bg-gradient-to-r from-orange-600 to-orange-700
        text-white shadow-lg transition-colors focus:outline-none'
          aria-label='Scroll to top'
        >
          <FaArrowUp size={20} />
        </button>
      )}
    </>
  )
}

export default App