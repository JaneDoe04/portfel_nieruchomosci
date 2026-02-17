/**
 * Otodom API integration service.
 * Obsługuje OAuth 2.0 autoryzację i publikację ogłoszeń przez Otodom API.
 * 
 * Otodom używa OLX Group API (ten sam system co OLX, ale inne endpointy).
 * Dokumentacja: https://developer.olxgroup.com/
 */

import axios from 'axios';
import ApiCredentials from '../../models/ApiCredentials.js';

// Otodom używa OLX Group API (nie własnego API na otodom.pl)
const OTODOM_API_BASE = 'https://api.olxgroup.com/advert/v1';
const OTODOM_OAUTH_TOKEN_URL = 'https://api.olxgroup.com/oauth/v1/token';
const OTODOM_LOCATIONS_BASE = 'https://api.olxgroup.com/locations/v1/urn:site:otodompl';
const OTODOM_SITE_URN = 'urn:site:otodompl'; // Site URN dla Otodom

const OTODOM_TEST_PREFIX = '[qatest-mercury]';
const OTODOM_TEST_DESCRIPTION =
  'Czasami musimy dodać takie ogłoszenie, żeby zweryfikować działanie niektórych funkcji systemu. Liczymy na Twoją wyrozumiałość  Radzimy skorzystać ponownie z naszej wyszukiwarki ofert.<br/><br/> Powodzenia w dalszych poszukiwaniach!';

const isTestMode = () => String(process.env.OTODOM_TEST_MODE || '').toLowerCase() === 'true';

/**
 * Konwertuj relatywne ścieżki zdjęć na pełne URL-e dla Otodom API
 * OLX Group API wymaga tablicy obiektów z właściwością 'url'
 */
function normalizeImageUrls(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  
  const baseUrl = process.env.CLIENT_ORIGIN || 'https://portfel-nieruchomosci.onrender.com';
  
  return photos.map((photo) => {
    if (!photo) return null;
    let url = String(photo).trim();
    // Jeśli już jest pełny URL (http/https), zwróć bez zmian
    if (/^https?:\/\//i.test(url)) {
      return { url };
    }
    // Jeśli zaczyna się od /uploads, dodaj base URL
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      url = `${baseUrl}${cleanPath}`;
    }
    // Zwróć jako obiekt z właściwością 'url' (wymagane przez OLX Group API)
    return { url };
  }).filter(Boolean);
}

async function getOtodomAppCredentials() {
  const appCreds = await ApiCredentials.findOne({ platform: 'otodom', userId: null }).lean();
  if (!appCreds?.clientId || !appCreds?.clientSecret) {
    throw new Error('Brak app-level credentials dla Otodom (clientId/clientSecret). Uzupełnij w Ustawieniach API.');
  }
  if (!appCreds?.apiKey) {
    throw new Error('Brak API KEY (X-API-KEY) dla Otodom. Uzupełnij w Ustawieniach API.');
  }
  return appCreds;
}

function buildTestSafeTitle(rawTitle) {
  const base = (rawTitle || '').trim() || 'Test ogłoszenia';
  if (base.toLowerCase().startsWith(OTODOM_TEST_PREFIX.toLowerCase())) return base;
  return `${OTODOM_TEST_PREFIX} ${base}`;
}

const cityIdCache = new Map(); // key: city name lower → id number

function parseStreetNameFromAddress(address) {
  if (!address) return '';
  const firstPart = String(address).split(',')[0]?.trim() || '';
  // remove common prefixes and numbers
  return firstPart
    .replace(/^(ul\.|al\.|aleja|pl\.|os\.)\s*/i, '')
    .replace(/\s+\d+[a-zA-Z]?(\s*\/\s*\d+)?\s*$/i, '')
    .trim();
}

function parseCityFromAddress(address) {
  if (!address) return '';
  const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || '';
  // try to strip postal code like 00-001
  return tail.replace(/\b\d{2}-\d{3}\b/g, '').trim();
}

