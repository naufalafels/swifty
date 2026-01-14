import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Car from "../models/carModel.js";

import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const BLOCKING_STATUSES = ['pending', 'active', 'upcoming'];

const tryParseJSON = (v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
}

/**
 * Build a compact car summary to store inside booking.car.
 */
const buildCarSummary = (src = {}) => {
    const id = src.id?.toString?.() || src._id?.toString?.() || src.id || null;

    let companyId = null;
    let companyName = null;
    if (src.company) {
        if (typeof src.company === 'string') companyId = src.company;
        else if (src.company._id || src.company.id) companyId = (src.company._id || src.company.id).toString?.() || (src.company._id || src.company.id) || null;
        if (src.company.name) companyName = src.company.name;
    }
    if (!companyId) companyId = src.companyId || src.company_id || null;
    if (!companyName) companyName = src.companyName || src.company_name || null;

    return {
        id,
        make: src.make,
        model: src.model || "",
        year: src.year ? Number(src.year) : null,
        dailyRate: src.dailyRate ? Number(src.dailyRate) : 0,
        seats: src.seats ? Number(src.seats) : 4,
        transmission: src.transmission,
        fuelType: src.fuelType,
        mileage: src.mileage ? Number(src.mileage) : 0,
        image: src.image || src.carImage || "",
        companyId: companyId ? companyId.toString?.() || companyId : null,
        companyName: companyName || null,
    };
}

const deleteLocalFileIfPresent = (filePath) => {
    if (!filePath) return;
    const filename = filePath.replace(/^\/?uploads\/?/, '');
    const full = path.join(UPLOADS_DIR, filename);
    fs.unlink(full, (err) => { if (err) console.warn('Failed to delete file:', full, err); });
};

/**
 * Recalculate and set car.status depending on whether the car has
 * any bookings in BLOCKING_STATUSES whose returnDate is in the future
 * (i.e., upcoming/active). If any blocking bookings exist, set status to 'rented',
 * otherwise set to 'available'.
 */
const updateCarStatusBasedOnBookings = async (carId, session = null) => {
    if (!carId) return;
    const now = new Date();
    const count = await Booking.countDocuments({
        "car.id": carId,
        status: { $in: BLOCKING_STATUSES },
        returnDate: { $gte: now }
    }).session(session);
    const newStatus = count > 0 ? 'rented' : 'available';
    await Car.findByIdAndUpdate(carId, { status: newStatus }, { session });
};

// CREATE BOOKING (atomic-safe against concurrent bookings)
export const createBooking = async (req, res) => { 
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { customer, email, phone, car, pickupDate, returnDate, amount, details, address, carImage } = req.body;

        if (!customer || !email || !car || !pickupDate || !returnDate) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Missing required fields' });    
        }

        const pickup = new Date(pickupDate);
        const ret = new Date(returnDate);

        if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime()) || pickup > ret) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Invalid pickup or return date' });
        }

        let carSummary = null;
        if (typeof car === "string" && /^[0-9a-fA-F]{24}$/.test(car)) {
            const carDoc = await Car.findById(car).session(session).lean();
            if (!carDoc) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: "Car not found" }); }
            carSummary = buildCarSummary(carDoc);
            if (!carSummary.companyId && (carDoc.company || carDoc.companyId)) {
                const c = carDoc.company || carDoc.companyId;
                carSummary.companyId = c._id?.toString?.() || c.toString?.() || c || null;
                carSummary.companyName = carDoc.company?.name || carDoc.companyName || carSummary.companyName || null;
            }
        } else {
            const parsed = tryParseJSON(car) || car;
            carSummary = buildCarSummary(parsed);
            if (!carSummary.id) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: "Invalid car payload" }); }
            const carExists = await Car.exists({ _id: carSummary.id }).session(session);
            if (!carExists) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: "Car not found" }); }
            const carDoc = await Car.findById(carSummary.id).session(session).lean();
            if (carDoc) {
                const cs = buildCarSummary(carDoc);
                carSummary.companyId = cs.companyId || carSummary.companyId;
                carSummary.companyName = cs.companyName || carSummary.companyName;
            }
        }

        const carId = carSummary.id;

        // Prepare booking data
        const bookingData = {
            userId: req?.user?.id || req.user?._id || null,
            customer, email, phone,
            car: carSummary,
            carImage: carImage || carSummary.image || "",
            pickupDate: pickup,
            returnDate: ret,
            amount: Number(amount || 0),
            details: tryParseJSON(details),
            address: tryParseJSON(address),
            paymentStatus: "pending",
            status: "pending",
        };

        // Create booking in transaction
        const createdArr = await Booking.create([bookingData], { session });
        const createdBooking = createdArr[0];

        // booking entry for car
        const bookingEntry = {
            bookingId: createdBooking._id,
            pickupDate: createdBooking.pickupDate,
            returnDate: createdBooking.returnDate,
            status: createdBooking.status,
        };

        // Conditional push into Car.bookings: only push if NO overlapping blocking bookings exist
        const carUpdate = await Car.findOneAndUpdate(
            {
                _id: carId,
                bookings: {
                    $not: {
                        $elemMatch: {
                            status: { $in: BLOCKING_STATUSES },
                            pickupDate: { $lte: ret },
                            returnDate: { $gte: pickup }
                        }
                    }
                }
            },
            { $push: { bookings: bookingEntry } },
            { session, new: true }
        );

        if (!carUpdate) {
            // Another booking overlapped concurrently — abort and roll back
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: 'Car is not available for the selected dates' });
        }

        // Recompute car status (rented if relevant)
        await updateCarStatusBasedOnBookings(carId, session);

        await session.commitTransaction();
        session.endSession();

        const saved = await Booking.findById(createdBooking._id).lean();
        return res.status(201).json({
            success: true,
            booking: saved,
        });
    } 
    
    catch (err) {
        await session.abortTransaction().catch(() => { });
        session.endSession();
        console.error('Error creating booking:', err);
        return res.status(500).json({ 
            success: false, 
            message: err.message
        });
    }
};

