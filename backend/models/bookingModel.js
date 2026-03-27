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
  insurancePlan: { type: String, default: "full_excess" },
  deposit: { type: Number, default: 0 }
}, { _id: false });

const kycSchema = new Schema({
  idType: { type: String, enum: ["passport", "nric", "other"], default: "passport" },
  idNumber: { type: String, default: "" },
  idCountry: { type: String, default: "" },
  licenseReminderSent: { type: Boolean, default: false },
  licenseNote: { type: String, default: "Please bring your valid driving license (domestic or international per Malaysian law)." },
  frontImageUrl: { type: String, default: "" },
  backImageUrl: { type: String, default: "" },
}, { _id: false });

// Denormalized car snapshot schema includes company fields so Mongoose won't strip them
const carSummarySchema = new Schema({
  id: { type: Schema.Types.ObjectId, ref: 'Car', required: true },
  make: String,
  model: String,
  year: Number,
  dailyRate: Number,
  image: String,
  category: String,
  color: String,
  seats: Number,
  transmission: String,
  fuelType: String,
  plateNumber: String,
  deposit: Number,
  mileage: Number,
  description: String,
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
  status: { type: String, enum: ['awaiting_payment', 'pending', 'active', 'completed', 'cancelled', 'upcoming'], default: 'awaiting_payment' },

  // Marketing consent: user explicitly opted-in to receive marketing from host
  marketingConsent: { type: Boolean, default: false },

  amount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'expired', 'refund_failed'], default: 'pending' },
  paymentGateway: { type: String, enum: ['xendit'], default: 'xendit' },
  currency: { type: String, default: 'MYR' },
  paymentBreakdown: { type: paymentBreakdownSchema, default: () => ({}) },
  kyc: { type: kycSchema, default: () => ({}) },

  // Xendit fields (replaces razorpayOrderId, razorpayPaymentId, razorpaySignature)
  xenditInvoiceId: { type: String, default: "" },
  xenditInvoiceUrl: { type: String, default: "" },
  xenditPaymentId: { type: String, default: "" },
  xenditPaymentMethod: { type: String, default: "" },
  xenditPaymentChannel: { type: String, default: "" },
  refundId: { type: String, default: "" },

  // Host payout tracking
  hostPayoutStatus: { type: String, enum: ['pending', 'scheduled', 'paid', 'failed', 'cancelled'], default: 'pending' },
  hostPayoutDate: { type: Date, default: null },
  hostPayoutAmount: { type: Number, default: 0 },
  refundAmount: { type: Number, default: 0 },
  refundDate: { type: Date, default: null },

  // Small audit / idempotency trail for webhook processing
  processedWebhookEvents: { type: [String], default: [] },

  address: { type: addressSchema, default: () => ({}) },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

bookingSchema.index({ companyId: 1 });
bookingSchema.index({ xenditInvoiceId: 1 }, { sparse: true });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);