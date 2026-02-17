/**
 * Otodom API integration service.
 * Obsługuje OAuth 2.0 autoryzację i publikację ogłoszeń przez Otodom API.
 * 
 * Otodom używa OLX Group API (ten sam system co OLX, ale inne endpointy).
 * Dokumentacja: https://developer.olxgroup.com/
 */

import axios from 'axios';
import ApiCredentials from '../../models/ApiCredentials.js';

const OTODOM_API_BASE = 'https://www.otodom.pl/api';
// Otodom (Real Estate) używa OLX Group OAuth
const OTODOM_OAUTH_TOKEN_URL = 'https://api.olxgroup.com/oauth/v1/token';
const OTODOM_LOCATIONS_BASE = 'https://api.olxgroup.com/locations/v1/urn:site:otodompl';

const OTODOM_TEST_PREFIX = '[qatest-mercury]';
const OTODOM_TEST_DESCRIPTION =
  'Czasami musimy dodać takie ogłoszenie, żeby zweryfikować działanie niektórych funkcji systemu. Liczymy na Twoją wyrozumiałość  Radzimy skorzystać ponownie z naszej wyszukiwarki ofert.<br/><br/> Powodzenia w dalszych poszukiwaniach!';

const isTestMode = () => String(process.env.OTODOM_TEST_MODE || '').toLowerCase() === 'true';

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

  return {
    exact: true,
    lat,
    lon,
    custom_fields: {
      city_id: cityId,
      street_name: streetName,
    },
  };
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
  const description = isTestMode()
    ? OTODOM_TEST_DESCRIPTION
    : (apartment.description || titleRaw);

  const advertData = {
    title: title.substring(0, 70), // Max 70 znaków
    description,
    category_id: '5019', // Mieszkania do wynajęcia
    price: {
      value: apartment.price,
      currency: 'PLN',
    },
    location,
    images: apartment.photos || [],
    contact: {
      // TODO: Pobierz dane kontaktowe z konfiguracji
      name: 'Agencja',
      email: 'contact@example.com',
      phone: '+48123456789',
    },
  };

  try {
    const response = await axios.post(
      `${OTODOM_API_BASE}/partner/adverts`,
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

    // Zaktualizuj externalIds w mieszkaniu
    const advertId = response.data.id;
    const advertUrl = response.data.url || `https://www.otodom.pl/pl/oferta/${advertId}`;

    return {
      success: true,
      advertId,
      url: advertUrl,
    };
  } catch (err) {
    console.error('Błąd publikacji na Otodom:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    const details =
      err.response?.data?.message ||
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.message;
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

  const advertData = {
    title: title.substring(0, 70),
    description,
    price: {
      value: apartment.price,
      currency: 'PLN',
    },
    images: apartment.photos || [],
  };

  try {
    await axios.put(
      `${OTODOM_API_BASE}/partner/adverts/${externalId}`,
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
    const details =
      err.response?.data?.message ||
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.message;
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
      `${OTODOM_API_BASE}/partner/adverts/${externalId}`,
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
    const details =
      err.response?.data?.message ||
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.message;
    throw new Error(`Nie udało się usunąć ogłoszenia z Otodom: ${details}`);
  }
}
