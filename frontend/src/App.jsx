import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './components/Signup';
import ContactPage from './pages/ContactPage';
import CarsPage from './pages/CarsPage';

const App = () => {
  return (
   <>
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/login' element={<Login />} />
      <Route path='/signup' element={<SignUp />} />
      <Route path='/contact' element={<ContactPage />} />
      <Route path='/cars' element={<CarsPage />} />
    </Routes>
   </>
  )
}

export default App