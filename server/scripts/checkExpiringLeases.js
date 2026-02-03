/**
 * Placeholder script: check for apartments with expiring lease contracts.
 * Run with: npm run check-leases
 * In the future: send notifications, update status to WOLNE, etc.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Apartment from '../models/Apartment.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci';

async function checkExpiringLeases() {
  try {
    await mongoose.connect(MONGODB_URI);
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

    // Future: send email/Slack, update status, etc.
  } catch (err) {
    console.error('Błąd:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

checkExpiringLeases();
