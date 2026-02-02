import mongoose from 'mongoose';

const LegalDocSchema = new mongoose.Schema(
  {
    terms: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export default mongoose.model('LegalDoc', LegalDocSchema);