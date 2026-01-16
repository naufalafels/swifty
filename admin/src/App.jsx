import React from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx'
import AddCar from './components/AddCar.jsx'
import ManageCar from './components/ManageCar.jsx';
import Booking from './components/Booking.jsx';
import AuthPage from './pages/Auth.jsx';
import CompanyProfile from './pages/CompanyProfile.jsx';
import { useState, useEffect } from 'react';
import { ensureAuth, getAdminToken } from './utils/auth.js';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const authed = await ensureAuth();
      if (mounted) {
        setOk(!!authed);
        setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-white">Checking authentication...</div>;
  if (!ok) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

const App = () => {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <>
      {/* Hide Navbar on auth pages */}
      {!isAuthRoute && <Navbar />}

      <Routes>
        <Route path='/login' element={<AuthPage mode="login" />} />
        <Route path='/signup' element={<AuthPage mode="signup" />} />

        <Route path='/' element={<ProtectedRoute><AddCar /></ProtectedRoute>} />
        <Route path='/manage-cars' element={<ProtectedRoute><ManageCar /></ProtectedRoute>} />
        <Route path='/bookings' element={<ProtectedRoute><Booking /></ProtectedRoute>} />

        <Route path='/company' element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />

        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </>
  )
}

export default App