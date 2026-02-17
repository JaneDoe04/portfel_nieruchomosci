/**
 * Sprawdza mieszkania z kończącymi się umowami i wysyła powiadomienia email.
 * Run with: npm run check-leases
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Apartment from '../models/Apartment.js';
import User from '../models/User.js';
import { sendEmail, createExpiringLeaseEmail } from '../services/email.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci';

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

    // Pobierz wszystkich użytkowników (manager/admin) do powiadomień
    const users = await User.find({}).select('email name').lean();
    if (users.length === 0) {
      console.log('Brak użytkowników do powiadomień.');
      process.exit(0);
      return;
    }

    // Przygotuj email
    const { subject, html, text } = createExpiringLeaseEmail(expiring);
    const recipientEmails = users.map((u) => u.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      console.log('Brak adresów email użytkowników.');
      process.exit(0);
      return;
    }

    console.log(`Wysyłanie powiadomień do ${recipientEmails.length} użytkowników...`);

    // Wyślij email
    const result = await sendEmail({
      to: recipientEmails,
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