// GET FUNCTION
export const getBookings = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 12, 100);
        const search = req.query.search?.trim() || "";
        const status = req.query.status?.trim() || "";
        const carFilter = req.query.car?.trim() || "";
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        const companyFilter = req.query.company?.trim() || "";

        const query = {};
        if (search) {
            const q = { $regex: search, $options: "i" };
            query.$or = [{ customer: q }, { email: q }, { "car.make": q }, { "car.model": q }];
        }

        if (status) query.status = status;
        if (carFilter) {
            if (/^[0-9a-fA-F]{24}$/.test(carFilter)) query["car.id"] = carFilter;
            else query.$or = [...(query.$or || []), { "car.make": { $regex: carFilter, $options: "i" } }, { "car.model": { $regex: carFilter, $options: "i" } }];
        }

        if (companyFilter) {
            if (/^[0-9a-fA-F]{24}$/.test(companyFilter)) {
                query["car.companyId"] = companyFilter;
            } else {
                query["car.companyName"] = { $regex: companyFilter, $options: "i" };
            }
        }

        if (from || to) {
            query.pickupDate = {};
            if (from) query.pickupDate.$gte = from;
            if (to) query.pickupDate.$lte = to;
        }

        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .sort({ bookingDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.json({
            page,
            pages: Math.ceil(total / limit),
            total,
            data: bookings
        });
    } 
    
    catch (err) {
        next(err);
    }
}

// GET MY BOOKINGS
export const getMyBookings = async (req, res, next) => {
    try {
        if (!req.user || (!req.user.id && !req.user._id))
            return res.status(401).json({ success: false, message: 'Unauthorized' });

        const userId = req.user.id || req.user._id;
        const bookings = await Booking.find({userId}).sort({bookingDate: -1}).lean();
        return res.json(bookings);
    } 
    
    catch (err) {
        next(err);
    }
}