async function resolveCityIdByName(apiKey, cityName) {
  const name = (cityName || '').trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (cityIdCache.has(key)) return cityIdCache.get(key);

  const url = `${OTODOM_LOCATIONS_BASE}/cities?search=${encodeURIComponent(name)}&exact=true&no-districts=1&limit=5`;
  const { data } = await axios.get(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'User-Agent': 'PortfelNieruchomosci',
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

async function resolveLatLonWithNominatim(address) {
  const enabled = String(process.env.OTODOM_GEOCODE || '').toLowerCase() === 'true';
  if (!enabled) return null;
  if (!address) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'PortfelNieruchomosci/1.0 (otodom integration)',
    },
    timeout: 15000,
  });
  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.lat || !first?.lon) return null;
  return { lat: Number(first.lat), lon: Number(first.lon) };
}

async function buildOtodomLocation(apartment) {
  // Defaults (safe fallback)
  let lat = apartment.lat ?? 52.2297;
  let lon = apartment.lon ?? 21.0122;

  // street_name: parse from address if not provided
  const streetName =
    (apartment.streetName && apartment.streetName.trim()) ||
    parseStreetNameFromAddress(apartment.address) ||
    'Świętokrzyska';

  // city_id: if not provided, resolve via OLX Group Locations API using X-API-KEY
  let cityId = apartment.cityId != null ? Number(apartment.cityId) : null;
  if (!cityId || Number.isNaN(cityId)) {
    const appCreds = await ApiCredentials.findOne({ platform: 'otodom', userId: null }).lean();
    const apiKey = appCreds?.apiKey;
    if (apiKey) {
      const cityName = parseCityFromAddress(apartment.address);
      try {
        cityId = await resolveCityIdByName(apiKey, cityName);
      } catch (e) {
        console.warn('[otodom/location] city resolve failed', { cityName, err: e.message });
      }
    }
  }
  if (!cityId) cityId = 26; // fallback Warszawa

  // lat/lon optional auto-geocode (disabled by default)
  if (apartment.lat == null || apartment.lon == null) {
    try {
      const geo = await resolveLatLonWithNominatim(apartment.address);
      if (geo?.lat && geo?.lon) {
        lat = geo.lat;
        lon = geo.lon;
      }
    } catch (e) {
      console.warn('[otodom/geocode] failed', e.message);
    }
  }

  // Otodom WYMAGA custom_fields z city_id i street_name (oba razem)
  // Zgodnie z dokumentacją: "Nazwa ulicy (street_name) powinna być zawsze przesłana wraz z numerem ID miejscowości (city_id)"
  
  // Upewnij się, że mamy oba pola (użyj fallbacków jeśli brakuje)
  const finalCityId = cityId && !Number.isNaN(cityId) ? Number(cityId) : 26; // fallback Warszawa
  const finalStreetName = (streetName && streetName.trim()) || 'Świętokrzyska'; // fallback

  // OLX Group API wymaga location z lat/lon/exact + custom_fields (oba pola razem)
  const location = {
    exact: true,
    lat,
    lon,
    custom_fields: {
      city_id: finalCityId,
      street_name: finalStreetName,
    },
  };

  return location;
}

