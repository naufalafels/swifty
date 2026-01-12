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
  },
  { timestamps: true }
);

// Use async pre hook WITHOUT next; throw on error
bookingSchema.pre('validate', async function () {
    // if car is already populated with an id, nothing to do
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
        // Throw so mongoose validation fails with the error
        throw err;
    }
});

const blockingStatuses = ['pending', 'active', 'upcoming'];

// Post-save: use async function without next()
bookingSchema.post('save', async function (doc) {
    try {
        if (!doc.car?.id) return;

        const carId = doc.car.id;
        const bookingEntry = {
            bookingId: doc._id,
            pickupDate: doc.pickupDate,
            returnDate: doc.returnDate,
            status: doc.status,
        };

        if (blockingStatuses.includes(doc.status)) {
            // Ensure booking entry is present: pull then push to refresh entry
            await Car.findByIdAndUpdate(
                carId,
                { $pull: { bookings: { bookingId: doc._id } } },
                { new: true }
            ).exec();

            await Car.findByIdAndUpdate(
                carId,
                { $push: { bookings: bookingEntry } },
                { new: true }
            ).exec();
        } else {
            await Car.findByIdAndUpdate(
                carId,
                { $pull: { bookings: { bookingId: doc._id } } },
                { new: true }
            ).exec();
        }
    } catch (err) {
        // Log but do not throw in post hook; throwing in post hooks may be ignored.
        console.error('bookingSchema.post(save) error:', err);
    }
});

// Post-remove: use async function without next()
bookingSchema.post('remove', async function (doc) {
    try {
        if (!doc.car?.id) return;
        await Car.findByIdAndUpdate(
            doc.car.id,
            { $pull: { bookings: { bookingId: doc._id } } },
            { new: true }
        ).exec();
    } catch (err) {
        console.error('bookingSchema.post(remove) error:', err);
    }
});

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);