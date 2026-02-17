import Car from '../models/carModel.js';
import User from '../models/userModel.js';

export const getClientCars = async (req, res) => {
  try {
    const userLat = req.query.lat ? parseFloat(req.query.lat) : 3.1390;
    const userLng = req.query.lng ? parseFloat(req.query.lng) : 101.6869;

    // Show all cars except those under maintenance — rented/booked cars should
    // still be visible so other users can make advance bookings for future dates.
    const cars = await Car.find({ status: { $ne: 'maintenance' } })
      .populate({ path: 'companyId', select: 'hostProfile name' })  // Populate from User, select hostProfile and name
      .limit(req.query.limit ? parseInt(req.query.limit) : 10)
      .lean();

    // Attach booking-aware availability so the frontend can show accurate badges
    let carsWithAvailability = cars;
    if (cars.length && typeof Car.computeAvailabilityForCars === 'function') {
      try {
        carsWithAvailability = await Car.computeAvailabilityForCars(cars);
      } catch (err) {
        console.warn('computeAvailabilityForCars failed in clientController:', err);
        carsWithAvailability = cars;
      }
    }

    const carsWithDetails = await Promise.all(carsWithAvailability.map(async (car) => {  // MAKE ASYNC
        let companyName = car.companyName || 'Unknown Company';
        if (car.companyId?.name) {
        companyName = car.companyId.name;  // Prioritize the populated User name if available
    }

      const carLat = car.location?.coordinates[1];
      const carLng = car.location?.coordinates[0];
      let distance = null;
      if (carLat !== undefined && carLng !== undefined) {
        const R = 6371;
        const dLat = (carLat - userLat) * Math.PI / 180;
        const dLng = (carLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(carLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = (R * c).toFixed(1);
      }

      return {
        ...car,
        companyName,
        distance: distance ? `${distance} km away` : 'Distance unknown',
      };
    }));

    return res.json({ success: true, data: carsWithDetails });
  } catch (err) {
    console.error('getClientCars error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};