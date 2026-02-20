import express from "express";
import Apartment from "../models/Apartment.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Tylko mieszkania należące do zalogowanego użytkownika
function isOwner(apartment, userId) {
	if (!apartment?.createdBy || !userId) return false;
	const createdBy = apartment.createdBy.toString ? apartment.createdBy.toString() : apartment.createdBy;
	const uid = userId.toString ? userId.toString() : userId;
	return createdBy === uid;
}

// GET /api/apartments – tylko mieszkania użytkownika
router.get("/", protect, async (req, res) => {
	try {
		const apartments = await Apartment.find({ createdBy: req.user._id })
			.sort({ createdAt: 1 })
			.lean();
		res.json(apartments);
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd pobierania mieszkań." });
	}
});

// GET /api/apartments/:id
router.get("/:id", protect, async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.id).lean();
		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		if (!isOwner(apartment, req.user._id)) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		res.json(apartment);
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd pobierania mieszkania." });
	}
});

// POST /api/apartments
router.post("/", protect, async (req, res) => {
	try {
		// Jeśli brakuje address, zbuduj go z nowych pól (street, streetNumber, postalCode, city)
		let address = req.body.address;
		if (!address && (req.body.street || req.body.city)) {
			const parts = [];
			if (req.body.street) {
				const streetWithNumber = req.body.streetNumber
					? `${req.body.street} ${req.body.streetNumber}`
					: req.body.street;
				parts.push(streetWithNumber);
			}
			if (req.body.postalCode || req.body.city) {
				const cityPart = [req.body.postalCode, req.body.city]
					.filter(Boolean)
					.join(" ");
				if (cityPart) parts.push(cityPart);
			}
			address = parts.join(", ") || req.body.city || "";
		}

		const apartment = await Apartment.create({
			...req.body,
			address: address || req.body.address,
			createdBy: req.user._id,
		});
		res.status(201).json(apartment);
	} catch (err) {
		res
			.status(400)
			.json({ message: err.message || "Błąd dodawania mieszkania." });
	}
});

// PUT /api/apartments/:id
router.put("/:id", protect, async (req, res) => {
	try {
		// Jeśli brakuje address, zbuduj go z nowych pól (street, streetNumber, postalCode, city)
		let address = req.body.address;
		if (!address && (req.body.street || req.body.city)) {
			const parts = [];
			if (req.body.street) {
				const streetWithNumber = req.body.streetNumber
					? `${req.body.street} ${req.body.streetNumber}`
					: req.body.street;
				parts.push(streetWithNumber);
			}
			if (req.body.postalCode || req.body.city) {
				const cityPart = [req.body.postalCode, req.body.city]
					.filter(Boolean)
					.join(" ");
				if (cityPart) parts.push(cityPart);
			}
			address = parts.join(", ") || req.body.city || "";
		}

		// Przygotuj updateData - upewnij się że availableFrom jest poprawnie sformatowane
		const updateData = {
			...req.body,
			...(address && { address }), // Zaktualizuj address tylko jeśli został zbudowany
		};

		// Konwertuj availableFrom na Date object jeśli jest stringiem (format YYYY-MM-DD)
		// WAŻNE: Używamy UTC żeby uniknąć problemów ze strefą czasową (data nie powinna się zmieniać)
		if (req.body.availableFrom) {
			if (
				typeof req.body.availableFrom === "string" &&
				req.body.availableFrom.trim()
			) {
				// String w formacie YYYY-MM-DD -> konwertuj na Date używając UTC
				const dateParts = req.body.availableFrom.split("-");
				if (dateParts.length === 3) {
					// Używamy Date.UTC żeby uniknąć problemów ze strefą czasową
					// To gwarantuje że data YYYY-MM-DD zostanie zapisana jako dokładnie ta data w UTC
					updateData.availableFrom = new Date(
						Date.UTC(
							parseInt(dateParts[0]),
							parseInt(dateParts[1]) - 1, // Miesiące są 0-indexowane
							parseInt(dateParts[2]),
						),
					);
				} else {
					// Jeśli format jest inny, spróbuj sparsować jako ISO string
					updateData.availableFrom = new Date(req.body.availableFrom);
				}
			} else {
				updateData.availableFrom = req.body.availableFrom;
			}
		} else if (
			req.body.hasOwnProperty("availableFrom") &&
			!req.body.availableFrom
		) {
			// Jeśli explicitly ustawiono na null/undefined/pusty string, zapisz jako null
			updateData.availableFrom = null;
		}

		// Loguj co przychodzi w req.body (dla debugowania)
		console.log("[apartments/PUT] Update data:", {
			id: req.params.id,
			availableFromRaw: req.body.availableFrom,
			availableFromProcessed: updateData.availableFrom,
			availableFromType: typeof updateData.availableFrom,
			allFields: Object.keys(req.body),
		});

		const existing = await Apartment.findById(req.params.id);
		if (!existing) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		if (!isOwner(existing, req.user._id)) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const apartment = await Apartment.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true, runValidators: true },
		);

		// Loguj co zostało zapisane
		console.log("[apartments/PUT] Apartment after update:", {
			id: apartment._id.toString(),
			availableFrom: apartment.availableFrom,
			availableFromType: typeof apartment.availableFrom,
			availableFromISO: apartment.availableFrom
				? apartment.availableFrom.toISOString()
				: null,
		});
		res.json(apartment);
	} catch (err) {
		res
			.status(400)
			.json({ message: err.message || "Błąd aktualizacji mieszkania." });
	}
});

// DELETE /api/apartments/:id
router.delete("/:id", protect, async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.id);
		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		if (!isOwner(apartment, req.user._id)) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		await Apartment.findByIdAndDelete(req.params.id);
		res.json({ message: "Mieszkanie usunięte." });
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd usuwania mieszkania." });
	}
});

export default router;
