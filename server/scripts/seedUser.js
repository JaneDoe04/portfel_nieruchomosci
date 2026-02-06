/**
 * Dodaje przykładowego użytkownika do bazy (login: RadoslawDziubek123, hasło: Landlord123).
 * Uruchom: node scripts/seedUser.js (z folderu server, z załadowanym .env)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const existing = await User.findOne({ login: 'RadoslawDziubek123' });
    if (existing) {
      console.log('Użytkownik RadoslawDziubek123 już istnieje. Koniec.');
      process.exit(0);
      return;
    }
    await User.create({
      email: 'radoslawdziubek123@portfel.local',
      login: 'RadoslawDziubek123',
      password: 'Landlord123',
      name: 'Radosław',
      role: 'manager',
    });
    console.log('Utworzono użytkownika: login RadoslawDziubek123, hasło Landlord123');
  } catch (err) {
    console.error('Błąd seed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
