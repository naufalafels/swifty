import multer from 'multer';
import fs from 'fs';
import path from 'path';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const dir = path.join(process.cwd(), 'uploads', 'kyc');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  if (!allowedMime.includes(file.mimetype)) {
    return cb(new Error('Only JPEG/PNG/WEBP images are allowed'), false);
  }
  cb(null, true);
}

export const uploadKyc = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 2 },
});