// UPDATE FUNCTION
export const updateBooking = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Booking not found' }); }

        const prevCarId = booking.car?.id;

        // IMAGE HANDLING
        if (req.file) {
            if (booking.carImage && booking.carImage.startsWith("/uploads/")) deleteLocalFileIfPresent(booking.carImage);
            booking.carImage = `/uploads/${req.file.filename}`;
        } 
        else if (req.body.carImage !== undefined) {
            if (req.body.carImage && !String(req.body.carImage).startsWith("/uploads/") && booking.carImage && booking.carImage.startsWith("/uploads/")) {
                deleteLocalFileIfPresent(booking.carImage);
            }
            booking.carImage = req.body.carImage || booking.carImage;
        }

        const updatable = ["customer", "email", "phone", "car", "pickupDate", "returnDate", "bookingDate", "status", "amount", "details", "address"];
        for (const f of updatable) {
            if (req.body[f] === undefined) continue;
            if (["pickupDate", "returnDate", "bookingDate"].includes(f)) booking[f] = new Date(req.body[f]);
            else if (f === "amount") booking[f] = Number(req.body[f]);
            else if (f === "details" || f === "address") booking[f] = tryParseJSON(req.body[f]);
            else if (f === "car") {
                const c = tryParseJSON(req.body.car);
                if (c) {
                    const summary = buildCarSummary(c);
                    if (!summary.id && booking.car?.id) summary.id = booking.car.id;
                    if (!summary.companyId && booking.car?.companyId) summary.companyId = booking.car.companyId;
                    if (!summary.companyName && booking.car?.companyName) summary.companyName = booking.car.companyName;
                    booking.car = summary;
                }
            } else booking[f] = req.body[f];
        }

        // If dates or car changed, ensure no overlap on the new car
        const newCarId = booking.car?.id;
        const pickup = booking.pickupDate;
        const ret = booking.returnDate;
        if (newCarId) {
            // Ensure no other blocking bookings overlap this updated booking (excluding this booking)
            const conflict = await Booking.findOne({
                _id: { $ne: booking._id },
                "car.id": newCarId,
                status: { $in: BLOCKING_STATUSES },
                pickupDate: { $lte: ret },
                returnDate: { $gte: pickup },
            }).session(session);
            if (conflict) {
                await session.abortTransaction(); session.endSession();
                return res.status(409).json({ success: false, message: 'Updated booking conflicts with existing booking for this car' });
            }
        }

        const updated = await booking.save({ session });

        // If car has changed, move booking entry from previous car to new car
        if (prevCarId && prevCarId.toString() !== (newCarId?.toString())) {
            await Car.findByIdAndUpdate(prevCarId, { $pull: { bookings: { bookingId: updated._id } }}, { session });
            const bookingEntry = { bookingId: updated._id, pickupDate: updated.pickupDate, returnDate: updated.returnDate, status: updated.status };
            // Conditional push to new car to be safe (avoid overlap)
            const newCarUpdate = await Car.findOneAndUpdate(
                {
                    _id: newCarId,
                    bookings: {
                        $not: {
                            $elemMatch: {
                                status: { $in: BLOCKING_STATUSES },
                                pickupDate: { $lte: updated.returnDate },
                                returnDate: { $gte: updated.pickupDate }
                            }
                        }
                    }
                },
                { $push: { bookings: bookingEntry } },
                { session, new: true }
            );
            if (!newCarUpdate) {
                // Conflict with new car - rollback
                await session.abortTransaction(); session.endSession();
                return res.status(409).json({ success: false, message: 'Updated booking conflicts with existing booking on target car' });
            }
            await updateCarStatusBasedOnBookings(prevCarId, session);
            await updateCarStatusBasedOnBookings(newCarId, session);
        } else {
            // Update the bookings entry status/dates in place if exists
            try {
                await Car.findByIdAndUpdate(newCarId, { $set: { "bookings.$[elem].status": updated.status, "bookings.$[elem].pickupDate": updated.pickupDate, "bookings.$[elem].returnDate": updated.returnDate }}, { arrayFilters: [{ "elem.bookingId": updated._id }], session });
            } catch (e) {
                // ignore
            }
            await updateCarStatusBasedOnBookings(newCarId, session);
        }

        await session.commitTransaction();
        session.endSession();

        res.json(updated);
    } 
    
    catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        next(err);
    }
}

// UPDATE STATUS OF BOOKING ORDER
export const updateBookingStatus = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { status } = req.body;
        if (!status) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: 'Status is required' }); }
        const booking = await Booking.findById(req.params.id).session(session);

        if (!booking) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Booking not found' }); }
        booking.status = status;
        const updated = await booking.save({ session });

        try {
            await Car.findByIdAndUpdate(booking.car.id, { $set: { "bookings.$[elem].status": status }}, { arrayFilters: [{ "elem.bookingId": booking._id }], session });
        } catch (e) {
            // ignore
        }

        await updateCarStatusBasedOnBookings(booking.car.id, session);

        await session.commitTransaction();
        session.endSession();

        res.json(updated);
    } 
    
    catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        next(err);
    }
}

// DELETE FUNCTION
export const deleteBooking = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Booking not found' }); }

        if (booking.carImage && booking.carImage.startsWith("/uploads/"))
            deleteLocalFileIfPresent(booking.carImage);

        const carId = booking.car?.id;

        await booking.remove({ session });

        if (carId) {
            await Car.findByIdAndUpdate(carId, { $pull: { bookings: { bookingId: booking._id } } }, { session });
            await updateCarStatusBasedOnBookings(carId, session);
        }

        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Booking deleted successfully' });
    } 
    
    catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        next(err);
    }
}