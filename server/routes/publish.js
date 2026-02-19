import express from "express";
import axios from "axios";
import Apartment from "../models/Apartment.js";
import ApiCredentials from "../models/ApiCredentials.js";
import { protect } from "../middleware/auth.js";
import {
	publishOlxAdvert,
	updateOlxAdvert,
	deleteOlxAdvert,
} from "../services/publishers/olxApi.js";
import {
	publishOtodomAdvert,
	updateOtodomAdvert,
	deleteOtodomAdvert,
	getOtodomAdvertStatus,
	getOtodomAccessToken,
} from "../services/publishers/otodomApi.js";

const router = express.Router();

/**
 * Automatyczne sprawdzanie statusu ogłoszenia przez API z retry
 * Fallback jeśli webhook nie przyjdzie
 */
async function checkOtodomStatusWithRetry(
	apartmentId,
	transactionId,
	userId,
	maxAttempts = 3,
) {
	const delays = [10000, 30000, 60000]; // 10s, 30s, 60s

	for (
		let attempt = 0;
		attempt < maxAttempts && attempt < delays.length;
		attempt++
	) {
		const delay = delays[attempt];

		setTimeout(async () => {
			try {
				console.log(
					`[publish/otodom] 🔍 Checking status via API (attempt ${attempt + 1}/${maxAttempts}) for transaction_id: ${transactionId}`,
				);

				// Sprawdź czy mieszkanie nadal ma transaction_id (jeśli webhook już przyszedł, będzie object_id)
				const apartment = await Apartment.findById(apartmentId);
				if (!apartment) {
					console.log(
						"[publish/otodom] Apartment not found, stopping status check",
					);
					return;
				}

				const currentExternalId = apartment.externalIds?.otodom;
				const isStillTransactionId = currentExternalId === transactionId;

				if (!isStillTransactionId) {
					console.log(
						"[publish/otodom] ✅ Apartment already updated (webhook came or manual update), stopping status check",
					);
					return;
				}

				// Spróbuj sprawdzić status przez API używając transaction_id
				// UWAGA: transaction_id może nie działać do sprawdzania statusu - może potrzebować object_id
				// Ale spróbujmy najpierw transaction_id, a jeśli nie zadziała, będziemy musieli poczekać na webhook
				try {
					const statusResult = await getOtodomAdvertStatus(
						transactionId,
						userId,
					);
					const statusData = statusResult.data;

					// Jeśli mamy object_id w odpowiedzi, zaktualizuj mieszkanie
					if (statusData?.uuid || statusData?.object_id) {
						const objectId = statusData.uuid || statusData.object_id;
						const oldValue = apartment.externalIds?.otodom;

						apartment.externalIds = apartment.externalIds || {};
						apartment.externalIds.otodom = objectId;

						// Zapisz URL jeśli jest dostępny
						if (statusData?.url) {
							apartment.externalIds.otodomUrl = statusData.url;
						}

						await apartment.save();

						console.log(
							"[publish/otodom] ✅ Status check successful - updated apartment via API",
						);
						console.log("[publish/otodom] ✅ Old externalId:", oldValue);
						console.log("[publish/otodom] ✅ New object_id:", objectId);
						console.log(
							"[publish/otodom] ✅ Advert URL:",
							statusData?.url || "not provided",
						);
						return; // Sukces, przestań próbować
					} else {
						console.log(
							"[publish/otodom] ⏳ Status check: advert still processing, last_action_status:",
							statusData?.last_action_status,
						);
					}
				} catch (apiError) {
					// Jeśli błąd "not found", ogłoszenie może jeszcze być w trakcie publikacji
					const errorMsg = apiError.message?.toLowerCase() || "";
					if (errorMsg.includes("not found") || errorMsg.includes("advert")) {
						console.log(
							"[publish/otodom] ⏳ Status check: advert not found yet (still processing), will retry",
						);
					} else {
						console.error(
							"[publish/otodom] ❌ Status check API error:",
							apiError.message,
						);
					}
				}
			} catch (err) {
				console.error(
					"[publish/otodom] ❌ Error in status check retry:",
					err.message,
				);
			}
		}, delay);
	}
}

// Wszystkie endpointy wymagają autoryzacji
router.use(protect);

/**
 * POST /api/publish/:apartmentId/olx
 * Opublikuj mieszkanie na OLX
 */
