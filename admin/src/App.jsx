import React from 'react'
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx'
import AddCar from './components/AddCar.jsx'
import ManageCar from './components/ManageCar.jsx';
import Booking from './components/Booking.jsx';

const App = () => {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path='/' element={<AddCar />} />
        <Route path='/manage-cars' element={<ManageCar />} />
        <Route path='/bookings' element={<Booking />} />
      </Routes>
    </>
  )
}

export default App