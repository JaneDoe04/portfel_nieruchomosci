import express from 'express';
import { generateOtodomFeed } from '../services/publishers/otodomFeed.js';
import { generateOlxFeed } from '../services/publishers/olxFeed.js';

const router = express.Router();

// GET /api/feeds/otodom - public XML feed for apartments with status WOLNE
router.get('/otodom', async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const xml = await generateOtodomFeed(baseUrl);
    
    // Set headers for XML display/download
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="otodom-feed.xml"',
      'Access-Control-Allow-Origin': '*',
    });
    
    res.send(xml);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd generowania feedu Otodom.' });
  }
});

// GET /api/feeds/olx - public XML feed for apartments with status WOLNE
router.get('/olx', async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const userEmail = req.query.email || ''; // Optional email parameter
    const xml = await generateOlxFeed(baseUrl, userEmail);
    
    // Set headers for XML display/download
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="olx-feed.xml"',
      'Access-Control-Allow-Origin': '*',
    });
    
    res.send(xml);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd generowania feedu OLX.' });
  }
});

export default router;
