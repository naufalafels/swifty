import mongoose from "mongoose";
import Car from "./carModel.js";

const { Schema } = mongoose;

const addressSchema = new Schema(
    { street: String, city: String, state: String, zipCode: String },
    { _id: false, default: {} }
);

// CAR DETAILS
const carSummarySchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: "Car", required: true }, // from Car Model
    make: { type: String, default: "" },
    model: { type: String, default: "" },
    year: Number,
    dailyRate: { type: Number, default: 0 },
    category: { type: String, default: "Sedan" },
    seats: { type: Number, default: 4 },
    transmission: { type: String, default: "" },
    fuelType: { type: String, default: "" },
    mileage: { type: Number, default: 0 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

// CUSTOMER DETAILS, AND SHIPPING ADDRESS
const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // from User Model
    customer: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    car: { type: carSummarySchema, required: true },
    carImage: { type: String, default: "" },
    pickupDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    bookingDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "upcoming"],
      default: "pending",
    },
    amount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    paymentMethod: { type: String, enum: ["Credit Card", "Paypal"], default: "Credit Card" },
    sessionId: String,
    paymentIntentId: String,
    address: { type: addressSchema, default: () => ({}) },
    stripeSession: { type: Schema.Types.Mixed, default: {} },

    // New: company the booking belongs to (denormalized for quick admin queries)
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  },
  { timestamps: true }
);

// Keep pre/post hooks here (unchanged from your existing logic)
bookingSchema.pre('validate', async function () {
    if (this.car?.id) return;

    const { make, model, dailyRate } = this.car || {};
    if (make || model || dailyRate) return;

    try {
        const carId = this.car?.id;
        if (!carId) return;
        const carDoc = await Car.findById(carId).lean();
        if (carDoc) {
            Object.assign(this.car, {
                make: carDoc.make ?? this.car.make,
                model: carDoc.model ?? this.car.model,
                year: carDoc.year ?? this.car.year,
                dailyRate: carDoc.dailyRate ?? this.car.dailyRate,
                seats: carDoc.seats ?? this.car.seats,
                transmission: carDoc.transmission ?? this.car.transmission,
                fuelType: carDoc.fuelType ?? this.car.fuelType,
                mileage: carDoc.mileage ?? this.car.mileage,
                image: carDoc.image ?? this.car.image,
            });
            if (!this.carImage) this.carImage = carDoc.image || "";
        }
    } catch (err) {
        throw err;
    }
});

// post save/remove hooks truncated here — keep your existing implementation
// (If you have the previous hooks, keep them unchanged)

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);