router.post("/:apartmentId/olx", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		if (apartment.status !== "WOLNE") {
			return res.status(400).json({
				message: "Można publikować tylko mieszkania ze statusem WOLNE.",
			});
		}

		const result = await publishOlxAdvert(apartment, req.user._id);

		// Zaktualizuj externalIds w mieszkaniu
		apartment.externalIds = apartment.externalIds || {};
		apartment.externalIds.olx = result.url;
		await apartment.save();

		res.json({
			success: true,
			message: "Ogłoszenie opublikowane na OLX.",
			url: result.url,
			advertId: result.advertId,
		});
	} catch (err) {
		res.status(500).json({ message: err.message || "Błąd publikacji na OLX." });
	}
});

/**
 * PUT /api/publish/:apartmentId/olx
 * Zaktualizuj ogłoszenie na OLX
 */
router.put("/:apartmentId/olx", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const externalId = apartment.externalIds?.olx;
		if (!externalId) {
			return res.status(400).json({
				message: "Mieszkanie nie ma opublikowanego ogłoszenia na OLX.",
			});
		}

		// Wyciągnij ID z URL jeśli to pełny URL
		const advertId = externalId.includes("/")
			? externalId.split("/").pop()
			: externalId;

		await updateOlxAdvert(advertId, apartment, req.user._id);

		res.json({
			success: true,
			message: "Ogłoszenie zaktualizowane na OLX.",
		});
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd aktualizacji ogłoszenia na OLX." });
	}
});

/**
 * DELETE /api/publish/:apartmentId/olx
 * Usuń ogłoszenie z OLX
 */
router.delete("/:apartmentId/olx", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const externalId = apartment.externalIds?.olx;
		if (!externalId) {
			return res.status(400).json({
				message: "Mieszkanie nie ma opublikowanego ogłoszenia na OLX.",
			});
		}

		const advertId = externalId.includes("/")
			? externalId.split("/").pop()
			: externalId;

		await deleteOlxAdvert(advertId, req.user._id);

		// Usuń externalId z mieszkania
		apartment.externalIds = apartment.externalIds || {};
		apartment.externalIds.olx = null;
		await apartment.save();

		res.json({
			success: true,
			message: "Ogłoszenie usunięte z OLX.",
		});
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd usuwania ogłoszenia z OLX." });
	}
});

/**
 * POST /api/publish/:apartmentId/otodom
 * Opublikuj mieszkanie na Otodom
 */
