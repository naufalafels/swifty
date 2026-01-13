import mongoose from "mongoose";
const { Schema } = mongoose;

const bookingSubSchema = new Schema({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  pickupDate: Date,
  returnDate: Date,
  status: { type: String, enum: ['pending','active','completed','cancelled','upcoming'], default: 'pending' }
}, { _id: false });

const carSchema = new Schema({
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: Number,
  color: String,
  category: String,
  seats: Number,
  transmission: String,
  fuelType: String,
  mileage: Number,
  dailyRate: { type: Number, required: true },
  status: { type: String, enum: ['available','rented','maintenance'], default: 'available' },
  image: String,

  // Multi-tenant: which company owns this car
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  // optional pickup location
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },

  bookings: { type: [bookingSubSchema], default: [] }
}, { timestamps: true });

carSchema.index({ location: '2dsphere' });
carSchema.index({ companyId: 1 });

export default mongoose.models.Car || mongoose.model('Car', carSchema);