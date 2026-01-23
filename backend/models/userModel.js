import mongoose from "mongoose";

const KYC_STATUSES = ["not_submitted", "pending", "approved", "rejected"];

const kycSubSchema = new mongoose.Schema(
  {
    idType: { type: String, enum: ["passport", "nric"], default: "passport" },
    idNumber: { type: String, default: "" },
    idCountry: { type: String, default: "MY" },
    frontImageUrl: { type: String, default: "" },
    backImageUrl: { type: String, default: "" },
    status: { type: String, enum: KYC_STATUSES, default: "not_submitted" },
    statusReason: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

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
      enum: ["user", "company_admin", "superadmin", "guest"],
      default: "user",
    },

    roles: {
      type: [String],
      enum: ["renter", "host", "admin"],
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