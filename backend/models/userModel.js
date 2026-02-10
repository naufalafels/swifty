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

// NEW: Pre-save hook to encrypt idNumber
kycSubSchema.pre('save', function (next) {
  if (this.idNumber && !this.idNumber.includes(':')) {  // Encrypt only if not already encrypted
    this.idNumber = encrypt(this.idNumber);
  }
  next();
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
    payoutAccountRef: { type: String, default: "" }, // e.g., bank/Curlec mandate ref
    notes: { type: String, default: "" },
    onboardingCompletedAt: { type: Date, default: null },
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
      enum: ["user", "customer", "company_admin", "superadmin", "guest"],  // Added "customer"
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

    hostProfile: { type: hostProfileSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

const userModel = mongoose.models.user || mongoose.model("User", userSchema);
export default userModel;