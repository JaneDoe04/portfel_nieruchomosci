import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import apartmentsRoutes from './routes/apartments.js';
import feedsRoutes from './routes/feeds.js';
import uploadsRoutes from './routes/uploads.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: tylko sensowne origin (http/https). Na Renderze ustaw CLIENT_ORIGIN=http://localhost:5173 do devu.
const originEnv = process.env.CLIENT_ORIGIN;
const allowedOrigin = originEnv && /^https?:\/\//.test(originEnv) ? originEnv : 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentsRoutes);
app.use('/api/feeds', feedsRoutes);
app.use('/api/uploads', uploadsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
