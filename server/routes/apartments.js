import express from 'express';
import Apartment from '../models/Apartment.js';

const router = express.Router();

// GET /api/apartments
router.get('/', async (req, res) => {
  try {
    const apartments = await Apartment.find()
      .sort({ updatedAt: -1 })
      .lean();
    res.json(apartments);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd pobierania mieszkań.' });
  }
});

// GET /api/apartments/:id
router.get('/:id', async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id).lean();
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }
    res.json(apartment);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd pobierania mieszkania.' });
  }
});

// POST /api/apartments
router.post('/', async (req, res) => {
  try {
    const apartment = await Apartment.create({
      ...req.body,
      // W trybie bez logowania pole createdBy zostawiamy puste
      createdBy: null,
    });
    res.status(201).json(apartment);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Błąd dodawania mieszkania.' });
  }
});

// PUT /api/apartments/:id
router.put('/:id', async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Błąd aktualizacji mieszkania.' });
  }
});

// DELETE /api/apartments/:id
router.delete('/:id', async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndDelete(req.params.id);
    if (!apartment) {
      return res.status(404).json({ message: 'Mieszkanie nie znalezione.' });
    }
    res.json({ message: 'Mieszkanie usunięte.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd usuwania mieszkania.' });
  }
});

export default router;
