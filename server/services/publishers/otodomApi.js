/**
 * Otodom API integration service.
 * Obsługuje OAuth 2.0 autoryzację i publikację ogłoszeń przez Otodom API.
 *
 * Otodom używa OLX Group API (ten sam system co OLX, ale inne endpointy).
 * Dokumentacja: https://developer.olxgroup.com/
 */

import axios from "axios";
import ApiCredentials from "../../models/ApiCredentials.js";

// Otodom używa OLX Group API (nie własnego API na otodom.pl)
const OTODOM_API_BASE = "https://api.olxgroup.com/advert/v1";
const OTODOM_OAUTH_TOKEN_URL = "https://api.olxgroup.com/oauth/v1/token";
const OTODOM_LOCATIONS_BASE =
	"https://api.olxgroup.com/locations/v1/urn:site:otodompl";
const OTODOM_SITE_URN = "urn:site:otodompl"; // Site URN dla Otodom

const OTODOM_TEST_PREFIX = "[qatest-mercury]";
const OTODOM_TEST_DESCRIPTION =
	"Czasami musimy dodać takie ogłoszenie, żeby zweryfikować działanie niektórych funkcji systemu. Liczymy na Twoją wyrozumiałość  Radzimy skorzystać ponownie z naszej wyszukiwarki ofert.<br/><br/> Powodzenia w dalszych poszukiwaniach!";

const isTestMode = () =>
	String(process.env.OTODOM_TEST_MODE || "").toLowerCase() === "true";

/**
 * Konwertuj relatywne ścieżki zdjęć na pełne URL-e dla Otodom API
 * OLX Group API wymaga tablicy obiektów z właściwością 'url'
 */
function normalizeImageUrls(photos) {
	if (!Array.isArray(photos) || photos.length === 0) return [];

	const baseUrl =
		process.env.CLIENT_ORIGIN || "https://portfel-nieruchomosci.onrender.com";

	return photos
		.map((photo) => {
			if (!photo) return null;
			let url = String(photo).trim();
			// Jeśli już jest pełny URL (http/https), zwróć bez zmian
			if (/^https?:\/\//i.test(url)) {
				return { url };
			}
			// Jeśli zaczyna się od /uploads, dodaj base URL
			if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
				const cleanPath = url.startsWith("/") ? url : `/${url}`;
				url = `${baseUrl}${cleanPath}`;
			}
			// Zwróć jako obiekt z właściwością 'url' (wymagane przez OLX Group API)
			return { url };
		})
		.filter(Boolean);
}

async function getOtodomAppCredentials() {
	const appCreds = await ApiCredentials.findOne({
		platform: "otodom",
		userId: null,
	}).lean();
	if (!appCreds?.clientId || !appCreds?.clientSecret) {
		throw new Error(
			"Brak app-level credentials dla Otodom (clientId/clientSecret). Uzupełnij w Ustawieniach API.",
		);
	}
	if (!appCreds?.apiKey) {
		throw new Error(
			"Brak API KEY (X-API-KEY) dla Otodom. Uzupełnij w Ustawieniach API.",
		);
	}
	return appCreds;
}

function buildTestSafeTitle(rawTitle) {
	const base = (rawTitle || "").trim() || "Test ogłoszenia";
	if (base.toLowerCase().startsWith(OTODOM_TEST_PREFIX.toLowerCase()))
		return base;
	return `${OTODOM_TEST_PREFIX} ${base}`;
}

const cityIdCache = new Map(); // key: city name lower → id number

function parseStreetNameFromAddress(address) {
	if (!address) return "";
	const firstPart = String(address).split(",")[0]?.trim() || "";
	// remove common prefixes and numbers
	return firstPart
		.replace(/^(ul\.|al\.|aleja|pl\.|os\.)\s*/i, "")
		.replace(/\s+\d+[a-zA-Z]?(\s*\/\s*\d+)?\s*$/i, "")
		.trim();
}

function parseCityFromAddress(address) {
	if (!address) return "";
	const parts = String(address)
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	const tail = parts[parts.length - 1] || "";
	// try to strip postal code like 00-001
	return tail.replace(/\b\d{2}-\d{3}\b/g, "").trim();
}

async function resolveCityIdByName(apiKey, cityName) {
	const name = (cityName || "").trim();
	if (!name) return null;
	const key = name.toLowerCase();
	if (cityIdCache.has(key)) return cityIdCache.get(key);

	const url = `${OTODOM_LOCATIONS_BASE}/cities?search=${encodeURIComponent(name)}&exact=true&no-districts=1&limit=5`;
	const { data } = await axios.get(url, {
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"X-API-KEY": apiKey,
			"User-Agent": "PortfelNieruchomosci",
		},
		timeout: 10000,
	});

	const first = Array.isArray(data?.data) ? data.data[0] : null;
	const id = first?.id != null ? Number(first.id) : null;
	if (id != null && !Number.isNaN(id)) {
		cityIdCache.set(key, id);
		return id;
	}
	return null;
}

