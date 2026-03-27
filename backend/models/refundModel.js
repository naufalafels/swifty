import mongoose from 'mongoose';

const RefundSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['processed', 'failed', 'pending'], default: 'processed' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    xenditRefundId: { type: String, default: '' },
  },
  { timestamps: true }
);

RefundSchema.index({ companyId: 1, createdAt: -1 });
RefundSchema.index({ bookingId: 1 });

export default mongoose.model('Refund', RefundSchema);