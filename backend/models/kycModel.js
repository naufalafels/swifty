import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idType: { type: String, required: true },
  idNumber: { type: String, required: true },
  idCountry: { type: String, default: 'MY' },
  frontKey: { type: String, required: true },
  backKey: { type: String, required: true },
  status: { type: String, default: 'pending' },
  statusReason: { type: String },
  submittedAt: { type: Date, default: Date.now },
});

const Kyc = mongoose.model('Kyc', kycSchema);
export default Kyc;