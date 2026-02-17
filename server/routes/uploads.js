import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads');

const useCloudinary =
  Boolean(process.env.CLOUDINARY_URL) ||
  (Boolean(process.env.CLOUDINARY_CLOUD_NAME) && Boolean(process.env.CLOUDINARY_API_KEY) && Boolean(process.env.CLOUDINARY_API_SECRET));

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

const fileFilter = (_req, file, cb) => {
  const ok = /^image\//i.test(file.mimetype || '');
  cb(ok ? null : new Error('Dozwolone są tylko pliki graficzne.'), ok);
};

const upload = useCloudinary
  ? multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 12 * 1024 * 1024 } })
  : multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => {
          const safeName = String(file.originalname || 'image')
            .replace(/\s+/g, '-')
            .replace(/[^\w.\-]+/g, '');
          cb(null, `${Date.now()}-${safeName}`);
        },
      }),
      fileFilter,
      limits: { fileSize: 12 * 1024 * 1024 },
    });

const uploadBufferToCloudinary = (buffer, opts = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', ...opts },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

// POST /api/uploads - upload single image file, returns URL
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Brak pliku.' });
    }

    if (useCloudinary) {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: process.env.CLOUDINARY_FOLDER || 'portfel_nieruchomosci',
      });
      return res.status(201).json({ url: result.secure_url });
    }

    const url = `/uploads/${req.file.filename}`;
    return res.status(201).json({ url });
  } catch (err) {
    console.error('[uploads] failed', err);
    return res.status(500).json({ message: err.message || 'Błąd uploadu.' });
  }
});

export default router;


