/**
 * Webhook endpoints for OLX Group (Otodom) notifications.
 * PUBLIC – no JWT. OLX sends x-signature (HMAC-SHA1) for verification.
 * Callback must respond with 2xx within 2 seconds.
 * @see https://developer.olxgroup.com/docs/webhooks
 */

import express from 'express';
import crypto from 'crypto';
import Apartment from '../models/Apartment.js';

const router = express.Router();

const WEBHOOK_SECRET = process.env.OTODOM_WEBHOOK_SECRET || '';

function verifySignature(payload, signature, secret) {
  if (!secret) return false;
  const { object_id, transaction_id } = payload;
  if (!object_id || !transaction_id) return false;
  // According to OLX Group docs: sign "object_id,transaction_id"
  const payloadString = `${object_id},${transaction_id}`;
  const expected = crypto.createHmac('sha1', secret).update(payloadString).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * POST /api/webhooks/otodom
 * Notification callback url from OLX Group form.
 * Headers: x-signature (HMAC-SHA1 of object_id + transaction_id with Notification secret).
 */
router.get('/otodom', (req, res) => {
  // Some providers validate callback URL with GET/HEAD.
  // Keep it fast and always return 200.
  res.status(200).send('OK');
});

router.head('/otodom', (req, res) => {
  res.status(200).end();
});

router.post('/otodom', express.json(), (req, res) => {
  const signature = req.headers['x-signature'];
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).send('Invalid payload');
  }

  if (WEBHOOK_SECRET && signature) {
    const valid = verifySignature(payload, signature, WEBHOOK_SECRET);
    if (!valid) {
      return res.status(401).send('Invalid signature');
    }
  }

  // Process async so we respond within 2 seconds
  setImmediate(async () => {
    try {
      console.log('[webhook/otodom] Received:', JSON.stringify(payload, null, 2));
      
      const { flow, event_type, object_id, transaction_id, data: webhookData } = payload;
      
      // Obsługa webhooków dla publikacji ogłoszeń
      if (flow === 'publish_advert') {
        console.log('[webhook/otodom] Processing publish_advert flow:', { event_type, object_id, transaction_id });
        
        if (event_type === 'advert_posted_success') {
          // Ogłoszenie zostało opublikowane - zaktualizuj mieszkanie z prawdziwym ID ogłoszenia
          // object_id to prawdziwe ID ogłoszenia na Otodom (używamy go do operacji API)
          // webhookData może zawierać URL ogłoszenia, ale do operacji API potrzebujemy object_id
          
          console.log('[webhook/otodom] advert_posted_success - searching for apartment with transaction_id:', transaction_id);
          
          // Znajdź mieszkanie po transaction_id zapisanym w externalIds.otodom
          // (podczas publikacji zapisujemy transaction_id jako tymczasowy identyfikator)
          const apartment = await Apartment.findOne({
            'externalIds.otodom': transaction_id
          });
          
          if (apartment) {
            // Zaktualizuj mieszkanie z prawdziwym object_id (nie URL) - potrzebny do operacji API
            // object_id to prawdziwe ID ogłoszenia, które używamy w DELETE /advert/v1/{object_id}
            const oldValue = apartment.externalIds?.otodom;
            apartment.externalIds = apartment.externalIds || {};
            apartment.externalIds.otodom = object_id; // Zapisujemy object_id, nie URL
            await apartment.save();
            console.log('[webhook/otodom] ✅ Updated apartment:', apartment._id, '| Old:', oldValue, '| New object_id:', object_id);
          } else {
            // Jeśli nie znaleziono po transaction_id, spróbuj znaleźć po custom_fields.reference_id
            // (jeśli webhook zawiera te dane)
            console.warn('[webhook/otodom] ⚠️ No apartment found for transaction_id:', transaction_id);
            console.warn('[webhook/otodom] Full webhook payload:', JSON.stringify(payload, null, 2));
          }
        } else if (event_type === 'advert_posted_error') {
          console.error('[webhook/otodom] ❌ Advert posting failed:', {
            transaction_id,
            object_id,
            webhookData: JSON.stringify(webhookData, null, 2)
          });
        } else if (event_type === 'advert_location_error') {
          console.warn('[webhook/otodom] ⚠️ Location error (but advert may be posted):', {
            transaction_id,
            object_id,
            webhookData: JSON.stringify(webhookData, null, 2)
          });
        } else {
          console.log('[webhook/otodom] Unknown event_type:', event_type, '| Full payload:', JSON.stringify(payload, null, 2));
        }
      } else {
        console.log('[webhook/otodom] Unknown flow:', flow, '| Full payload:', JSON.stringify(payload, null, 2));
      }
    } catch (err) {
      console.error('[webhook/otodom] Error processing webhook:', err);
    }
  });

  res.status(200).send('OK');
});

export default router;
