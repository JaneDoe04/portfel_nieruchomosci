import express from 'express';
import Apartment from '../models/Apartment.js';
import { protect } from '../middleware/auth.js';
import { publishOlxAdvert, updateOlxAdvert, deleteOlxAdvert } from '../services/publishers/olxApi.js';
import { publishOtodomAdvert, updateOtodomAdvert, deleteOtodomAdvert, getOtodomAdvertStatus } from '../services/publishers/otodomApi.js';

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
    // Zapisujemy transaction_id jako tymczasowy identyfikator - prawdziwy URL przyjdzie przez webhook
    apartment.externalIds = apartment.externalIds || {};
    apartment.externalIds.otodom = result.transactionId || result.url; // Tymczasowo transaction_id, webhook zaktualizuje na prawdziwy URL
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

    // externalId może być:
    // 1. object_id (prawdziwe ID ogłoszenia z webhooka) - używamy bezpośrednio
    // 2. transaction_id (tymczasowe ID z publikacji) - nie można aktualizować, webhook jeszcze nie przyszedł
    // 3. URL (stary format) - wyciągamy ID z URL
    
    let advertId = externalId;
    
    // Jeśli to URL, wyciągnij ID z końca URL-a
    if (externalId.includes('/')) {
      advertId = externalId.split('/').pop();
    }
    
    // UUID może być zarówno transaction_id jak i object_id z webhooka
    // Spróbujmy zaktualizować - jeśli to transaction_id, API zwróci błąd
    // Jeśli to object_id, operacja się powiedzie
    try {
      await updateOtodomAdvert(advertId, apartment, req.user._id);
    } catch (err) {
      // Jeśli błąd "not found" lub "invalid", może to być transaction_id
      const errorMsg = err.message?.toLowerCase() || '';
      if (errorMsg.includes('not found') || errorMsg.includes('invalid') || errorMsg.includes('advert')) {
        return res.status(400).json({ 
          message: 'Ogłoszenie jest jeszcze w trakcie publikacji lub nie zostało jeszcze opublikowane. Poczekaj na potwierdzenie z Otodom lub sprawdź logi webhooków.' 
        });
      }
      // Inny błąd - przekaż dalej
      throw err;
    }

    res.json({
      success: true,
      message: 'Ogłoszenie zaktualizowane na Otodom.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd aktualizacji ogłoszenia na Otodom.' });
  }
});

/**
 * GET /api/publish/:apartmentId/otodom/status
 * Sprawdź status ogłoszenia na Otodom
 */
router.get('/:apartmentId/otodom/status', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }

    const externalId = apartment.externalIds?.otodom;
    if (!externalId) {
      return res.status(400).json({ message: 'Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.' });
    }

    // Użyj externalId (może być transaction_id lub object_id)
    const status = await getOtodomAdvertStatus(externalId, req.user._id);

    res.json({
      success: true,
      status: status.data,
      externalId,
    });
  } catch (err) {
    res.status(500).json({ 
      message: err.message || 'Błąd sprawdzania statusu ogłoszenia na Otodom.',
      error: err.message 
    });
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

    // externalId może być:
    // 1. object_id (prawdziwe ID ogłoszenia z webhooka) - używamy bezpośrednio
    // 2. transaction_id (tymczasowe ID z publikacji) - nie można usunąć, webhook jeszcze nie przyszedł
    // 3. URL (stary format) - wyciągamy ID z URL
    
    let advertId = externalId;
    
    // Jeśli to URL, wyciągnij ID z końca URL-a
    if (externalId.includes('/')) {
      // Format: https://www.otodom.pl/pl/oferta/{id} lub podobny
      advertId = externalId.split('/').pop();
    }
    
    // UUID może być zarówno transaction_id jak i object_id z webhooka
    // Spróbujmy usunąć - jeśli to transaction_id, API zwróci błąd
    // Jeśli to object_id, operacja się powiedzie
    try {
      await deleteOtodomAdvert(advertId, req.user._id);
    } catch (err) {
      // Jeśli błąd "not found" lub "invalid", może to być transaction_id
      const errorMsg = err.message?.toLowerCase() || '';
      if (errorMsg.includes('not found') || errorMsg.includes('invalid') || errorMsg.includes('advert')) {
        return res.status(400).json({ 
          message: 'Ogłoszenie jest jeszcze w trakcie publikacji lub nie zostało jeszcze opublikowane. Poczekaj na potwierdzenie z Otodom lub sprawdź logi webhooków.' 
        });
      }
      // Inny błąd - przekaż dalej
      throw err;
    }

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
