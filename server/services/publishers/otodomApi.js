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
const OTODOM_AUTH_URL = 'https://www.otodom.pl/api/open/oauth/token';

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
      const response = await axios.post(OTODOM_AUTH_URL, {
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      });

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

  // Lokalizacja: Otodom wymaga lat/lon + custom_fields (city_id, street_name)
  // https://developer.olxgroup.com/docs/otodom-locations
  const lat = 52.2297;
  const lon = 21.0122;
  const cityId = apartment.cityId != null ? apartment.cityId : 26; // 26 = Warszawa w słowniku
  const streetName = (apartment.streetName && apartment.streetName.trim()) || 'Świętokrzyska'; // wymagane z city_id

  const advertData = {
    title: apartment.title.substring(0, 70), // Max 70 znaków
    description: apartment.description || apartment.title,
    category_id: '5019', // Mieszkania do wynajęcia
    price: {
      value: apartment.price,
      currency: 'PLN',
    },
    location: {
      exact: true,
      lat,
      lon,
      custom_fields: {
        city_id: cityId,
        street_name: streetName,
      },
    },
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
          'Content-Type': 'application/json',
        },
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
    console.error('Błąd publikacji na Otodom:', err.response?.data || err.message);
    throw new Error(`Nie udało się opublikować ogłoszenia na Otodom: ${err.response?.data?.message || err.message}`);
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

  const advertData = {
    title: apartment.title.substring(0, 70),
    description: apartment.description || apartment.title,
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
          'Content-Type': 'application/json',
        },
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Błąd aktualizacji ogłoszenia Otodom:', err.response?.data || err.message);
    throw new Error(`Nie udało się zaktualizować ogłoszenia na Otodom: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Usuń ogłoszenie z Otodom
 * @param {string} externalId - ID ogłoszenia na Otodom
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function deleteOtodomAdvert(externalId, userId) {
  const accessToken = await getOtodomAccessToken(userId);

  try {
    await axios.delete(
      `${OTODOM_API_BASE}/partner/adverts/${externalId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Błąd usuwania ogłoszenia Otodom:', err.response?.data || err.message);
    throw new Error(`Nie udało się usunąć ogłoszenia z Otodom: ${err.response?.data?.message || err.message}`);
  }
}