/**
 * Geokoduj ulicę używając Otodom Locations API (preferowane)
 * @param {string} apiKey - X-API-KEY dla Otodom
 * @param {number} cityId - ID miasta z Otodom
 * @param {string} streetName - Nazwa ulicy
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
async function resolveLatLonWithOtodomAPI(apiKey, cityId, streetName) {
	if (!apiKey || !cityId || !streetName) return null;
	
	try {
		// Otodom Locations API: wyszukaj ulicę w mieście
		const url = `${OTODOM_LOCATIONS_BASE}/streets?city_id=${cityId}&search=${encodeURIComponent(streetName)}&limit=1`;
		const { data } = await axios.get(url, {
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"X-API-KEY": apiKey,
				"User-Agent": "PortfelNieruchomosci",
			},
			timeout: 10000,
		});

		const streets = Array.isArray(data?.data) ? data.data : [];
		const first = streets[0];
		
		// Otodom Locations API zwraca lat/lon dla ulicy
		if (first?.lat != null && first?.lon != null) {
			return {
				lat: Number(first.lat),
				lon: Number(first.lon),
			};
		}
		
		// Jeśli ulica ma centroid (środek), użyj go
		if (first?.centroid?.lat != null && first?.centroid?.lon != null) {
			return {
				lat: Number(first.centroid.lat),
				lon: Number(first.centroid.lon),
			};
		}
		
		return null;
	} catch (e) {
		console.warn("[otodom/geocode] Otodom API geocode failed", {
			cityId,
			streetName,
			err: e.message,
		});
		return null;
	}
}

async function resolveLatLonWithNominatim(address) {
	// Nominatim jest zawsze dostępny (publiczne API), nie wymaga zmiennej środowiskowej
	// Używamy go jako głównej metody geokodowania, bo daje dokładne współrzędne dla konkretnych adresów
	if (!address) return null;
	
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}&countrycodes=pl`;
		const { data } = await axios.get(url, {
			headers: {
				"User-Agent": "PortfelNieruchomosci/1.0 (otodom integration)",
				"Accept-Language": "pl",
			},
			timeout: 15000,
		});
		const first = Array.isArray(data) ? data[0] : null;
		if (!first?.lat || !first?.lon) return null;
		return { lat: Number(first.lat), lon: Number(first.lon) };
	} catch (e) {
		console.warn("[otodom/geocode] Nominatim error", e.message);
		return null;
	}
}

async function buildOtodomLocation(apartment) {
	// Pobierz API key dla Otodom Locations API
	const appCreds = await ApiCredentials.findOne({
		platform: "otodom",
		userId: null,
	}).lean();
	const apiKey = appCreds?.apiKey;

	// street_name: preferuj nowe pola (street), potem streetName, potem parsuj z address
	let streetName = null;
	if (apartment.street && apartment.street.trim()) {
		// Użyj pola street (bez prefiksów typu "ul.", "al.")
		streetName = apartment.street.trim();
	} else if (apartment.streetName && apartment.streetName.trim()) {
		// Fallback na stare pole streetName
		streetName = apartment.streetName.trim();
	} else if (apartment.address) {
		// Ostateczny fallback: parsuj z address (kompatybilność wsteczna)
		const parsedStreetName = parseStreetNameFromAddress(apartment.address);
		streetName = parsedStreetName && parsedStreetName.trim() ? parsedStreetName.trim() : null;
	}

	// city: preferuj nowe pole city, potem parsuj z address
	let cityName = null;
	if (apartment.city && apartment.city.trim()) {
		cityName = apartment.city.trim();
	} else if (apartment.address) {
		cityName = parseCityFromAddress(apartment.address);
	}

	console.log("[otodom/location] Building location", {
		address: apartment.address,
		street: apartment.street,
		streetNumber: apartment.streetNumber,
		city: apartment.city,
		postalCode: apartment.postalCode,
		streetNameFromModel: apartment.streetName,
		finalStreetName: streetName,
		finalCityName: cityName,
		lat: apartment.lat,
		lon: apartment.lon,
		cityId: apartment.cityId,
	});

	// city_id: if not provided, resolve via OLX Group Locations API using X-API-KEY
	let cityId = apartment.cityId != null ? Number(apartment.cityId) : null;
	if ((!cityId || Number.isNaN(cityId)) && apiKey && cityName) {
		try {
			cityId = await resolveCityIdByName(apiKey, cityName);
		} catch (e) {
			console.warn("[otodom/location] city resolve failed", {
				cityName,
				err: e.message,
			});
		}
	}
	if (!cityId || Number.isNaN(cityId)) {
		cityId = 26; // fallback Warszawa
	}

	// lat/lon: preferuj wartości z mieszkania, jeśli są podane
	let lat = apartment.lat != null ? Number(apartment.lat) : null;
	let lon = apartment.lon != null ? Number(apartment.lon) : null;

	// Jeśli brakuje lat/lon, geokoduj używając pełnego adresu (z numerem ulicy)
	// To da nam dokładne współrzędne dla konkretnego adresu, nie tylko środek ulicy
	if ((lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon))) {
		// Buduj pełny adres do geokodowania (z numerem ulicy dla dokładności)
		let fullAddressForGeocode = null;
		if (apartment.street && apartment.city) {
			// Użyj nowych pól: ulica + numer + miasto
			const parts = [];
			if (apartment.street) {
				const streetWithNumber = apartment.streetNumber
					? `${apartment.street} ${apartment.streetNumber}`
					: apartment.street;
				parts.push(streetWithNumber);
			}
			if (apartment.city) {
				parts.push(apartment.city);
			}
			fullAddressForGeocode = parts.join(', ');
		} else if (apartment.address) {
			// Fallback na stare pole address
			fullAddressForGeocode = apartment.address;
		}

		// Najpierw spróbuj Nominatim z pełnym adresem (zawiera numer ulicy) - daje dokładniejsze współrzędne
		if (fullAddressForGeocode) {
			try {
				const geo = await resolveLatLonWithNominatim(fullAddressForGeocode);
				if (geo?.lat && geo?.lon) {
					lat = geo.lat;
					lon = geo.lon;
					console.log("[otodom/location] Geocoded via Nominatim (full address)", {
						address: fullAddressForGeocode,
						lat,
						lon,
					});
				}
			} catch (e) {
				console.warn("[otodom/geocode] Nominatim failed", e.message);
			}
		}

		// Fallback: jeśli Nominatim nie zadziałał, użyj Otodom Locations API (tylko nazwa ulicy - mniej dokładne)
		if ((lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) && apiKey && cityId && streetName) {
			try {
				const geo = await resolveLatLonWithOtodomAPI(apiKey, cityId, streetName);
				if (geo?.lat && geo?.lon) {
					lat = geo.lat;
					lon = geo.lon;
					console.log("[otodom/location] Geocoded via Otodom API (street only - less precise)", {
						cityId,
						streetName,
						lat,
						lon,
					});
				}
			} catch (e) {
				console.warn("[otodom/geocode] Otodom API geocode failed", e.message);
			}
		}
	}

	// Ostateczny fallback: centrum Warszawy (tylko jeśli wszystko inne zawiodło)
	if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
		console.warn("[otodom/location] Using fallback coordinates (Warsaw center)");
		lat = 52.2297;
		lon = 21.0122;
	}

	// Upewnij się, że streetName jest ustawione (wymagane przez Otodom)
	const finalStreetName = (streetName && streetName.trim()) || "Świętokrzyska"; // fallback

	// Otodom WYMAGA custom_fields z city_id i street_name (oba razem)
	// Zgodnie z dokumentacją: "Nazwa ulicy (street_name) powinna być zawsze przesłana wraz z numerem ID miejscowości (city_id)"
	const finalCityId = cityId && !Number.isNaN(cityId) ? Number(cityId) : 26; // fallback Warszawa

	// OLX Group API wymaga location z lat/lon/exact + custom_fields (oba pola razem)
	// WAŻNE: Otodom może używać własnego geokodowania na podstawie street_name + city_id,
	// więc upewnijmy się że mamy dokładne dane
	const location = {
		exact: true,
		lat: Number(lat),
		lon: Number(lon),
		custom_fields: {
			city_id: finalCityId,
			street_name: finalStreetName,
			// Dodaj kod pocztowy jeśli dostępny (może pomóc w dokładniejszym geokodowaniu)
			...(apartment.postalCode && apartment.postalCode.trim() && {
				postal_code: apartment.postalCode.trim(),
			}),
		},
	};

	console.log("[otodom/location] Final location object:", JSON.stringify(location, null, 2));

	return location;
}

// Eksportuj buildOtodomLocation dla użycia w innych modułach (np. do zapisywania współrzędnych przed publikacją)
export { buildOtodomLocation };

/**
 * Pobierz lub odśwież access token dla Otodom dla KONKRETNEGO UŻYTKOWNIKA
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function getOtodomAccessToken(userId) {
	if (!userId) {
		throw new Error("UserId jest wymagany do pobrania tokenu Otodom.");
	}

	// Pobierz user-level credentials (zawierają tokeny użytkownika)
	const credentials = await ApiCredentials.findOne({
		platform: "otodom",
		userId,
	});

	if (!credentials || !credentials.isConfigured) {
		throw new Error(
			"Otodom API nie jest skonfigurowane dla tego użytkownika. Wymagana autoryzacja OAuth.",
		);
	}

	if (!credentials.isActive) {
		throw new Error(
			"Otodom API nie jest aktywne dla tego użytkownika. Wymagana autoryzacja OAuth.",
		);
	}

	// Jeśli token jest ważny, zwróć go
	if (
		credentials.accessToken &&
		credentials.tokenExpiresAt &&
		credentials.tokenExpiresAt > new Date()
	) {
		return credentials.accessToken;
	}

	// Jeśli mamy refresh token, użyj go do odświeżenia
	if (credentials.refreshToken) {
		try {
			// Refresh token przez OLX Group OAuth
			const appCreds = await getOtodomAppCredentials();
			const basic = Buffer.from(
				`${appCreds.clientId}:${appCreds.clientSecret}`,
				"utf8",
			).toString("base64");
			const response = await axios.post(
				OTODOM_OAUTH_TOKEN_URL,
				{
					grant_type: "refresh_token",
					refresh_token: credentials.refreshToken,
				},
				{
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						Authorization: `Basic ${basic}`,
						"X-API-KEY": appCreds.apiKey,
						"User-Agent": "PortfelNieruchomosci",
					},
					timeout: 15000,
				},
			);

			const { access_token, refresh_token, expires_in } = response.data;

			// Zaktualizuj credentials
			credentials.accessToken = access_token;
			if (refresh_token) credentials.refreshToken = refresh_token;
			credentials.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
			await credentials.save();

			return access_token;
		} catch (err) {
			console.error(
				"Błąd odświeżania tokenu Otodom:",
				err.response?.data || err.message,
			);
			throw new Error(
				"Nie udało się odświeżyć tokenu Otodom. Wymagana ponowna autoryzacja.",
			);
		}
	}

	throw new Error("Brak ważnego tokenu Otodom. Wymagana autoryzacja OAuth.");
}

/**
 * Buduj tablicę atrybutów dla Otodom API na podstawie danych mieszkania
 * @param {Object} apartment - Obiekt mieszkania z bazy danych
 * @returns {Array} - Tablica atrybutów zgodnych z taksonomią Otodom
 */
