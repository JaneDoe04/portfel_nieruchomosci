import express from 'express';
import axios from 'axios';
import ApiCredentials from '../models/ApiCredentials.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const getPublicBaseUrl = (req) => {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .toString()
    .split(',')[0]
    .trim();
  return `${proto}://${req.get('host')}`;
};

/**
 * GET /api/api-config/:platform/callback
 * Callback OAuth 2.0 – PUBLIC (bez protect), bo OLX przekierowuje tu przeglądarkę bez tokena.
 */
router.get('/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    console.log('[oauth/callback] start', {
      platform,
      hasCode: Boolean(code),
      hasState: Boolean(state),
      host: req.get('host'),
      xfp: req.headers['x-forwarded-proto'],
    });

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

    const redirectUri = `${getPublicBaseUrl(req)}/api/api-config/${platform}/callback`;

    let tokenResponse;
    if (platform === 'otodom') {
      // OLX Group Real Estate OAuth: exchange code via api.olxgroup.com
      if (!appCredentials.apiKey) {
        return res.status(400).send('Brak API KEY (X-API-KEY) dla Otodom. Dodaj go w Ustawieniach API.');
      }
      const basic = Buffer.from(`${appCredentials.clientId}:${appCredentials.clientSecret}`, 'utf8').toString('base64');
      console.log('[oauth/callback] exchanging token (otodom)', { redirectUri, userId });
      tokenResponse = await axios.post(
        'https://api.olxgroup.com/oauth/v1/token',
        { grant_type: 'authorization_code', code },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${basic}`,
            'X-API-KEY': appCredentials.apiKey,
            'User-Agent': 'PortfelNieruchomosci',
          },
        }
      );
    } else {
      // OLX PL flow (placeholder) – can be adjusted when OLX API access is ready
      console.log('[oauth/callback] exchanging token (olx)', { redirectUri, userId });
      tokenResponse = await axios.post('https://www.olx.pl/api/open/oauth/token', {
        grant_type: 'authorization_code',
        code,
        client_id: appCredentials.clientId,
        client_secret: appCredentials.clientSecret,
        redirect_uri: redirectUri,
      });
    }

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log('[oauth/callback] token OK', { platform, userId, expires_in });

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

    const { platform, clientId, clientSecret, apiKey } = req.body;

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
        apiKey: apiKey || null,
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
    const redirectUri = `${getPublicBaseUrl(req)}/api/api-config/${platform}/callback`;
    
    // Zapisz userId w state, żeby wiedzieć, dla kogo autoryzujemy (w callback)
    const state = Buffer.from(JSON.stringify({ userId: req.user._id.toString() })).toString('base64');
    
    let authUrl;
    if (platform === 'olx') {
      const scope = encodeURIComponent('read write');
      authUrl = `https://www.olx.pl/api/open/oauth/authorize?client_id=${encodeURIComponent(appCredentials.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
    } else if (platform === 'otodom') {
      // OLX Group Real Estate: authorize on site domain
      authUrl = `https://www.otodom.pl/pl/crm/authorization/?response_type=code&client_id=${encodeURIComponent(appCredentials.clientId)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    console.log('[oauth/authorize]', {
      platform,
      userId: req.user?._id?.toString(),
      redirectUri,
      hasClientId: Boolean(appCredentials?.clientId),
      hasApiKey: Boolean(appCredentials?.apiKey),
    });
    res.json({ authUrl, redirectUri });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Błąd generowania URL autoryzacji.' });
  }
});

export default router;
