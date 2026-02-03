import express from 'express';
import { generateOtodomFeed } from '../services/publishers/otodomFeed.js';

const router = express.Router();

// GET /api/feeds/otodom - public XML feed for apartments with status WOLNE
router.get('/otodom', async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const xml = await generateOtodomFeed(baseUrl);
    res.type('application/xml').set('Content-Type', 'application/xml; charset=utf-8').send(xml);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd generowania feedu Otodom.' });
  }
});

export default router;