function buildOtodomAttributes(apartment) {
	const attributes = [];

	// 1. Metraż - WYMAGANY dla apartments-for-rent
	if (apartment.area != null && apartment.area > 0) {
		attributes.push({
			urn: "urn:concept:net-area-m2",
			value: String(apartment.area),
		});
	}

	// 2. Liczba pokoi - WYMAGANY dla apartments-for-rent
	let numberOfRooms =
		apartment.numberOfRooms != null ? Number(apartment.numberOfRooms) : null;
	if (!numberOfRooms || isNaN(numberOfRooms)) {
		const titleMatch = apartment.title?.match(/(\d+)[\s-]*pokoj/i);
		const extractedRooms = titleMatch ? parseInt(titleMatch[1], 10) : null;
		if (extractedRooms && extractedRooms >= 1 && extractedRooms <= 10) {
			numberOfRooms = extractedRooms;
		}
	}
	if (numberOfRooms != null && numberOfRooms >= 1 && numberOfRooms <= 10) {
		attributes.push({
			urn: "urn:concept:number-of-rooms",
			value: `urn:concept:${numberOfRooms}`,
		});
	} else if (numberOfRooms != null && numberOfRooms > 10) {
		attributes.push({
			urn: "urn:concept:number-of-rooms",
			value: "urn:concept:more",
		});
	}

	// 3. Rynek (market) - WYMAGANY dla apartments-for-rent
	attributes.push({
		urn: "urn:concept:market",
		value: "urn:concept:secondary",
	});

	// 4. Ogrzewanie (heating) - OPCJONALNE
	if (apartment.heating) {
		const heatingMap = {
			"boiler-room": "urn:concept:boiler-room",
			gas: "urn:concept:gas",
			electrical: "urn:concept:electrical",
			urban: "urn:concept:urban",
			other: "urn:concept:other",
			"tiled-stove": "urn:concept:tiled-stove",
		};
		const heatingUrn = heatingMap[apartment.heating];
		if (heatingUrn) {
			attributes.push({
				urn: "urn:concept:heating",
				value: heatingUrn,
			});
		}
	}

	// 5. Piętro (floor) - OPCJONALNE
	if (apartment.floor) {
		const floorMap = {
			cellar: "urn:concept:cellar",
			"ground-floor": "urn:concept:ground-floor",
			"1st-floor": "urn:concept:1st-floor",
			"2nd-floor": "urn:concept:2nd-floor",
			"3rd-floor": "urn:concept:3rd-floor",
			"4th-floor": "urn:concept:4th-floor",
			"5th-floor": "urn:concept:5th-floor",
			"6th-floor": "urn:concept:6th-floor",
			"7th-floor": "urn:concept:7th-floor",
			"8th-floor": "urn:concept:8th-floor",
			"9th-floor": "urn:concept:9th-floor",
			"10th-floor": "urn:concept:10th-floor",
			"11th-floor-and-above": "urn:concept:11th-floor-and-above",
			garret: "urn:concept:garret",
		};
		const floorUrn = floorMap[apartment.floor];
		if (floorUrn) {
			attributes.push({
				urn: "urn:concept:floor",
				value: floorUrn,
			});
		}
	}

	// 6. Stan wykończenia (status) - OPCJONALNE
	if (apartment.finishingStatus) {
		const statusMap = {
			"to-complete": "urn:concept:to-complete",
			"ready-to-use": "urn:concept:ready-to-use",
			"in-renovation": "urn:concept:in-renovation",
		};
		const statusUrn = statusMap[apartment.finishingStatus];
		if (statusUrn) {
			attributes.push({
				urn: "urn:concept:status",
				value: statusUrn,
			});
		}
	}

	// 7. Dostępne od (free-from) - OPCJONALNE
	if (apartment.availableFrom) {
		let availableFromDate;
		
		// Obsługa różnych formatów daty
		if (apartment.availableFrom instanceof Date) {
			availableFromDate = apartment.availableFrom;
		} else if (typeof apartment.availableFrom === 'string') {
			// Jeśli to string, spróbuj sparsować
			availableFromDate = new Date(apartment.availableFrom);
		} else {
			availableFromDate = new Date(apartment.availableFrom);
		}
		
		if (!isNaN(availableFromDate.getTime())) {
			const formattedDate = availableFromDate.toISOString().split("T")[0];
			console.log("[otodom/buildAttributes] Adding availableFrom:", {
				raw: apartment.availableFrom,
				parsed: availableFromDate,
				formatted: formattedDate,
			});
			attributes.push({
				urn: "urn:concept:free-from",
				value: formattedDate,
			});
		} else {
			console.warn("[otodom/buildAttributes] Invalid availableFrom date:", apartment.availableFrom);
		}
	} else {
		console.log("[otodom/buildAttributes] No availableFrom set for apartment:", apartment._id);
	}

	// 8. Informacje dodatkowe (extras) - OPCJONALNE, multiple
	// Winda z hasElevator (kompatybilność wsteczna)
	if (apartment.hasElevator === true) {
		attributes.push({ urn: "urn:concept:extras", value: "urn:concept:lift" });
	}
	// Pozostałe extras z tablicy (taksonomia Otodom)
	const EXTRAS_URN = {
		balcony: "urn:concept:balcony",
		terrace: "urn:concept:terrace",
		garden: "urn:concept:garden",
		"air-conditioning": "urn:concept:air-conditioning",
		basement: "urn:concept:basement",
		"separate-kitchen": "urn:concept:separate-kitchen",
		garage: "urn:concept:garage",
		"two-storey": "urn:concept:two-storey",
		"usable-room": "urn:concept:usable-room",
	};
	if (Array.isArray(apartment.extras)) {
		for (const e of apartment.extras) {
			if (EXTRAS_URN[e]) {
				attributes.push({ urn: "urn:concept:extras", value: EXTRAS_URN[e] });
			}
		}
	}

	// 9. Media (media-types) - OPCJONALNE, multiple
	const MEDIA_URN = {
		internet: "urn:concept:internet",
		"cable-tv": "urn:concept:cable-tv",
		phone: "urn:concept:phone",
	};
	if (Array.isArray(apartment.mediaTypes)) {
		for (const m of apartment.mediaTypes) {
			if (MEDIA_URN[m]) {
				attributes.push({
					urn: "urn:concept:media-types",
					value: MEDIA_URN[m],
				});
			}
		}
	}

	// 10. Wyposażenie (equipment-types) - OPCJONALNE, multiple
	const EQUIPMENT_URN = {
		furniture: "urn:concept:furniture",
		oven: "urn:concept:oven",
		fridge: "urn:concept:fridge",
		"washing-machine": "urn:concept:washing-machine",
		tv: "urn:concept:tv",
		stove: "urn:concept:stove",
		dishwasher: "urn:concept:dishwasher",
	};
	if (Array.isArray(apartment.equipmentTypes)) {
		for (const eq of apartment.equipmentTypes) {
			if (EQUIPMENT_URN[eq]) {
				attributes.push({
					urn: "urn:concept:equipment-types",
					value: EQUIPMENT_URN[eq],
				});
			}
		}
	}

	// 11. Zabezpieczenia (security) - OPCJONALNE, multiple
	const SECURITY_URN = {
		alarm: "urn:concept:alarm",
		"anti-burglary-door": "urn:concept:anti-burglary-door",
		entryphone: "urn:concept:entryphone",
		"roller-shutters": "urn:concept:roller-shutters",
		"closed-area": "urn:concept:closed-area",
		monitoring: "urn:concept:monitoring",
	};
	if (Array.isArray(apartment.security)) {
		for (const s of apartment.security) {
			if (SECURITY_URN[s]) {
				attributes.push({
					urn: "urn:concept:security",
					value: SECURITY_URN[s],
				});
			}
		}
	}

	// 12. Czynsz i kaucja - próba dodania jako atrybuty
	// Otodom może mieć te pola w taksonomii, ale nie są widoczne w podstawowej dokumentacji
	// Próbujemy najbardziej prawdopodobne URN-y - jeśli API zwróci błąd walidacji,
	// będziemy wiedzieć które pola są nieprawidłowe i możemy je usunąć
	if (apartment.rentCharges != null && apartment.rentCharges > 0) {
		// Najbardziej prawdopodobne URN-y dla czynszu
		attributes.push({
			urn: "urn:concept:rent-charges",
			value: String(apartment.rentCharges),
		});
	}

	if (apartment.deposit != null && apartment.deposit > 0) {
		// Najbardziej prawdopodobne URN-y dla kaucji
		attributes.push({
			urn: "urn:concept:deposit",
			value: String(apartment.deposit),
		});
	}

	return attributes;
}

