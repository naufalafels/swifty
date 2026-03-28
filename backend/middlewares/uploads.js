import multer from "multer";
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
        cb(null, `${base}-${Date.now()}${ext}`)
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP. Max size: 5MB.`), false);
    }
};

export const uploads = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});