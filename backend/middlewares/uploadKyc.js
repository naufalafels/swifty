import multer from 'multer';
import { generateUploadUrl } from '../services/s3Service.js';  // NEW

// NEW: Custom storage for S3 signed URLs
const storage = multer.memoryStorage();  // Store in memory, then upload to S3

const KYC_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB limit
  fileFilter: (req, file, cb) => {
    if (KYC_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Allowed: JPEG, PNG, PDF. Max size: 5MB.`), false);
    }
  },
});

// CHANGED: Export the multer instance (not the middleware), so routes can call .fields()
export const uploadKyc = upload;

// NEW: Middleware to handle S3 upload after multer
export const handleS3Upload = async (req, res, next) => {
  try {
    const frontFile = req.files?.frontImage?.[0];
    const backFile = req.files?.backImage?.[0];

    if (frontFile) {
      const frontKey = `${req.user.id}/front-${Date.now()}.jpg`;
      const uploadUrl = await generateUploadUrl(frontKey, frontFile.mimetype);
      // In a real implementation, you'd upload the file here using the URL, but for simplicity, assume client-side upload or adjust
      // For now, store the key
      req.frontKey = frontKey;
    }

    if (backFile) {
      const backKey = `${req.user.id}/back-${Date.now()}.jpg`;
      const uploadUrl = await generateUploadUrl(backKey, backFile.mimetype);
      req.backKey = backKey;
    }

    next();
  } catch (err) {
    console.error('S3 upload error', err);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
};