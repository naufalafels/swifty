import mongoose from 'mongoose';
const { Schema } = mongoose;

const companySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, lowercase: true, index: true, unique: true, sparse: true },
  logo: { type: String, default: '' }, // image URL for company logo
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },
  contact: {
    phone: String,
    email: String,
  },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  isVerified: { type: Boolean, default: false },
  stripeAccountId: { type: String, default: '' },
}, { timestamps: true });

companySchema.index({ location: '2dsphere' });

export default mongoose.models.Company || mongoose.model('Company', companySchema);