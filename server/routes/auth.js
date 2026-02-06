import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, login } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Podaj email i hasło.' });
    }
    const exists = await User.findOne({ $or: [{ email }, ...(login ? [{ login }] : [])] });
    if (exists) {
      return res.status(400).json({ message: 'Ten adres email lub login jest już używany.' });
    }
    const user = await User.create({ email, password, name: name || email, ...(login && { login }) });
    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd rejestracji.' });
  }
});

// POST /api/auth/login – akceptuje login lub email
router.post('/login', async (req, res) => {
  try {
    const { email, login, password } = req.body;
    const loginOrEmail = login || email;
    if (!loginOrEmail || !password) {
      return res.status(400).json({ message: 'Podaj login (lub e-mail) i hasło.' });
    }
    const isEmail = loginOrEmail.includes('@');
    const user = await User.findOne(
      isEmail ? { email: loginOrEmail.toLowerCase() } : { login: loginOrEmail }
    ).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło.' });
    }
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

export default router;
