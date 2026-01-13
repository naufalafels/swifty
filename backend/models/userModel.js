import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    // New multi-tenant fields:
    role: {
      type: String,
      enum: ['user', 'company_admin', 'superadmin'],
      default: 'user'
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null
    }
}, {
    timestamps: true
});

const userModel = mongoose.models.user || mongoose.model('User', userSchema);
export default userModel;