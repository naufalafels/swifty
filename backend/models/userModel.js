import mongoose from "mongoose";
import { encrypt, decrypt } from '../services/cryptoService.js';  // NEW: Import crypto service

const KYC_STATUSES = ["not_submitted", "pending", "approved", "rejected"];

const kycSubSchema = new mongoose.Schema(
  {
    idType: { type: String, enum: ["passport", "nric"], default: "passport" },
    idNumber: { type: String, default: "" },  // This will now store encrypted data
    idCountry: { type: String, default: "MY" },
    frontImageUrl: { type: String, default: "" },  // Store S3 key, not URL
    backImageUrl: { type: String, default: "" },  // Store S3 key, not URL
    status: { type: String, enum: KYC_STATUSES, default: "not_submitted" },
    statusReason: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

// NEW: Pre-save hook to encrypt idNumber (synchronous for subdocs)
kycSubSchema.pre('save', function () {  // REMOVED: next parameter
  if (this.idNumber && !this.idNumber.includes(':')) {
    this.idNumber = encrypt(this.idNumber);
  }
});

// NEW: Post-find hooks to decrypt idNumber (for queries)
kycSubSchema.post('find', function (docs) {
  docs.forEach(doc => {
    if (doc.idNumber && doc.idNumber.includes(':')) {
      doc.idNumber = decrypt(doc.idNumber);
    }
  });
});

kycSubSchema.post('findOne', function (doc) {
  if (doc && doc.idNumber && doc.idNumber.includes(':')) {
    doc.idNumber = decrypt(doc.idNumber);
  }
});

const hostProfileSchema = new mongoose.Schema(
  {
    payoutProvider: { type: String, default: "razorpay_curlec_my" },
    payoutAccountRef: { type: String, default: "" },  // e.g., bank/Curlec mandate ref
    notes: { type: String, default: "" },
    onboardingCompletedAt: { type: Date, default: null },
    companyName: { type: String, default: "" }, 
    ssmNumber: { type: String, default: "" },
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number],
    },
    address: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      street: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "Malaysia" },
    },
  },
  { _id: false }
);

// NEW: Initial car schema for temp storage
const initialCarSchema = new mongoose.Schema(
  {
    make: { type: String, default: '' },
    model: { type: String, default: '' },
    year: { type: Number, default: null },
    color: { type: String, default: '' },
    category: { type: String, default: 'Sedan' },
    seats: { type: Number, default: 4 },
    transmission: { type: String, default: 'Automatic' },
    fuelType: { type: String, default: 'Gasoline' },
    petrolType: { type: [String], default: [] },
    mileage: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 }, 
    gasUsage: { type: String, default: '' },  
    image: { type: String, default: '' },  // Uploaded image URL or key
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["user", "customer", "company_admin", "superadmin", "guest", "host"],  // Added "host"
      default: "user",
    },

    roles: {
      type: [String],
      enum: ["renter", "host", "admin", "company_admin"],  // Added "company_admin"
      default: ["renter"],
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    kyc: { type: kycSubSchema, default: () => ({}) },

    profilePicture: { type: String, default: '' },

    school: { type: String, default: '' },

    work: { type: String, default: '' },

    pets: { type: String, default: '' },

    decade: { type: String, default: '' },

    languages: { type: String, default: '' },
    
    live: { type: String, default: '' },

    hostProfile: { type: hostProfileSchema, default: () => ({}) },

    initialCar: { type: initialCarSchema, default: null },  // NEW: Temp car details

    applyingForHost: { type: Boolean, default: false },  // NEW: Flag for host application

    // NEW: Host status tracking
    hostStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    rejectionReason: { type: String, default: '' },
    notifications: [{
      message: { type: String, required: true },
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],  // UPDATED: Array of objects with read status
  },
  {
    timestamps: true,
  }
);

const userModel = mongoose.models.user || mongoose.model("User", userSchema);
export default userModel;