router.post("/:apartmentId/otodom", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		if (apartment.status !== "WOLNE") {
			return res.status(400).json({
				message: "Można publikować tylko mieszkania ze statusem WOLNE.",
			});
		}

		const result = await publishOtodomAdvert(apartment, req.user._id);

		// Zaktualizuj externalIds w mieszkaniu
		// Jeśli mamy objectId z odpowiedzi API, używamy go od razu (nie czekamy na webhook)
		apartment.externalIds = apartment.externalIds || {};
		const objectId = result.objectId || result.transactionId || result.url;
		apartment.externalIds.otodom = objectId;

		// Zapisz URL jeśli jest dostępny
		if (result.url) {
			apartment.externalIds.otodomUrl = result.url;
		}

		await apartment.save();

		if (result.objectId) {
			console.log(
				"[publish/otodom] ✅ Saved object_id directly from API:",
				objectId,
				"for apartment:",
				apartment._id.toString(),
			);
			console.log(
				"[publish/otodom] ✅ No need to wait for webhook - object_id already available",
			);

			// Sprawdź status używając uuid (objectId) - może być w moderacji lub jeszcze przetwarzane
			// Status "TO_POST" oznacza że ogłoszenie jest w trakcie publikacji/moderacji
			console.log(
				"[publish/otodom] 🔍 Checking status using uuid:",
				result.objectId,
			);
			console.log(
				'[publish/otodom] ⚠️ NOTE: Status "TO_POST" means advert is being processed/moderated',
			);
			console.log(
				"[publish/otodom] ⚠️ Advert may not be visible on Otodom until moderation is complete",
			);
			console.log(
				"[publish/otodom] ⚠️ Webhook will notify when advert is published (event_type: advert_posted_success)",
			);

			// Sprawdź status po 5, 30 i 60 sekundach
			const apartmentId = apartment._id.toString();
			const objectIdToCheck = result.objectId;
			const userId = req.user._id;

			[5000, 30000, 60000].forEach((delay, index) => {
				setTimeout(async () => {
					try {
						const apartment = await Apartment.findById(apartmentId);
						if (!apartment) return;

						const statusResult = await getOtodomAdvertStatus(
							objectIdToCheck,
							userId,
						);
						const statusData = statusResult.data;

						console.log(`[publish/otodom] 📊 Status check ${index + 1}/3:`, {
							last_action_status: statusData?.last_action_status,
							state: statusData?.state,
							code: statusData?.state?.code,
							url: statusData?.url,
							visible_in_profile: statusData?.visible_in_profile,
						});

						// Jeśli status zmienił się z TO_POST na active, ogłoszenie jest opublikowane
						if (
							statusData?.state?.code === "active" ||
							statusData?.last_action_status === "POSTED"
						) {
							console.log(
								"[publish/otodom] ✅ Advert is now ACTIVE and should be visible on Otodom!",
							);

							// Zaktualizuj URL jeśli jest dostępny
							if (
								statusData?.url &&
								apartment.externalIds?.otodomUrl !== statusData.url
							) {
								apartment.externalIds.otodomUrl = statusData.url;
								await apartment.save();
								console.log(
									"[publish/otodom] ✅ Updated advert URL:",
									statusData.url,
								);
							}
						} else if (statusData?.last_action_status === "TO_POST") {
							console.log(
								"[publish/otodom] ⏳ Advert still in moderation (TO_POST) - waiting for approval...",
							);
						}
					} catch (statusError) {
						const errorMsg = statusError.message?.toLowerCase() || "";
						if (errorMsg.includes("not found")) {
							console.log(
								`[publish/otodom] ⏳ Status check ${index + 1}/3: Advert not found yet (still processing)`,
							);
						} else {
							console.error(
								`[publish/otodom] ⚠️ Status check ${index + 1}/3 error:`,
								statusError.message,
							);
						}
					}
				}, delay);
			});
		} else {
			console.log(
				"[publish/otodom] ✅ Saved transaction_id:",
				result.transactionId,
				"for apartment:",
				apartment._id.toString(),
			);
			console.log(
				"[publish/otodom] ⏳ Waiting for webhook with event_type: advert_posted_success",
			);
			console.log(
				"[publish/otodom] 📋 Webhook should update apartment with object_id when advert is published",
			);

			// Automatyczne sprawdzanie statusu przez API (fallback jeśli webhook nie przyjdzie)
			// Próbujemy sprawdzić status po 10, 30 i 60 sekundach
			checkOtodomStatusWithRetry(
				apartment._id.toString(),
				result.transactionId,
				req.user._id,
				3,
			);
		}

		res.json({
			success: true,
			message: "Ogłoszenie opublikowane na Otodom.",
			url: result.url,
			advertId: result.advertId,
		});
	} catch (err) {
		console.error("[publish/otodom] Error:", {
			message: err.message,
			stack: err.stack,
			apartmentId: req.params.apartmentId,
			userId: req.user._id,
		});
		const errorMessage = err.message || "Błąd publikacji na Otodom.";
		res.status(500).json({ message: errorMessage });
	}
});

/**
 * PUT /api/publish/:apartmentId/otodom
 * Zaktualizuj ogłoszenie na Otodom
 */
router.put("/:apartmentId/otodom", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const externalId = apartment.externalIds?.otodom;
		if (!externalId) {
			return res.status(400).json({
				message: "Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.",
			});
		}

		// externalId może być:
		// 1. object_id (prawdziwe ID ogłoszenia z webhooka) - używamy bezpośrednio
		// 2. transaction_id (tymczasowe ID z publikacji) - nie można aktualizować, webhook jeszcze nie przyszedł
		// 3. URL (stary format) - wyciągamy ID z URL

		let advertId = externalId;

		// Jeśli to URL, wyciągnij ID z końca URL-a
		if (externalId.includes("/")) {
			advertId = externalId.split("/").pop();
		}

		// UUID może być zarówno transaction_id jak i object_id z webhooka
		// Spróbujmy zaktualizować - jeśli to transaction_id, API zwróci błąd
		// Jeśli to object_id, operacja się powiedzie
		try {
			await updateOtodomAdvert(advertId, apartment, req.user._id);
		} catch (err) {
			// Jeśli błąd "not found" lub "invalid", może to być transaction_id
			const errorMsg = err.message?.toLowerCase() || "";
			if (
				errorMsg.includes("not found") ||
				errorMsg.includes("invalid") ||
				errorMsg.includes("advert")
			) {
				return res.status(400).json({
					message:
						"Ogłoszenie jest jeszcze w trakcie publikacji lub nie zostało jeszcze opublikowane. Poczekaj na potwierdzenie z Otodom lub sprawdź logi webhooków.",
				});
			}
			// Inny błąd - przekaż dalej
			throw err;
		}

		res.json({
			success: true,
			message: "Ogłoszenie zaktualizowane na Otodom.",
		});
	} catch (err) {
		res.status(500).json({
			message: err.message || "Błąd aktualizacji ogłoszenia na Otodom.",
		});
	}
});

