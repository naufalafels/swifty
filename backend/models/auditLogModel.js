import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    action: { type: String, required: true },
    details: { type: String, default: '' },
    ip: { type: String, default: '' },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export default mongoose.model('AuditLog', AuditLogSchema);