/**
 * Publikuj ogłoszenie na Otodom przez API
 * @param {Object} apartment - Obiekt mieszkania z bazy danych
 * @param {string|ObjectId} userId - ID użytkownika aplikacji (właściciela mieszkania)
 * @returns {Promise<Object>} - Odpowiedź z API zawierająca ID ogłoszenia i link
 */
export async function publishOtodomAdvert(apartment, userId) {
	const accessToken = await getOtodomAccessToken(userId);
	const appCreds = await getOtodomAppCredentials();

	// Loguj dane mieszkania przed budowaniem payloadu (dla debugowania)
	console.log("[otodom/publish] Apartment data in publishOtodomAdvert:", {
		_id: apartment._id?.toString(),
		availableFrom: apartment.availableFrom,
		availableFromType: typeof apartment.availableFrom,
		availableFromISO: apartment.availableFrom ? new Date(apartment.availableFrom).toISOString().split("T")[0] : null,
	});

	const location = await buildOtodomLocation(apartment);

	const titleRaw = apartment.title || "";
	// Użytkownik sam dodaje prefix [qatest-mercury] w tytule jeśli używa konta testowego
	// Nie dodajemy go automatycznie - użytkownik ma pełną kontrolę
	let title = titleRaw;

	// Walidacja tytułu zgodnie z wymaganiami OLX Group API:
	// - Min 5 znaków, max 70 znaków
	// - No uppercase (tylko pierwsza litera może być wielka, reszta małe)
	// - Jeśli za krótki, użyj fallback
	if (title.length < 5) {
		title =
			titleRaw.length >= 5 ? titleRaw : titleRaw || "Mieszkanie do wynajęcia";
	}
	// Obetnij do max 70 znaków
	title = title.substring(0, 70);
	// Upewnij się że ma minimum 5 znaków po obcięciu
	if (title.length < 5) {
		throw new Error("Tytuł ogłoszenia musi mieć minimum 5 znaków.");
	}
	// OLX Group API wymaga: "no uppercase" - tylko pierwsza litera może być wielka
	// Prefix [qatest-mercury] zostawiamy jak jest, konwertujemy resztę tytułu
	if (title.startsWith("[qatest-mercury]")) {
		const prefix = "[qatest-mercury]";
		const restOfTitle = title.substring(prefix.length).trim();
		if (restOfTitle.length > 0) {
			// Konwertuj resztę tytułu: pierwsza litera wielka, reszta małe
			title =
				prefix +
				" " +
				restOfTitle.charAt(0).toUpperCase() +
				restOfTitle.slice(1).toLowerCase();
		}
	} else {
		// Dla normalnych tytułów: pierwsza litera wielka, reszta małe
		title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
	}

	// Description: min 50 znaków (wymagane przez OLX Group API)
	// Używamy opisu z formularza mieszkania
	let description = apartment.description || titleRaw || "";

	// Jeśli opis jest za krótki, dodaj tekst
	if (description.length < 50) {
		description =
			description +
			" " +
			"Mieszkanie do wynajęcia w doskonałej lokalizacji. Zapraszamy do kontaktu.";
	}
	description = description.substring(0, 65535); // Max 65535 znaków

	// Normalizuj URL-e zdjęć do pełnych URL-i (OLX Group API wymaga tablicy obiektów z 'url')
	const normalizedImages = normalizeImageUrls(apartment.photos || []);

	// OLX Group API wymaga przynajmniej jednego zdjęcia
	if (normalizedImages.length === 0) {
		throw new Error(
			"Otodom wymaga przynajmniej jednego zdjęcia do publikacji ogłoszenia.",
		);
	}

	// OLX Group API wymaga site_urn i category_urn (nie category_id)
	// Upewnij się, że location.custom_fields są zawsze obecne (wymagane przez Otodom)
	if (
		!location.custom_fields ||
		!location.custom_fields.city_id ||
		!location.custom_fields.street_name
	) {
		console.warn(
			"[otodom/publish] Location custom_fields missing, adding defaults",
		);
		location.custom_fields = {
			city_id: location.custom_fields?.city_id || 26,
			street_name: location.custom_fields?.street_name || "Świętokrzyska",
		};
	}

	// Zgodnie z dokumentacją OLX Group API:
	// - attributes: tablica atrybutów z taxonomy (metraż, liczba pokoi itp.) - format: [{urn: "...", value: "..."}]
	// - custom_fields: obiekt z metadanymi integracji (id, reference_id) - format: {id: "...", reference_id: "..."}

	// Buduj tablicę atrybutów z taxonomy
	const attributes = buildOtodomAttributes(apartment);

	// Walidacja wymaganych pól
	if (!apartment.area || apartment.area <= 0) {
		throw new Error(
			"Metraż (area) jest wymagany dla publikacji ogłoszenia na Otodom.",
		);
	}

	const hasNumberOfRooms = attributes.some(
		(attr) => attr.urn === "urn:concept:number-of-rooms",
	);
	if (!hasNumberOfRooms) {
		throw new Error(
			'Liczba pokoi (numberOfRooms) jest wymagana dla publikacji ogłoszenia na Otodom. Dodaj pole "Liczba pokoi" w formularzu mieszkania lub upewnij się, że tytuł zawiera informację o liczbie pokoi (np. "Mieszkanie 3-pokojowe").',
		);
	}

	// Zgodnie z dokumentacją OLX Group API:
	// - price = cena główna (miesięczny koszt wynajmu mieszkania)
	// - rent_price = czynsz (dodatkowe opłaty: media, ogrzewanie itd.) – z pola rentCharges, osobno od ceny
	// - deposit_price = kaucja – osobne pole (dla kategorii "for rent")
	const priceObject = {
		value: Number(apartment.price),
		currency: "PLN",
	};

	const advertData = {
		site_urn: OTODOM_SITE_URN, // urn:site:otodompl
		category_urn: "urn:concept:apartments-for-rent", // Mieszkania do wynajęcia
		title, // Już zwalidowany: 5-70 znaków, no uppercase
		description,
		price: priceObject,
		// Czynsz = dodatkowe opłaty (media, ogrzewanie) – tylko gdy użytkownik ustawił rentCharges
		...(apartment.rentCharges != null &&
			apartment.rentCharges > 0 && {
				rent_price: {
					value: Number(apartment.rentCharges),
					currency: "PLN",
				},
			}),
		// Kaucja – API wymaga deposit_price na najwyższym poziomie (dla kategorii "for rent")
		...(apartment.deposit != null &&
			apartment.deposit > 0 && {
				deposit_price: {
					value: Number(apartment.deposit),
					currency: "PLN",
				},
			}),
		location, // location.custom_fields zawierają city_id i street_name
		images: normalizedImages,
		// Atrybuty z taxonomy (metraż, liczba pokoi, czynsz dodatkowy rent-charges itp.)
		attributes: attributes.length > 0 ? attributes : [],
		// custom_fields: metadane integracji - API wymaga pola 'id'
		custom_fields: {
			id: apartment._id?.toString() || `apt-${Date.now()}`, // Wymagane przez API
			reference_id: apartment._id?.toString() || null, // Opcjonalne dla śledzenia
		},
	};

	// Contact jest opcjonalny, ale jeśli jest podany, wymaga name i email
	// Na razie pomijamy contact - API użyje danych z konta OAuth

	// Log payload przed wysłaniem (dla debugowania)
	console.log("[otodom/publish] Payload:", JSON.stringify(advertData, null, 2));
	console.log("[otodom/publish] Location:", JSON.stringify(location, null, 2));

	try {
		const response = await axios.post(
			OTODOM_API_BASE, // https://api.olxgroup.com/advert/v1
			advertData,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"X-API-KEY": appCreds.apiKey,
					Accept: "application/json",
					"Content-Type": "application/json",
					"User-Agent": "PortfelNieruchomosci",
				},
				timeout: 20000,
			},
		);

		// OLX Group API zwraca transaction_id (nie id) - ogłoszenie jest publikowane asynchronicznie
		const transactionId = response.data.transaction_id || response.data.id;
		// W response.data.data.uuid jest prawdziwe ID ogłoszenia (object_id) - używamy go jeśli jest dostępny
		const objectId = response.data?.data?.uuid || null;
		// URL może być w response.data.url lub trzeba będzie poczekać na webhook
		const advertUrl =
			response.data.url ||
			(objectId
				? `https://www.otodom.pl/pl/oferta/${objectId}`
				: `https://www.otodom.pl/pl/oferta/${transactionId}`);

		console.log("[otodom/publish] Success:", {
			transactionId,
			objectId: objectId || "not provided",
			responseData: response.data,
		});

		return {
			success: true,
			advertId: objectId || transactionId, // Używamy object_id jeśli jest dostępny, w przeciwnym razie transaction_id
			transactionId,
			objectId, // Prawdziwe ID ogłoszenia jeśli jest dostępne
			url: advertUrl,
		};
	} catch (err) {
		// Log pełnego obiektu errors dla debugowania
		if (err.response?.data?.errors) {
			console.error(
				"[otodom/publish] Full errors array:",
				JSON.stringify(err.response.data.errors, null, 2),
			);
		}

		// Log pełnej odpowiedzi z API dla debugowania
		console.error("[otodom/publish] Full API response:", {
			status: err.response?.status,
			statusText: err.response?.statusText,
			headers: err.response?.headers,
			data: err.response?.data,
		});

		console.error("Błąd publikacji na Otodom:", {
			status: err.response?.status,
			data: err.response?.data,
			message: err.message,
		});

		// Wyciągnij czytelny komunikat błędu z szczegółami walidacji
		let details = "";
		if (err.response?.data) {
			const data = err.response.data;

			// Jeśli są szczegółowe błędy walidacji w errors array, wyświetl je
			if (Array.isArray(data.errors) && data.errors.length > 0) {
				const errorMessages = data.errors.map((e) => {
					if (typeof e === "string") return e;
					// Pełny obiekt błędu dla lepszego debugowania
					if (e?.field && e?.message) {
						return `${e.field}: ${e.message}${e?.value ? ` (value: ${JSON.stringify(e.value)})` : ""}`;
					}
					if (e?.message) return e.message;
					// Jeśli nie ma field/message, wyświetl cały obiekt
					return JSON.stringify(e, null, 2);
				});
				details = `Validation errors: ${errorMessages.join("; ")}`;
			} else if (data.message) {
				details = String(data.message);
				// Jeśli jest message ale też errors, dodaj je
				if (Array.isArray(data.errors) && data.errors.length > 0) {
					details += ` (${data.errors.length} error(s))`;
				}
			} else if (typeof data === "string") {
				details = data;
			} else if (data.error_description) {
				details = String(data.error_description);
			} else if (data.error) {
				details =
					typeof data.error === "string"
						? data.error
						: JSON.stringify(data.error);
			} else {
				// Fallback: wyświetl cały obiekt data jako JSON
				details = JSON.stringify(data, null, 2);
			}
		} else if (err.message) {
			details = String(err.message);
		} else {
			details = "Nieznany błąd";
		}

		throw new Error(
			`Nie udało się opublikować ogłoszenia na Otodom: ${details}`,
		);
	}
}