/**
 * GET /api/publish/:apartmentId/otodom/status
 * Sprawdź status ogłoszenia na Otodom
 */
router.get("/:apartmentId/otodom/status", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const externalId = apartment.externalIds?.otodom;
		if (!externalId) {
			return res.status(400).json({
				message: "Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.",
			});
		}

		// Sprawdź czy to transaction_id (UUID format) - jeśli tak, spróbuj sprawdzić przez API
		const isTransactionId =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				externalId,
			);

		// Spróbuj sprawdzić status przez API (używając externalId - może być transaction_id lub uuid)
		try {
			const statusResult = await getOtodomAdvertStatus(
				externalId,
				req.user._id,
			);
			const statusData = statusResult.data;

			// Jeśli externalId to transaction_id, ale w odpowiedzi mamy uuid, zaktualizuj mieszkanie
			if (isTransactionId && (statusData?.uuid || statusData?.object_id)) {
				const objectId = statusData.uuid || statusData.object_id;
				apartment.externalIds = apartment.externalIds || {};
				apartment.externalIds.otodom = objectId;

				if (statusData?.url) {
					apartment.externalIds.otodomUrl = statusData.url;
				}

				await apartment.save();

				console.log(
					"[publish/otodom/status] ✅ Updated apartment via API check:",
					{
						apartmentId: apartment._id.toString(),
						oldTransactionId: externalId,
						newObjectId: objectId,
					},
				);

				return res.json({
					success: true,
					status: statusData,
					externalId: objectId,
					isTransactionId: false,
					message: "Status sprawdzony przez API - mieszkanie zaktualizowane.",
				});
			}

			// Zwróć status ogłoszenia
			return res.json({
				success: true,
				status: statusData,
				externalId,
				isTransactionId: isTransactionId,
				message:
					statusData?.state?.code === "active"
						? "Ogłoszenie jest aktywne i widoczne na Otodom."
						: statusData?.last_action_status === "TO_POST"
							? "Ogłoszenie jest w trakcie moderacji/publikacji. Poczekaj na zatwierdzenie przez Otodom."
							: `Status: ${statusData?.state?.code || statusData?.last_action_status || "Nieznany"}`,
			});
		} catch (apiError) {
			// Jeśli błąd "not found", może to być transaction_id który nie działa do sprawdzania statusu
			const errorMsg = apiError.message?.toLowerCase() || "";
			if (errorMsg.includes("not found") || errorMsg.includes("advert")) {
				if (isTransactionId) {
					return res.status(200).json({
						success: true,
						status: {
							transaction_id: externalId,
							last_action_status: "TO_POST",
							state: {
								code: "TO_POST",
								message:
									"Ogłoszenie jest w trakcie publikacji/moderacji. Transaction_id nie działa do sprawdzania statusu - poczekaj na webhook lub użyj uuid z odpowiedzi publikacji.",
							},
						},
						externalId,
						isTransactionId: true,
						message:
							"Ogłoszenie jest w trakcie publikacji. Transaction_id nie działa do sprawdzania statusu - sprawdź czy uuid został zapisany w mieszkaniu.",
					});
				}

				return res.status(200).json({
					success: true,
					status: {
						externalId,
						last_action_status: "UNKNOWN",
						state: {
							code: "NOT_FOUND",
							message:
								"Ogłoszenie nie znalezione przez API. Może być jeszcze w trakcie przetwarzania.",
						},
					},
					externalId,
					isTransactionId: false,
					message:
						"Ogłoszenie nie znalezione przez API. Może być jeszcze w trakcie przetwarzania lub zostało usunięte.",
				});
			}
			// Inny błąd - przekaż dalej
			throw apiError;
		}
	} catch (err) {
		res.status(500).json({
			message: err.message || "Błąd sprawdzania statusu ogłoszenia na Otodom.",
			error: err.message,
		});
	}
});

/**
 * DELETE /api/publish/:apartmentId/otodom
 * Usuń ogłoszenie z Otodom
 */
