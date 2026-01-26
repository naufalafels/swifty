import mongoose from "mongoose";
const { Schema } = mongoose;

const addressSchema = new Schema({
  street: String,
  city: String,
  state: String,
  zipCode: String
}, { _id: false, default: {} });

const paymentBreakdownSchema = new Schema({
  rent: { type: Number, default: 0 },
  insurance: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 }
}, { _id: false });

const kycSchema = new Schema({
  idType: { type: String, enum: ["passport", "nric", "other"], default: "passport" },
  idNumber: { type: String, default: "" },
  idCountry: { type: String, default: "" },
  licenseReminderSent: { type: Boolean, default: false },
  licenseNote: { type: String, default: "Please bring your valid driving license (domestic or international per Malaysian law)." }
}, { _id: false });

// Denormalized car snapshot schema includes company fields so Mongoose won't strip them
const carSummarySchema = new Schema({
  id: { type: Schema.Types.ObjectId, ref: 'Car', required: true },
  make: String,
  model: String,
  year: Number,
  dailyRate: Number,
  image: String,
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
  status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled', 'upcoming'], default: 'pending' },

  amount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'refund_failed'], default: 'pending' },
  paymentGateway: { type: String, enum: ['razorpay'], default: 'razorpay' },
  currency: { type: String, default: 'MYR' },
  paymentBreakdown: { type: paymentBreakdownSchema, default: () => ({}) },
  kyc: { type: kycSchema, default: () => ({}) },

  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  razorpaySignature: { type: String, default: "" },
  refundId: { type: String, default: "" }, // new: track refund identifier

  // small audit / idempotency trail for webhook processing (store event ids or short markers)
  processedWebhookEvents: { type: [String], default: [] },

  sessionId: String, // legacy stripe field (unused)
  paymentIntentId: String, // legacy stripe field (unused)

  address: { type: addressSchema, default: () => ({}) },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  stripeSession: { type: Schema.Types.Mixed, default: {} } // legacy field (unused)
}, { timestamps: true });

bookingSchema.index({ companyId: 1 });

// RECOMMENDATION (one-time migration/manual):
// It is advisable to create a sparse unique index on razorpayPaymentId to prevent two bookings sharing a payment id.
// Run once as a migration or manual DB operation (don't create on every app start in production without migration):
// await mongoose.connection.collection('bookings').createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);