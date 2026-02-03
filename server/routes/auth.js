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
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Podaj email i hasło.' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Ten adres email jest już używany.' });
    }
    const user = await User.create({ email, password, name: name || email });
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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Podaj email i hasło.' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Nieprawidłowy email lub hasło.' });
    }
    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
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

export default router;