router.delete("/:apartmentId/otodom", async (req, res) => {
	try {
		const apartment = await Apartment.findById(req.params.apartmentId);

		if (!apartment) {
			return res.status(404).json({ message: "Mieszkanie nie znalezione." });
		}

		const externalId = apartment.externalIds?.otodom;
		if (!externalId) {
			return res.status(400).json({
				message: "Mieszkanie nie ma opublikowanego ogłoszenia na Otodom.",
			});
		}

		// externalId może być:
		// 1. object_id (prawdziwe ID ogłoszenia z webhooka) - używamy bezpośrednio
		// 2. transaction_id (tymczasowe ID z publikacji) - nie można usunąć, webhook jeszcze nie przyszedł
		// 3. URL (stary format) - wyciągamy ID z URL

		let advertId = externalId;

		// Jeśli to URL, wyciągnij ID z końca URL-a
		if (externalId.includes("/")) {
			// Format: https://www.otodom.pl/pl/oferta/{id} lub podobny
			advertId = externalId.split("/").pop();
		}

		// UUID może być zarówno transaction_id jak i object_id z webhooka
		// Spróbujmy usunąć - jeśli to transaction_id, API zwróci błąd
		// Jeśli to object_id, operacja się powiedzie
		try {
			await deleteOtodomAdvert(advertId, req.user._id);
		} catch (err) {
			// Jeśli błąd "not found" lub "invalid", może to być transaction_id
			const errorMsg = err.message?.toLowerCase() || "";
			if (
				errorMsg.includes("not found") ||
				errorMsg.includes("invalid") ||
				errorMsg.includes("advert")
			) {
				return res.status(400).json({
					message:
						"Ogłoszenie jest jeszcze w trakcie publikacji lub nie zostało jeszcze opublikowane. Poczekaj na potwierdzenie z Otodom lub sprawdź logi webhooków.",
				});
			}
			// Inny błąd - przekaż dalej
			throw err;
		}

		// Usuń externalId z mieszkania
		apartment.externalIds = apartment.externalIds || {};
		apartment.externalIds.otodom = null;
		await apartment.save();

		res.json({
			success: true,
			message: "Ogłoszenie usunięte z Otodom.",
		});
	} catch (err) {
		res
			.status(500)
			.json({ message: err.message || "Błąd usuwania ogłoszenia z Otodom." });
	}
});

/**
 * GET /api/publish/otodom/taxonomy
 * Pobierz atrybuty taksonomii dla kategorii apartments-for-rent z Otodom API
 */
router.get("/otodom/taxonomy", protect, async (req, res) => {
	try {
		const appCreds = await ApiCredentials.findOne({
			platform: "otodom",
			userId: null,
		}).lean();

		if (!appCreds?.apiKey) {
			return res.status(500).json({
				success: false,
				message: "Brak API KEY dla Otodom",
			});
		}

		const taxonomyUrl =
			"https://api.olxgroup.com/taxonomy/v1/category/urn:concept:apartments-for-rent/attributes";

		// Taxonomy API może wymagać tylko X-API-KEY (bez Bearer tokena)
		// Próbujemy najpierw tylko z X-API-KEY
		let response;
		try {
			response = await axios.get(taxonomyUrl, {
				headers: {
					"X-API-KEY": appCreds.apiKey,
					Accept: "application/json",
					"User-Agent": "PortfelNieruchomosci",
				},
				timeout: 10000,
			});
		} catch (firstError) {
			// Jeśli nie zadziała, spróbuj z Bearer tokenem
			if (
				firstError.response?.status === 401 ||
				firstError.response?.status === 403
			) {
				const accessToken = await getOtodomAccessToken(req.user._id);
				response = await axios.get(taxonomyUrl, {
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"X-API-KEY": appCreds.apiKey,
						Accept: "application/json",
						"User-Agent": "PortfelNieruchomosci",
					},
					timeout: 10000,
				});
			} else {
				throw firstError;
			}
		}

		const attributes = response.data;

		// Szukaj atrybutów związanych z czynszem i kaucją
		const searchTerms = [
			"deposit",
			"kaucja",
			"rent",
			"czynsz",
			"charge",
			"service",
		];
		const foundAttributes = [];

		const allAttrs = Array.isArray(attributes)
			? attributes
			: attributes.attributes || [];

		allAttrs.forEach((attr) => {
			const urn = attr.urn || "";
			const label = attr.label || "";
			const urnLower = urn.toLowerCase();
			const labelLower = label.toLowerCase();

			const matches = searchTerms.some(
				(term) => urnLower.includes(term) || labelLower.includes(term),
			);

			if (matches) {
				foundAttributes.push(attr);
			}
		});

		res.json({
			success: true,
			foundAttributes,
			allAttributes: allAttrs,
			totalCount: allAttrs.length,
		});
	} catch (error) {
		console.error(
			"[publish/otodom/taxonomy] Error:",
			error.response?.data || error.message,
		);
		res.status(error.response?.status || 500).json({
			success: false,
			message: error.response?.data?.message || error.message,
			error: error.response?.data,
		});
	}
});

export default router;
