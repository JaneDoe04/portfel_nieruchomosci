import express from "express";
import Apartment from "../models/Apartment.js";

const router = express.Router();

// GET /api/apartments
router.get("/", async (req, res) => {
	try {
		// Sortujemy po dacie utworzenia rosnąco, żeby kolejność mieszkań była stabilna
		// i nie zmieniała się przy każdej edycji (ułatwia ogarnianie listy).
		const apartments = await Apartment.find().sort({ createdAt: 1 }).lean();
		res.json(apartments);
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd pobierania mieszkań." });
	}
});

// GET /api/apartments/:id
router.get("/:id", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.id).lean();
		if (!apartment) {
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
router.post("/", async (req, res) => {
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
			address: address || req.body.address, // Upewnij się że address jest ustawione
			// W trybie bez logowania pole createdBy zostawiamy puste
			createdBy: null,
		});
		res.status(201).json(apartment);
	} catch (err) {
		res
			.status(400)
			.json({ message: err.message || "Błąd dodawania mieszkania." });
	}
});

// PUT /api/apartments/:id
router.put("/:id", async (req, res) => {
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
		if (req.body.availableFrom) {
			if (
				typeof req.body.availableFrom === "string" &&
				req.body.availableFrom.trim()
			) {
				// String w formacie YYYY-MM-DD -> konwertuj na Date
				const dateParts = req.body.availableFrom.split("-");
				if (dateParts.length === 3) {
					updateData.availableFrom = new Date(
						parseInt(dateParts[0]),
						parseInt(dateParts[1]) - 1, // Miesiące są 0-indexowane
						parseInt(dateParts[2]),
					);
				} else {
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

		const apartment = await Apartment.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true, runValidators: true },
		);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		// Loguj co zostało zapisane
		console.log("[apartments/PUT] Apartment after update:", {
			id: apartment._id.toString(),
			availableFrom: apartment.availableFrom,
			availableFromType: typeof apartment.availableFrom,
			availableFromISO: apartment.availableFrom
				? apartment.availableFrom.toISOString()
				: null,
		});
		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		res.json(apartment);
	} catch (err) {
		res
			.status(400)
			.json({ message: err.message || "Błąd aktualizacji mieszkania." });
	}
});

// DELETE /api/apartments/:id
router.delete("/:id", async (req, res) => {
	try {
		const apartment = await Apartment.findByIdAndDelete(req.params.id);
		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}
		res.json({ message: "Mieszkanie usunięte." });
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd usuwania mieszkania." });
	}
});

export default router;
