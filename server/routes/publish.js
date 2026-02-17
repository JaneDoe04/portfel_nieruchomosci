import express from 'express';
import Apartment from '../models/Apartment.js';
import { protect } from '../middleware/auth.js';
import { publishOlxAdvert, updateOlxAdvert, deleteOlxAdvert } from '../services/publishers/olxApi.js';
import { publishOtodomAdvert, updateOtodomAdvert, deleteOtodomAdvert } from '../services/publishers/otodomApi.js';

const router = express.Router();

// Wszystkie endpointy wymagają autoryzacji
router.use(protect);

/**
 * POST /api/publish/:apartmentId/olx
 * Opublikuj mieszkanie na OLX
 */
router.post('/:apartmentId/olx', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    if (apartment.status !== 'WOLNE') {
      return res.status(400).json({ message: 'Można publikować tylko mieszkania ze statusem WOLNE.' });
    }

    const result = await publishOlxAdvert(apartment, req.user._id);

    // Zaktualizuj externalIds w mieszkaniu
    apartment.externalIds = apartment.externalIds || {};
    apartment.externalIds.olx = result.url;
    await apartment.save();

    res.json({
      success: true,
      message: 'Ogłoszenie opublikowane na OLX.',
      url: result.url,
      advertId: result.advertId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd publikacji na OLX.' });
  }
});

/**
 * PUT /api/publish/:apartmentId/olx
 * Zaktualizuj ogłoszenie na OLX
 */
router.put('/:apartmentId/olx', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    const externalId = apartment.externalIds?.olx;
    if (!externalId) {
      return res.status(400).json({ message: 'Mieszkanie nie ma opublikowanego ogłoszenia na OLX.' });
    }

    // Wyciągnij ID z URL jeśli to pełny URL
    const advertId = externalId.includes('/') 
      ? externalId.split('/').pop() 
      : externalId;

    await updateOlxAdvert(advertId, apartment, req.user._id);

    res.json({
      success: true,
      message: 'Ogłoszenie zaktualizowane na OLX.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd aktualizacji ogłoszenia na OLX.' });
  }
});

/**
 * DELETE /api/publish/:apartmentId/olx
 * Usuń ogłoszenie z OLX
 */
router.delete('/:apartmentId/olx', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    const externalId = apartment.externalIds?.olx;
    if (!externalId) {
      return res.status(400).json({ message: 'Mieszkanie nie ma opublikowanego ogłoszenia na OLX.' });
    }

    const advertId = externalId.includes('/') 
      ? externalId.split('/').pop() 
      : externalId;

    await deleteOlxAdvert(advertId, req.user._id);

    // Usuń externalId z mieszkania
    apartment.externalIds = apartment.externalIds || {};
    apartment.externalIds.olx = null;
    await apartment.save();

    res.json({
      success: true,
      message: 'Ogłoszenie usunięte z OLX.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd usuwania ogłoszenia z OLX.' });
  }
});

/**
 * POST /api/publish/:apartmentId/otodom
 * Opublikuj mieszkanie na Otodom
 */
router.post('/:apartmentId/otodom', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    if (apartment.status !== 'WOLNE') {
      return res.status(400).json({ message: 'Można publikować tylko mieszkania ze statusem WOLNE.' });
    }

    const result = await publishOtodomAdvert(apartment, req.user._id);

    // Zaktualizuj externalIds w mieszkaniu
    apartment.externalIds = apartment.externalIds || {};
    apartment.externalIds.otodom = result.url;
    await apartment.save();

    res.json({
      success: true,
      message: 'Ogłoszenie opublikowane na Otodom.',
      url: result.url,
      advertId: result.advertId,
    });
  } catch (err) {
    console.error('[publish/otodom] Error:', {
      message: err.message,
      stack: err.stack,
      apartmentId: req.params.apartmentId,
      userId: req.user._id,
    });
    const errorMessage = err.message || 'Błąd publikacji na Otodom.';
    res.status(500).json({ message: errorMessage });
  }
});

/**
 * PUT /api/publish/:apartmentId/otodom
 * Zaktualizuj ogłoszenie na Otodom
 */
router.put('/:apartmentId/otodom', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    const externalId = apartment.externalIds?.otodom;
    if (!externalId) {
      return res.status(400).json({ message: 'Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.' });
    }

    // Wyciągnij ID z URL jeśli to pełny URL
    const advertId = externalId.includes('/') 
      ? externalId.split('/').pop() 
      : externalId;

    await updateOtodomAdvert(advertId, apartment, req.user._id);

    res.json({
      success: true,
      message: 'Ogłoszenie zaktualizowane na Otodom.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd aktualizacji ogłoszenia na Otodom.' });
  }
});

/**
 * DELETE /api/publish/:apartmentId/otodom
 * Usuń ogłoszenie z Otodom
 */
router.delete('/:apartmentId/otodom', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    const externalId = apartment.externalIds?.otodom;
    if (!externalId) {
      return res.status(400).json({ message: 'Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.' });
    }

    const advertId = externalId.includes('/') 
      ? externalId.split('/').pop() 
      : externalId;

    await deleteOtodomAdvert(advertId, req.user._id);

    // Usuń externalId z mieszkania
    apartment.externalIds = apartment.externalIds || {};
    apartment.externalIds.otodom = null;
    await apartment.save();

    res.json({
      success: true,
      message: 'Ogłoszenie usunięte z Otodom.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd usuwania ogłoszenia z Otodom.' });
  }
});

export default router;
