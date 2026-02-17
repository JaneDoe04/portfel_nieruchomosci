/**
 * Webhook endpoints for OLX Group (Otodom) notifications.
 * PUBLIC – no JWT. OLX sends x-signature (HMAC-SHA1) for verification.
 * Callback must respond with 2xx within 2 seconds.
 * @see https://developer.olxgroup.com/docs/webhooks
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const WEBHOOK_SECRET = process.env.OTODOM_WEBHOOK_SECRET || '';

function verifySignature(payload, signature, secret) {
  if (!secret) return false;
  const { object_id, transaction_id } = payload;
  if (!object_id || !transaction_id) return false;
  const payloadString = `${object_id}${transaction_id}`;
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
  setImmediate(() => {
    console.log('[webhook/otodom]', JSON.stringify(payload));
    // TODO: handle Advert Lifecycle / Publish Advert flows, e.g. update local advert state
  });

  res.status(200).send('OK');
});

export default router;
