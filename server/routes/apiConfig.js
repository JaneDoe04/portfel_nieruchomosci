import express from 'express';
import axios from 'axios';
import ApiCredentials from '../models/ApiCredentials.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/api-config/:platform/callback
 * Callback OAuth 2.0 – PUBLIC (bez protect), bo OLX przekierowuje tu przeglądarkę bez tokena.
 */
router.get('/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ message: 'Brak kodu autoryzacji.' });
    }

    let userId = null;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decoded.userId;
      } catch (err) {
        console.error('Błąd dekodowania state:', err);
      }
    }

    if (!userId) {
      return res.status(400).json({ message: 'Brak informacji o użytkowniku w callback.' });
    }

    const appCredentials = await ApiCredentials.findOne({ platform, userId: null });
    if (!appCredentials) {
      return res.status(400).json({ message: 'Brak konfiguracji API.' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/api-config/${platform}/callback`;
    // OLX/Otodom partner auth endpoints use /api/open/oauth/*
    const tokenUrl = platform === 'olx'
      ? 'https://www.olx.pl/api/open/oauth/token'
      : 'https://www.otodom.pl/api/open/oauth/token';

    const tokenResponse = await axios.post(tokenUrl, {
      grant_type: 'authorization_code',
      code,
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      redirect_uri: redirectUri,
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    await ApiCredentials.findOneAndUpdate(
      { platform, userId },
      {
        platform,
        clientId: appCredentials.clientId,
        clientSecret: appCredentials.clientSecret,
        userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        isConfigured: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    res.send(`
      <html>
        <body>
          <h1>Autoryzacja zakończona pomyślnie!</h1>
          <p>Możesz zamknąć to okno.</p>
          <script>
            window.opener.postMessage({ type: 'oauth_success', platform: '${platform}' }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Błąd autoryzacji OAuth:', err.response?.data || err.message);
    res.status(500).send(`
      <html>
        <body>
          <h1>Błąd autoryzacji</h1>
          <p>${err.response?.data?.error_description || err.message || 'Nieznany błąd'}</p>
          <p>Sprawdź konsole serwera dla szczegółów.</p>
        </body>
      </html>
    `);
  }
});

// Wszystkie poniższe endpointy wymagają autoryzacji
router.use(protect);

/**
 * GET /api/api-config
 * Pobierz konfigurację API
 * - App-level credentials (userId = null) - dla wszystkich
 * - User-level tokens (userId = req.user._id) - tylko dla zalogowanego użytkownika
 */
router.get('/', async (req, res) => {
  try {
    // Pobierz app-level credentials (bez secret)
    const appCredentials = await ApiCredentials.find({ userId: null })
      .select('-clientSecret -accessToken -refreshToken')
      .lean();

    // Pobierz user-level tokens dla zalogowanego użytkownika
    const userTokens = await ApiCredentials.find({ userId: req.user._id })
      .select('-clientSecret -clientId') // Nie pokazujemy client_id/secret, tylko tokeny
      .lean();

    res.json({
      appLevel: appCredentials,
      userLevel: userTokens,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd pobierania konfiguracji API.' });
  }
});

/**
 * POST /api/api-config
 * Utwórz lub zaktualizuj APP-LEVEL credentials (tylko dla adminów)
 * Te credentials są wspólne dla całej aplikacji
 */
router.post('/', async (req, res) => {
  try {
    // Tylko admin może konfigurować app-level credentials
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Tylko administrator może konfigurować app-level credentials.' });
    }

    const { platform, clientId, clientSecret } = req.body;

    if (!platform || !clientId || !clientSecret) {
      return res.status(400).json({ message: 'Platform, clientId i clientSecret są wymagane.' });
    }

    if (!['olx', 'otodom'].includes(platform)) {
      return res.status(400).json({ message: 'Platform musi być "olx" lub "otodom".' });
    }

    // Zapisujemy app-level credentials (userId = null)
    const credentials = await ApiCredentials.findOneAndUpdate(
      { platform, userId: null },
      {
        platform,
        clientId,
        clientSecret,
        userId: null, // App-level
        isConfigured: true,
        isActive: false, // App-level credentials nie mają tokenów
      },
      { upsert: true, new: true }
    );

    res.json({
      platform: credentials.platform,
      clientId: credentials.clientId,
      isConfigured: credentials.isConfigured,
      isAppLevel: true,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Błąd zapisywania konfiguracji API.' });
  }
});

/**
 * POST /api/api-config/:platform/authorize
 * Rozpocznij proces autoryzacji OAuth 2.0 dla ZALOGOWANEGO UŻYTKOWNIKA
 * Zwraca URL do przekierowania użytkownika
 */
router.post('/:platform/authorize', async (req, res) => {
  try {
    const { platform } = req.params;
    
    // Pobierz app-level credentials (zawierają client_id i client_secret)
    const appCredentials = await ApiCredentials.findOne({ platform, userId: null });

    if (!appCredentials || !appCredentials.isConfigured) {
      return res.status(400).json({ 
        message: `${platform.toUpperCase()} API nie jest skonfigurowane. Administrator musi najpierw wprowadzić client_id i client_secret.` 
      });
    }

    // OAuth 2.0 authorization flow
    // Użytkownik zostanie przekierowany do OLX/Otodom, gdzie zaloguje się SWOIM kontem
    const redirectUri = `${req.protocol}://${req.get('host')}/api/api-config/${platform}/callback`;
    
    // Zapisz userId w state, żeby wiedzieć, dla kogo autoryzujemy (w callback)
    const state = Buffer.from(JSON.stringify({ userId: req.user._id.toString() })).toString('base64');
    
    const scope = encodeURIComponent('read write');
    let authUrl;
    if (platform === 'olx') {
      authUrl = `https://www.olx.pl/api/open/oauth/authorize?client_id=${encodeURIComponent(appCredentials.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
    } else if (platform === 'otodom') {
      authUrl = `https://www.otodom.pl/api/open/oauth/authorize?client_id=${encodeURIComponent(appCredentials.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
    }

    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd generowania URL autoryzacji.' });
  }
});

export default router;
