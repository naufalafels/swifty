import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * RefreshToken model
 * Stores hashed refresh tokens for rotation & revocation.
 *
 * Fields:
 * - tokenHash: SHA256 hash of the token (we never store the plain token)
 * - userId: ObjectId reference to User
 * - revoked: boolean (true if revoked)
 * - replacedByToken: tokenHash of the token that replaced this one (if rotated)
 * - expiresAt: Date when this token expires
 * - createdAt: Date
 */

const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, index: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    revoked: { type: Boolean, default: false },
    replacedByToken: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    createdByIp: { type: String, default: '' },
    revokedByIp: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);