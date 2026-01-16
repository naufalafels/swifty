import React from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx'
import AddCar from './components/AddCar.jsx'
import ManageCar from './components/ManageCar.jsx';
import Booking from './components/Booking.jsx';
import AuthPage from './pages/Auth.jsx';
import CompanyProfile from './pages/CompanyProfile.jsx';
import { getAdminToken } from './utils/auth.js';

const ProtectedRoute = ({ children }) => {
  const token = getAdminToken();
  if (!token) return <Navigate to="/login" replace />;
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