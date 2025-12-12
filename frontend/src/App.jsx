import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './components/Signup';
import ContactPage from './pages/ContactPage';

const App = () => {
  return (
   <>
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/login' element={<Login />} />
      <Route path='/signup' element={<SignUp />} />
      <Route path='/contact' element={<ContactPage />} />
    </Routes>
   </>
  )
}

export default App