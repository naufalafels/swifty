import React from 'react'
import Navbar from '../components/Navbar'
import HomeBanner from '../components/HomeBanner'
import HomeCars from '../components/HomeCars'

const Home = () => {
  return (
    <div>
        <Navbar />
        <HomeBanner />
        <HomeCars />
    </div>
  )
}

export default Home