/**
 * Aktualizuj istniejące ogłoszenie na Otodom
 * @param {string} externalId - ID ogłoszenia na Otodom
 * @param {Object} apartment - Obiekt mieszkania z bazy danych
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function updateOtodomAdvert(externalId, apartment, userId) {
	const accessToken = await getOtodomAccessToken(userId);
	const appCreds = await getOtodomAppCredentials();

	const titleRaw = apartment.title || "";
	// Użytkownik sam dodaje prefix [qatest-mercury] w tytule jeśli używa konta testowego
	const title = titleRaw;
	// Używamy opisu z formularza mieszkania
	const description = apartment.description || titleRaw;

	// Normalizuj URL-e zdjęć do pełnych URL-i
	const normalizedImages = normalizeImageUrls(apartment.photos || []);

	// Buduj atrybuty zgodnie z taksonomią Otodom
	const attributes = buildOtodomAttributes(apartment);

	// price = cena mieszkania; rent_price = czynsz (opłaty dodatkowe); deposit_price = kaucja
	const priceObject = {
		value: Number(apartment.price),
		currency: "PLN",
	};

	// Przy aktualizacji również buduj location (może się zmienić)
	const location = await buildOtodomLocation(apartment);

	const advertData = {
		title: title.substring(0, 70),
		description,
		price: priceObject,
		...(apartment.rentCharges != null &&
			apartment.rentCharges > 0 && {
				rent_price: {
					value: Number(apartment.rentCharges),
					currency: "PLN",
				},
			}),
		...(apartment.deposit != null &&
			apartment.deposit > 0 && {
				deposit_price: {
					value: Number(apartment.deposit),
					currency: "PLN",
				},
			}),
		location, // Dodaj location przy aktualizacji (może zawierać zaktualizowane współrzędne)
		images: normalizedImages,
		attributes: attributes.length > 0 ? attributes : [],
	};

	// Log payload przed wysłaniem (dla debugowania)
	console.log("[otodom/update] Payload:", JSON.stringify(advertData, null, 2));
	const availableFromAttr = attributes.find(attr => attr.urn === "urn:concept:free-from");
	console.log("[otodom/update] AvailableFrom attribute:", availableFromAttr);
	console.log("[otodom/update] All attributes:", attributes.map(attr => ({ urn: attr.urn, value: attr.value })));

	try {
		await axios.put(
			`${OTODOM_API_BASE}/${externalId}`, // https://api.olxgroup.com/advert/v1/{advert_id}
			advertData,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"X-API-KEY": appCreds.apiKey,
					Accept: "application/json",
					"Content-Type": "application/json",
					"User-Agent": "PortfelNieruchomosci",
				},
				timeout: 20000,
			},
		);

		return { success: true };
	} catch (err) {
		console.error("Błąd aktualizacji ogłoszenia Otodom:", {
			status: err.response?.status,
			data: err.response?.data,
			message: err.message,
		});

		let details = "";
		if (err.response?.data) {
			const data = err.response.data;
			if (typeof data === "string") {
				details = data;
			} else if (data.message) {
				details = String(data.message);
			} else if (data.error_description) {
				details = String(data.error_description);
			} else if (data.error) {
				details =
					typeof data.error === "string"
						? data.error
						: JSON.stringify(data.error);
			} else {
				details = JSON.stringify(data);
			}
		} else if (err.message) {
			details = String(err.message);
		} else {
			details = "Nieznany błąd";
		}

		throw new Error(
			`Nie udało się zaktualizować ogłoszenia na Otodom: ${details}`,
		);
	}
}

/**
 * Sprawdź status ogłoszenia na Otodom (metadane)
 * @param {string} advertId - ID ogłoszenia (może być transaction_id lub object_id)
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function getOtodomAdvertStatus(advertId, userId) {
	const accessToken = await getOtodomAccessToken(userId);
	const appCreds = await getOtodomAppCredentials();

	try {
		const response = await axios.get(
			`${OTODOM_API_BASE}/${advertId}/meta`, // https://api.olxgroup.com/advert/v1/{advert_id}/meta
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"X-API-KEY": appCreds.apiKey,
					Accept: "application/json",
					"User-Agent": "PortfelNieruchomosci",
				},
				timeout: 20000,
			},
		);

		return {
			success: true,
			data: response.data,
		};
	} catch (err) {
		console.error("Błąd sprawdzania statusu ogłoszenia Otodom:", {
			status: err.response?.status,
			data: err.response?.data,
			message: err.message,
		});

		let details = "";
		if (err.response?.data) {
			const data = err.response.data;
			if (typeof data === "string") {
				details = data;
			} else if (data.message) {
				details = String(data.message);
			} else {
				details = JSON.stringify(data);
			}
		} else if (err.message) {
			details = String(err.message);
		} else {
			details = "Nieznany błąd";
		}

		throw new Error(
			`Nie udało się sprawdzić statusu ogłoszenia na Otodom: ${details}`,
		);
	}
}

/**
 * Usuń ogłoszenie z Otodom
 * @param {string} externalId - ID ogłoszenia na Otodom
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function deleteOtodomAdvert(externalId, userId) {
	const accessToken = await getOtodomAccessToken(userId);
	const appCreds = await getOtodomAppCredentials();

	try {
		await axios.delete(
			`${OTODOM_API_BASE}/${externalId}`, // https://api.olxgroup.com/advert/v1/{advert_id}
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"X-API-KEY": appCreds.apiKey,
					Accept: "application/json",
					"User-Agent": "PortfelNieruchomosci",
				},
				timeout: 20000,
			},
		);

		return { success: true };
	} catch (err) {
		console.error("Błąd usuwania ogłoszenia z Otodom:", {
			status: err.response?.status,
			data: err.response?.data,
			message: err.message,
		});

		let details = "";
		if (err.response?.data) {
			const data = err.response.data;
			if (typeof data === "string") {
				details = data;
			} else if (data.message) {
				details = String(data.message);
			} else if (data.error_description) {
				details = String(data.error_description);
			} else if (data.error) {
				details =
					typeof data.error === "string"
						? data.error
						: JSON.stringify(data.error);
			} else {
				details = JSON.stringify(data);
			}
		} else if (err.message) {
			details = String(err.message);
		} else {
			details = "Nieznany błąd";
		}

		throw new Error(`Nie udało się usunąć ogłoszenia z Otodom: ${details}`);
	}
}