/**
 * Pobierz lub odśwież access token dla Otodom dla KONKRETNEGO UŻYTKOWNIKA
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function getOtodomAccessToken(userId) {
  if (!userId) {
    throw new Error('UserId jest wymagany do pobrania tokenu Otodom.');
  }

  // Pobierz user-level credentials (zawierają tokeny użytkownika)
  const credentials = await ApiCredentials.findOne({ platform: 'otodom', userId });
  
  if (!credentials || !credentials.isConfigured) {
    throw new Error('Otodom API nie jest skonfigurowane dla tego użytkownika. Wymagana autoryzacja OAuth.');
  }

  if (!credentials.isActive) {
    throw new Error('Otodom API nie jest aktywne dla tego użytkownika. Wymagana autoryzacja OAuth.');
  }

  // Jeśli token jest ważny, zwróć go
  if (credentials.accessToken && credentials.tokenExpiresAt && credentials.tokenExpiresAt > new Date()) {
    return credentials.accessToken;
  }

  // Jeśli mamy refresh token, użyj go do odświeżenia
  if (credentials.refreshToken) {
    try {
      // Refresh token przez OLX Group OAuth
      const appCreds = await getOtodomAppCredentials();
      const basic = Buffer.from(`${appCreds.clientId}:${appCreds.clientSecret}`, 'utf8').toString('base64');
      const response = await axios.post(
        OTODOM_OAUTH_TOKEN_URL,
        { grant_type: 'refresh_token', refresh_token: credentials.refreshToken },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${basic}`,
            'X-API-KEY': appCreds.apiKey,
            'User-Agent': 'PortfelNieruchomosci',
          },
          timeout: 15000,
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      // Zaktualizuj credentials
      credentials.accessToken = access_token;
      if (refresh_token) credentials.refreshToken = refresh_token;
      credentials.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
      await credentials.save();

      return access_token;
    } catch (err) {
      console.error('Błąd odświeżania tokenu Otodom:', err.response?.data || err.message);
      throw new Error('Nie udało się odświeżyć tokenu Otodom. Wymagana ponowna autoryzacja.');
    }
  }

  throw new Error('Brak ważnego tokenu Otodom. Wymagana autoryzacja OAuth.');
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

  const location = await buildOtodomLocation(apartment);

  const titleRaw = apartment.title || '';
  const title = isTestMode() ? buildTestSafeTitle(titleRaw) : titleRaw;
  
  // Description: min 50 znaków (wymagane przez OLX Group API)
  let description = isTestMode()
    ? OTODOM_TEST_DESCRIPTION
    : (apartment.description || titleRaw || '');
  
  // Jeśli opis jest za krótki, dodaj tekst
  if (description.length < 50) {
    description = description + ' ' + 'Mieszkanie do wynajęcia w doskonałej lokalizacji. Zapraszamy do kontaktu.';
  }
  description = description.substring(0, 65535); // Max 65535 znaków

  // Normalizuj URL-e zdjęć do pełnych URL-i (OLX Group API wymaga tablicy obiektów z 'url')
  const normalizedImages = normalizeImageUrls(apartment.photos || []);
  
  // OLX Group API wymaga przynajmniej jednego zdjęcia
  if (normalizedImages.length === 0) {
    throw new Error('Otodom wymaga przynajmniej jednego zdjęcia do publikacji ogłoszenia.');
  }

  // OLX Group API wymaga site_urn i category_urn (nie category_id)
  // Upewnij się, że location.custom_fields są zawsze obecne (wymagane przez Otodom)
  if (!location.custom_fields || !location.custom_fields.city_id || !location.custom_fields.street_name) {
    console.warn('[otodom/publish] Location custom_fields missing, adding defaults');
    location.custom_fields = {
      city_id: location.custom_fields?.city_id || 26,
      street_name: location.custom_fields?.street_name || 'Świętokrzyska',
    };
  }

  // Zgodnie z dokumentacją Otodom: custom_fields są TYLKO w location, nie na poziomie głównym
  // Dokumentacja: "Inside, you can specify the 'city_id' or the 'district_id' that you got from the Location search"
  // custom_fields są opcjonalne, ale jeśli są wysyłane, muszą być w location
  const advertData = {
    site_urn: OTODOM_SITE_URN, // urn:site:otodompl
    category_urn: 'urn:concept:apartments-for-rent', // Mieszkania do wynajęcia
    title: title.substring(0, 70), // Max 70 znaków, min 5
    description,
    price: {
      value: Number(apartment.price), // Musi być liczbą
      currency: 'PLN',
    },
    location, // custom_fields są tutaj, nie na poziomie głównym
    images: normalizedImages,
  };

  // Contact jest opcjonalny, ale jeśli jest podany, wymaga name i email
  // Na razie pomijamy contact - API użyje danych z konta OAuth

  // Log payload przed wysłaniem (dla debugowania)
  console.log('[otodom/publish] Payload:', JSON.stringify(advertData, null, 2));
  console.log('[otodom/publish] Location:', JSON.stringify(location, null, 2));

  try {
    const response = await axios.post(
      OTODOM_API_BASE, // https://api.olxgroup.com/advert/v1
      advertData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-KEY': appCreds.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PortfelNieruchomosci',
        },
        timeout: 20000,
      }
    );

    // OLX Group API zwraca transaction_id (nie id) - ogłoszenie jest publikowane asynchronicznie
    const transactionId = response.data.transaction_id || response.data.id;
    // URL może być w response.data.url lub trzeba będzie poczekać na webhook
    const advertUrl = response.data.url || `https://www.otodom.pl/pl/oferta/${transactionId}`;

    console.log('[otodom/publish] Success:', { transactionId, responseData: response.data });

    return {
      success: true,
      advertId: transactionId, // Używamy transaction_id jako tymczasowego ID
      transactionId,
      url: advertUrl,
    };
  } catch (err) {
    // Log pełnego obiektu errors dla debugowania
    if (err.response?.data?.errors) {
      console.error('[otodom/publish] Full errors array:', JSON.stringify(err.response.data.errors, null, 2));
    }
    
    console.error('Błąd publikacji na Otodom:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    
    // Wyciągnij czytelny komunikat błędu z szczegółami walidacji
    let details = '';
    if (err.response?.data) {
      const data = err.response.data;
      
      // Jeśli są szczegółowe błędy walidacji w errors array, wyświetl je
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const errorMessages = data.errors.map((e) => {
          if (typeof e === 'string') return e;
          // Pełny obiekt błędu dla lepszego debugowania
          if (e?.field && e?.message) {
            return `${e.field}: ${e.message}${e?.value ? ` (value: ${JSON.stringify(e.value)})` : ''}`;
          }
          if (e?.message) return e.message;
          // Jeśli nie ma field/message, wyświetl cały obiekt
          return JSON.stringify(e, null, 2);
        });
        details = `Validation errors: ${errorMessages.join('; ')}`;
      } else if (data.message) {
        details = String(data.message);
        // Jeśli jest message ale też errors, dodaj je
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          details += ` (${data.errors.length} error(s))`;
        }
      } else if (typeof data === 'string') {
        details = data;
      } else if (data.error_description) {
        details = String(data.error_description);
      } else if (data.error) {
        details = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else {
        // Fallback: wyświetl cały obiekt data jako JSON
        details = JSON.stringify(data, null, 2);
      }
    } else if (err.message) {
      details = String(err.message);
    } else {
      details = 'Nieznany błąd';
    }
    
    throw new Error(`Nie udało się opublikować ogłoszenia na Otodom: ${details}`);
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

  const titleRaw = apartment.title || '';
  const title = isTestMode() ? buildTestSafeTitle(titleRaw) : titleRaw;
  const description = isTestMode()
    ? OTODOM_TEST_DESCRIPTION
    : (apartment.description || titleRaw);

  // Normalizuj URL-e zdjęć do pełnych URL-i
  const normalizedImages = normalizeImageUrls(apartment.photos || []);

  const advertData = {
    title: title.substring(0, 70),
    description,
    price: {
      value: apartment.price,
      currency: 'PLN',
    },
    images: normalizedImages,
  };

  try {
    await axios.put(
      `${OTODOM_API_BASE}/${externalId}`, // https://api.olxgroup.com/advert/v1/{advert_id}
      advertData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-KEY': appCreds.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PortfelNieruchomosci',
        },
        timeout: 20000,
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Błąd aktualizacji ogłoszenia Otodom:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    
    let details = '';
    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') {
        details = data;
      } else if (data.message) {
        details = String(data.message);
      } else if (data.error_description) {
        details = String(data.error_description);
      } else if (data.error) {
        details = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else {
        details = JSON.stringify(data);
      }
    } else if (err.message) {
      details = String(err.message);
    } else {
      details = 'Nieznany błąd';
    }
    
    throw new Error(`Nie udało się zaktualizować ogłoszenia na Otodom: ${details}`);
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
          'Authorization': `Bearer ${accessToken}`,
          'X-API-KEY': appCreds.apiKey,
          Accept: 'application/json',
          'User-Agent': 'PortfelNieruchomosci',
        },
        timeout: 20000,
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Błąd usuwania ogłoszenia z Otodom:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    
    let details = '';
    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') {
        details = data;
      } else if (data.message) {
        details = String(data.message);
      } else if (data.error_description) {
        details = String(data.error_description);
      } else if (data.error) {
        details = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else {
        details = JSON.stringify(data);
      }
    } else if (err.message) {
      details = String(err.message);
    } else {
      details = 'Nieznany błąd';
    }
    
    throw new Error(`Nie udało się usunąć ogłoszenia z Otodom: ${details}`);
  }
}
