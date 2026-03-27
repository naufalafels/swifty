import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: '' },           // denormalized for quick display
    userEmail: { type: String, default: '' },          // denormalized
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    
    // Categorized actions for filtering
    category: {
      type: String,
      enum: [
        'auth',           // login, logout, password change
        'price_change',   // car daily rate, deposit changes
        'booking',        // booking status changes
        'verification',   // user/host KYC approval/rejection
        'refund',         // refund processed
        'car_management', // car added, updated, deleted
        'company',        // company profile changes
        'system',         // system-level events
      ],
      default: 'system',
    },
    
    action: { type: String, required: true },
    details: { type: String, default: '' },

    // Structured metadata for rich detail views
    metadata: {
      targetType: { type: String, default: '' },       // 'car', 'booking', 'user', 'host'
      targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
      previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
      newValue: { type: mongoose.Schema.Types.Mixed, default: null },
      bookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
      carId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // Severity for quick visual indication in the UI
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Indexes for efficient queries
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ category: 1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ 'metadata.targetId': 1 });

export default mongoose.model('AuditLog', AuditLogSchema);