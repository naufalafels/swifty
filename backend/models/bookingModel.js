import mongoose from "mongoose";
const { Schema } = mongoose;

const addressSchema = new Schema({
  street: String, city: String, state: String, zipCode: String
}, { _id: false, default: {} });

// Denormalized car snapshot schema includes company fields so Mongoose won't strip them
const carSummarySchema = new Schema({
  id: { type: Schema.Types.ObjectId, ref: 'Car', required: true },
  make: String,
  model: String,
  year: Number,
  dailyRate: Number,
  image: String,

  // Multi-tenant: which company owns this car
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
}, { _id: false });

const bookingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  car: { type: carSummarySchema, required: true },
  carImage: String,
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  bookingDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending','active','completed','cancelled','upcoming'], default: 'pending' },
  amount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending','paid'], default: 'pending' },
  sessionId: String,
  paymentIntentId: String,
  address: { type: addressSchema, default: () => ({}) },

  // Denormalized: which company the booking belongs to (used by admin filters)
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  stripeSession: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

bookingSchema.index({ companyId: 1 });
export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);