/**
 * Sprawdza mieszkania z kończącymi się umowami i wysyła powiadomienia email.
 * Run with: npm run check-leases
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Apartment from '../models/Apartment.js';
import { sendEmail, createExpiringLeaseEmail } from '../services/email.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'jonyjdjdjdjd@gmail.com';

async function checkExpiringLeases() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiring = await Apartment.find({
      status: 'WYNAJĘTE',
      contractEndDate: { $gte: now, $lte: in30Days },
    })
      .select('title address contractEndDate')
      .lean();

    if (expiring.length === 0) {
      console.log('Brak mieszkań z umowami kończącymi się w ciągu 30 dni.');
      process.exit(0);
      return;
    }

    console.log(`Znaleziono ${expiring.length} mieszkanie(ń) z umową kończącą się w ciągu 30 dni:`);
    expiring.forEach((apt) => {
      console.log(`  - ${apt.title}, ${apt.address}, koniec umowy: ${apt.contractEndDate?.toISOString().slice(0, 10)}`);
    });

    // Przygotuj email
    const { subject, html, text } = createExpiringLeaseEmail(expiring);

    if (!NOTIFICATION_EMAIL) {
      console.log('Brak adresu email do powiadomień (NOTIFICATION_EMAIL).');
      process.exit(0);
      return;
    }

    console.log(`Wysyłanie powiadomienia do ${NOTIFICATION_EMAIL}...`);

    // Wyślij email
    const result = await sendEmail({
      to: NOTIFICATION_EMAIL,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log('✅ Powiadomienia wysłane pomyślnie.');
    } else {
      console.error('❌ Błąd wysyłki powiadomień:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('Błąd:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkExpiringLeases();
