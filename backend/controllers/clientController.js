import Car from '../models/carModel.js';

export const getClientCars = async (req, res) => {
  try {
    // Use location from query params, or default to KL
    const userLat = req.query.lat ? parseFloat(req.query.lat) : 3.1390;
    const userLng = req.query.lng ? parseFloat(req.query.lng) : 101.6869;

    const cars = await Car.find({ status: 'available' })
      .populate({ path: 'companyId', select: 'hostProfile' })
      .limit(req.query.limit ? parseInt(req.query.limit) : 10)
      .lean();

    const carsWithDetails = cars.map(car => {
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
        companyName: car.companyId?.hostProfile?.companyName || 'Unknown Company',
        distance: distance ? `${distance} km away` : 'Distance unknown',
      };
    });

    // Sort by distance for nearest/cheapest (optional, based on Cars.jsx logic)
    carsWithDetails.sort((a, b) => {
      const aDist = parseFloat(a.distance) || Infinity;
      const bDist = parseFloat(b.distance) || Infinity;
      return aDist - bDist;
    });

    return res.json({ success: true, data: carsWithDetails });
  } catch (err) {
    console.error('getClientCars error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};