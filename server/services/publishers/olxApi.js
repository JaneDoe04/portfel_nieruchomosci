/**
 * OLX API integration service.
 * Obsługuje OAuth 2.0 autoryzację i publikację ogłoszeń przez OLX API.
 * 
 * Dokumentacja: https://developer.olx.pl/api/doc/
 */

import axios from 'axios';
import ApiCredentials from '../../models/ApiCredentials.js';

const OLX_API_BASE = 'https://www.olx.pl/api';
const OLX_AUTH_URL = 'https://www.olx.pl/api/open/oauth/token';

/**
 * Pobierz lub odśwież access token dla OLX dla KONKRETNEGO UŻYTKOWNIKA
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function getOlxAccessToken(userId) {
  if (!userId) {
    throw new Error('UserId jest wymagany do pobrania tokenu OLX.');
  }

  // Pobierz user-level credentials (zawierają tokeny użytkownika)
  const credentials = await ApiCredentials.findOne({ platform: 'olx', userId });
  
  if (!credentials || !credentials.isConfigured) {
    throw new Error('OLX API nie jest skonfigurowane dla tego użytkownika. Wymagana autoryzacja OAuth.');
  }

  if (!credentials.isActive) {
    throw new Error('OLX API nie jest aktywne dla tego użytkownika. Wymagana autoryzacja OAuth.');
  }

  // Jeśli token jest ważny, zwróć go
  if (credentials.accessToken && credentials.tokenExpiresAt && credentials.tokenExpiresAt > new Date()) {
    return credentials.accessToken;
  }

  // Jeśli mamy refresh token, użyj go do odświeżenia
  if (credentials.refreshToken) {
    try {
      const response = await axios.post(OLX_AUTH_URL, {
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
      console.error('Błąd odświeżania tokenu OLX:', err.response?.data || err.message);
      throw new Error('Nie udało się odświeżyć tokenu OLX. Wymagana ponowna autoryzacja.');
    }
  }

  throw new Error('Brak ważnego tokenu OLX. Wymagana autoryzacja OAuth.');
}

/**
 * Publikuj ogłoszenie na OLX przez API
 * @param {Object} apartment - Obiekt mieszkania z bazy danych
 * @param {string|ObjectId} userId - ID użytkownika aplikacji (właściciela mieszkania)
 * @returns {Promise<Object>} - Odpowiedź z API zawierająca ID ogłoszenia i link
 */
export async function publishOlxAdvert(apartment, userId) {
  const accessToken = await getOlxAccessToken(userId);

  // Mapuj dane mieszkania na format wymagany przez OLX API
  const advertData = {
    title: apartment.title.substring(0, 70), // OLX max 70 znaków
    description: apartment.description || apartment.title,
    category_id: '5019', // Mieszkania do wynajęcia - trzeba będzie sprawdzić dokładny ID
    price: {
      value: apartment.price,
      currency: 'PLN',
    },
    location: {
      // TODO: Geokodowanie - zamień adres na współrzędne
      latitude: 52.2297, // Domyślnie Warszawa
      longitude: 21.0122,
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
      `${OLX_API_BASE}/partner/adverts`,
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
    const advertUrl = response.data.url || `https://www.olx.pl/oferta/${advertId}`;

    return {
      success: true,
      advertId,
      url: advertUrl,
    };
  } catch (err) {
    console.error('Błąd publikacji na OLX:', err.response?.data || err.message);
    throw new Error(`Nie udało się opublikować ogłoszenia na OLX: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Aktualizuj istniejące ogłoszenie na OLX
 * @param {string} externalId - ID ogłoszenia na OLX
 * @param {Object} apartment - Obiekt mieszkania z bazy danych
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function updateOlxAdvert(externalId, apartment, userId) {
  const accessToken = await getOlxAccessToken(userId);

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
      `${OLX_API_BASE}/partner/adverts/${externalId}`,
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
    console.error('Błąd aktualizacji ogłoszenia OLX:', err.response?.data || err.message);
    throw new Error(`Nie udało się zaktualizować ogłoszenia na OLX: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Usuń ogłoszenie z OLX
 * @param {string} externalId - ID ogłoszenia na OLX
 * @param {string|ObjectId} userId - ID użytkownika aplikacji
 */
export async function deleteOlxAdvert(externalId, userId) {
  const accessToken = await getOlxAccessToken(userId);

  try {
    await axios.delete(
      `${OLX_API_BASE}/partner/adverts/${externalId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Błąd usuwania ogłoszenia OLX:', err.response?.data || err.message);
    throw new Error(`Nie udało się usunąć ogłoszenia z OLX: ${err.response?.data?.message || err.message}`);
  }
}
