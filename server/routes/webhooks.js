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
  console.log('[webhook/otodom] GET request received (callback validation)');
  console.log('[webhook/otodom] GET query params:', req.query);
  res.status(200).json({ 
    status: 'OK', 
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    webhookSecretConfigured: !!WEBHOOK_SECRET
  });
});

router.head('/otodom', (req, res) => {
  console.log('[webhook/otodom] HEAD request received (callback validation)');
  res.status(200).end();
});

router.post('/otodom', express.json(), (req, res) => {
  // Log na samym początku - przed parsowaniem
  console.log('[webhook/otodom] ========== POST REQUEST RECEIVED ==========');
  console.log('[webhook/otodom] Timestamp:', new Date().toISOString());
  console.log('[webhook/otodom] URL:', req.url);
  console.log('[webhook/otodom] Method:', req.method);
  console.log('[webhook/otodom] Headers:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'x-signature': req.headers['x-signature'] ? 'present' : 'missing',
    'host': req.headers['host'],
  });
  console.log('[webhook/otodom] Raw body type:', typeof req.body);
  console.log('[webhook/otodom] Raw body:', req.body);
  
  const signature = req.headers['x-signature'];
  const payload = req.body;

  // Log wszystkich requestów (nawet niepoprawnych) dla debugowania
  console.log('[webhook/otodom] POST request received:', {
    hasPayload: !!payload,
    payloadType: typeof payload,
    hasSignature: !!signature,
    rawBody: typeof req.body,
  });

  if (!payload || typeof payload !== 'object') {
    console.error('[webhook/otodom] Invalid payload:', payload);
    return res.status(400).send('Invalid payload');
  }

  // Log informacji o webhook secret
  console.log('[webhook/otodom] Webhook secret configured:', !!WEBHOOK_SECRET);
  console.log('[webhook/otodom] Signature present:', !!signature);
  
  if (WEBHOOK_SECRET && signature) {
    const valid = verifySignature(payload, signature, WEBHOOK_SECRET);
    if (!valid) {
      console.error('[webhook/otodom] ❌ Invalid signature:', {
        received: signature,
        hasSecret: !!WEBHOOK_SECRET,
        payloadKeys: Object.keys(payload),
        object_id: payload?.object_id,
        transaction_id: payload?.transaction_id,
      });
      return res.status(401).send('Invalid signature');
    }
    console.log('[webhook/otodom] ✅ Signature verified successfully');
  } else {
    if (!WEBHOOK_SECRET) {
      console.warn('[webhook/otodom] ⚠️ WEBHOOK_SECRET not set in environment variables!');
    }
    if (!signature) {
      console.warn('[webhook/otodom] ⚠️ x-signature header missing from request');
    }
    console.warn('[webhook/otodom] ⚠️ No signature verification (WEBHOOK_SECRET or signature missing)');
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
          
          // Sprawdź czy to testowy webhook (fake URL)
          const isTestWebhook = webhookData?.url?.includes('crm-target-fake.com') || webhookData?.url?.includes('fake');
          
          if (isTestWebhook) {
            console.log('[webhook/otodom] 🧪 Test webhook received (from Test Callback) - skipping apartment update');
            console.log('[webhook/otodom] Test webhook transaction_id:', transaction_id, '| object_id:', object_id);
            return; // Nie aktualizujemy mieszkania dla testowych webhooków
          }
          
          console.log('[webhook/otodom] advert_posted_success - searching for apartment with transaction_id:', transaction_id);
          
          // Znajdź mieszkanie po transaction_id zapisanym w externalIds.otodom
          // (podczas publikacji zapisujemy transaction_id jako tymczasowy identyfikator)
          let apartment = await Apartment.findOne({
            'externalIds.otodom': transaction_id
          });
          
          // Jeśli nie znaleziono po transaction_id, spróbuj znaleźć ostatnie mieszkanie z UUID w externalIds.otodom
          // (może być problem z synchronizacją - webhook przyszedł przed zapisaniem transaction_id)
          if (!apartment) {
            console.log('[webhook/otodom] Not found by transaction_id, trying to find recent apartment with UUID...');
            // Znajdź mieszkanie które ma UUID w externalIds.otodom (transaction_id format)
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            apartment = await Apartment.findOne({
              'externalIds.otodom': { $regex: uuidPattern }
            }).sort({ updatedAt: -1 }); // Najnowsze mieszkanie
          }
          
          if (apartment) {
            // Zaktualizuj mieszkanie z prawdziwym object_id (nie URL) - potrzebny do operacji API
            // object_id to prawdziwe ID ogłoszenia, które używamy w DELETE /advert/v1/{object_id}
            const oldValue = apartment.externalIds?.otodom;
            apartment.externalIds = apartment.externalIds || {};
            apartment.externalIds.otodom = object_id; // Zapisujemy object_id, nie URL
            
            // Zapisz też URL jeśli jest dostępny w webhookData
            if (webhookData?.url) {
              apartment.externalIds.otodomUrl = webhookData.url;
            }
            
            await apartment.save();
            console.log('[webhook/otodom] ✅ Updated apartment:', apartment._id.toString());
            console.log('[webhook/otodom] ✅ Old externalId:', oldValue);
            console.log('[webhook/otodom] ✅ New object_id:', object_id);
            console.log('[webhook/otodom] ✅ Advert URL:', webhookData?.url || 'not provided');
          } else {
            // Jeśli nie znaleziono po transaction_id, spróbuj znaleźć po custom_fields.reference_id
            // (jeśli webhook zawiera te dane)
            console.warn('[webhook/otodom] ⚠️ No apartment found for transaction_id:', transaction_id);
            console.warn('[webhook/otodom] This might be a test webhook or webhook from old/deleted publication');
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
