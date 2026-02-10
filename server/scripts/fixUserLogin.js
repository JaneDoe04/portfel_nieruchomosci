/**
 * Ustawia pole login użytkownika i poprawia email (z "RadoslawDziubek123" na prawdziwy email).
 * Uruchom: npm run fix-user-login (z folderu server).
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfel-nieruchomosci';

async function fix() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    // Znajdź użytkownika po starym emailu lub po _id z bazy
    const user = await User.findOne({
      $or: [
        { email: 'radoslawdziubek123' },
        { email: 'RadoslawDziubek123' },
        { _id: new mongoose.Types.ObjectId('698531e1d5b5ad361b6f5be1') },
      ],
    });
    if (!user) {
      console.log('Nie znaleziono użytkownika do poprawki.');
      process.exit(1);
    }
    user.login = 'RadoslawDziubek123';
    user.email = 'radoslawdziubek123@portfel.local';
    await user.save();
    console.log('OK: ustawiono login=RadoslawDziubek123, email=radoslawdziubek123@portfel.local dla', user._id);
  } catch (err) {
    console.error('Błąd:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fix();
