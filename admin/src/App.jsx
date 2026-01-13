import React from 'react'
import { Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx'
import AddCar from './components/AddCar.jsx'
import ManageCar from './components/ManageCar.jsx';
import Booking from './components/Booking.jsx';
import AuthPage from './pages/Auth.jsx';
import { getAdminToken } from './utils/auth.js';

const ProtectedRoute = ({ children }) => {
  const token = getAdminToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path='/login' element={<AuthPage mode="login" />} />
        <Route path='/signup' element={<AuthPage mode="signup" />} />

        <Route path='/' element={<ProtectedRoute><AddCar /></ProtectedRoute>} />
        <Route path='/manage-cars' element={<ProtectedRoute><ManageCar /></ProtectedRoute>} />
        <Route path='/bookings' element={<ProtectedRoute><Booking /></ProtectedRoute>} />

        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </>
  )
}

export default App