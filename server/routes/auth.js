import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/login – tylko login + hasło (bez rejestracji w aplikacji)
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ message: 'Podaj login i hasło.' });
    }
    console.log('[auth] Login attempt', { login });
    const user = await User.findOne({ login }).select('+password');
    if (!user) {
      console.log('[auth] User not found for login', login);
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło.' });
    }
    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      console.log('[auth] Password mismatch for user', user._id.toString());
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło.' });
    }
    console.log('[auth] Login OK', { userId: user._id.toString() });
    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      login: user.login,
      role: user.role,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd logowania.' });
  }
});

// GET /api/auth/me (protected)
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

// PATCH /api/auth/me (protected) – aktualizacja name, login
router.patch('/me', protect, async (req, res) => {
  try {
    const { name, login } = req.body;
    const upd = {};
    if (name !== undefined) upd.name = name;
    if (login !== undefined) upd.login = login;
    const user = await User.findByIdAndUpdate(req.user._id, upd, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd aktualizacji.' });
  }
});

// POST /api/auth/fix-login – ustawia pole login i email (wymaga SEED_SECRET)
router.post('/fix-login', async (req, res) => {
  try {
    const secret = req.body?.secret || req.query?.secret;
    if (secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ message: 'Brak uprawnień.' });
    }
    const user = await User.findOne({
      $or: [
        { email: 'radoslawdziubek123' },
        { email: 'RadoslawDziubek123' },
        { _id: new mongoose.Types.ObjectId('698531e1d5b5ad361b6f5be1') },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
    }
    user.login = 'RadoslawDziubek123';
    user.email = 'radoslawdziubek123@portfel.local';
    await user.save();
    res.json({ message: 'OK: ustawiono login i email.', ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd.' });
  }
});

// POST /api/auth/seed – jednorazowe dodanie użytkownika (wymaga SEED_SECRET w env)
router.post('/seed', async (req, res) => {
  try {
    const secret = req.body?.secret || req.query?.secret;
    if (secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ message: 'Brak uprawnień.' });
    }
    const existing = await User.findOne({ login: 'RadoslawDziubek123' });
    if (existing) {
      return res.json({ message: 'Użytkownik RadoslawDziubek123 już istnieje.', ok: true });
    }
    await User.create({
      email: 'radoslawdziubek123@portfel.local',
      login: 'RadoslawDziubek123',
      password: 'Landlord123',
      name: 'Radosław',
      role: 'manager',
    });
    res.status(201).json({ message: 'Utworzono użytkownika: RadoslawDziubek123 / Landlord123', ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd seed.' });
  }
});

// POST /api/auth/make-admin – podniesienie roli użytkownika do admin (wymaga SEED_SECRET)
router.post('/make-admin', async (req, res) => {
  try {
    const secret = req.body?.secret || req.query?.secret;
    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ message: 'Brak uprawnień.' });
    }

    const { login, email, userId } = req.body || {};
    if (!login && !email && !userId) {
      return res.status(400).json({ message: 'Podaj login, email lub userId użytkownika do awansu.' });
    }

    const query = [];
    if (login) query.push({ login });
    if (email) query.push({ email });
    if (userId) query.push({ _id: new mongoose.Types.ObjectId(userId) });

    const user = await User.findOne({ $or: query }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
    }

    user.role = 'admin';
    await user.save();

    res.json({ ok: true, message: `OK: użytkownik ${user.login || user.email} ma teraz rolę admin.` });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd make-admin.' });
  }
});

export default router;
