import React from 'react'
import { carPageStyles } from '../assets/dummyStyles'
import carsData from '../assets/CarsData'
import { FaArrowRight, FaGasPump, FaHandsHelping, FaTachometerAlt, FaUserFriends } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'

const Cars = () => {

    const navigate = useNavigate();

  return (
    <div className={carPageStyles.pageContainer}>
        {/* MAIN CONTENT */}
        <div className={carPageStyles.contentContainer}>
            <div className={carPageStyles.headerContainer}>
                <div className={carPageStyles.headerDecoration} />
                <h1 className={carPageStyles.title}>Economy Car Collection</h1>
                <p className={carPageStyles.subtitle}>
                    Discover our exclusive financially friendly rides. Each cars is maintained to the tee for a comfortable journey.
                </p>
            </div>

            <div className={carPageStyles.gridContainer}>
                {carsData.map((car) => (
                    <div key={car.id} className={carPageStyles.carCard}>
                        <div className={carPageStyles.glowEffect} />

                        <div className={carPageStyles.imageContainer}>
                            <div className='absolute inset-0 z-10' />
                            <img 
                                src={car.image} 
                                alt={car.name}
                                className={carPageStyles.carImage}
                            />
                            <div className={carPageStyles.priceBadge}>AUD{car.price}/day</div>
                        </div>

                        <div className={carPageStyles.cardContent}>
                            <div className={carPageStyles.headerRow}>
                                <div>
                                    <h3 className={carPageStyles.carName}>{car.name}</h3>
                                    <p className={carPageStyles.carType}>{car.type}</p>
                                </div>
                            </div>

                            <div className={carPageStyles.specsGrid}>
                                <div className={carPageStyles.specItem}>
                                    <div className={carPageStyles.specIconContainer}>
                                        <FaUserFriends className='text-sky-400' />
                                    </div>
                                    <span>{car.seats} Seats</span>
                                </div>

                                <div className={carPageStyles.specItem}>
                                    <div className={carPageStyles.specIconContainer}>
                                        <FaGasPump className='text-amber-400' />
                                    </div>
                                    <span>{car.fuel}</span>
                                </div>

                                <div className={carPageStyles.specItem}>
                                    <div className={carPageStyles.specIconContainer}>
                                        <FaTachometerAlt className='text-emerald-400' />
                                    </div>
                                    <span>{car.milage}</span>
                                </div>

                                <div className={carPageStyles.specItem}>
                                    <div className={carPageStyles.specIconContainer}>
                                        <FaHandsHelping className='text-purple-400' />
                                    </div>
                                    <span>{car.perks}</span>
                                </div>
                            </div>

                            <button
                                onClick={() =>
                                    navigate(`/cars/${car.id}`, {state: { car } })
                                }
                                className={carPageStyles.bookButton}
                            >
                                <span className={carPageStyles.buttonText}>Book Now</span>
                                <FaArrowRight className={carPageStyles.buttonIcon} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className={carPageStyles.decor1} />
            <div className={carPageStyles.decor2} />
        </div>
    </div>
  )
}

export default Cars