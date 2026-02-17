import { useState, useEffect } from 'react';
import { Save, Key, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import api from '../api/axios';

export default function ApiSettings() {
  const [configs, setConfigs] = useState({ appLevel: [], userLevel: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    olx: { clientId: '', clientSecret: '' },
    otodom: { clientId: '', clientSecret: '' },
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data } = await api.get('/api-config');
      setConfigs(data);
      
      // Wypełnij formularz istniejącymi danymi (bez secret)
      (data?.appLevel || []).forEach((config) => {
        if (config.platform === 'olx' || config.platform === 'otodom') {
          setFormData((prev) => ({
            ...prev,
            [config.platform]: {
              clientId: config.clientId || '',
              clientSecret: '', // Nie pokazujemy secret
            },
          }));
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (platform, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
    setError('');
    setSuccess('');
  };

  const handleSave = async (platform) => {
    const data = formData[platform];
    if (!data.clientId || !data.clientSecret) {
      setError(`Wprowadź Client ID i Client Secret dla ${platform.toUpperCase()}`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api-config', {
        platform,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
      });

      setSuccess(`Konfiguracja ${platform.toUpperCase()} zapisana pomyślnie!`);
      fetchConfigs();
    } catch (err) {
      setError(err.response?.data?.message || `Błąd zapisywania konfiguracji ${platform.toUpperCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async (platform) => {
    try {
      const { data } = await api.post(`/api-config/${platform}/authorize`);
      
      // Otwórz okno autoryzacji
      const authWindow = window.open(
        data.authUrl,
        'oauth',
        'width=600,height=700,scrollbars=yes'
      );

      // Nasłuchuj na wiadomość z callback
      const messageListener = (event) => {
        if (event.data.type === 'oauth_success' && event.data.platform === platform) {
          setSuccess(`Autoryzacja ${platform.toUpperCase()} zakończona pomyślnie!`);
          fetchConfigs();
          window.removeEventListener('message', messageListener);
        }
      };

      window.addEventListener('message', messageListener);
    } catch (err) {
      setError(err.response?.data?.message || `Błąd autoryzacji ${platform.toUpperCase()}`);
    }
  };

  const getAppConfig = (platform) => {
    return (configs?.appLevel || []).find((c) => c.platform === platform);
  };

  const getUserConfig = (platform) => {
    return (configs?.userLevel || []).find((c) => c.platform === platform);
  };

  const isConfigured = (platform) => Boolean(getAppConfig(platform)?.isConfigured);
  const isActive = (platform) => Boolean(getUserConfig(platform)?.isActive);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Konfiguracja API</h1>
        <p className="text-slate-600">
          Skonfiguruj integrację z OLX i Otodom, aby automatycznie publikować ogłoszenia.
        </p>
        <a
          href="https://developer.olx.pl/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 text-primary-600 hover:text-primary-700 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Zarejestruj się w OLX Developer Portal
        </a>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 text-green-700 text-sm">{success}</div>
      )}

      <div className="space-y-6">
        {/* OLX Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-slate-800">OLX</h2>
            </div>
            {isActive('olx') ? (
              <span className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Aktywne
              </span>
            ) : isConfigured('olx') ? (
              <span className="flex items-center gap-2 text-yellow-600 text-sm">
                <XCircle className="w-4 h-4" />
                Wymaga autoryzacji
              </span>
            ) : (
              <span className="text-slate-400 text-sm">Nie skonfigurowane</span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={formData.olx.clientId}
                onChange={(e) => handleChange('olx', 'clientId', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Twój Client ID z OLX Developer Portal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={formData.olx.clientSecret}
                onChange={(e) => handleChange('olx', 'clientSecret', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Twój Client Secret z OLX Developer Portal"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave('olx')}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Zapisz
              </button>

              {isConfigured('olx') && !isActive('olx') && (
                <button
                  type="button"
                  onClick={() => handleAuthorize('olx')}
                  className="px-4 py-2 rounded-lg border border-primary-600 text-primary-600 font-medium hover:bg-primary-50"
                >
                  Autoryzuj
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Otodom Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">Otodom</h2>
            </div>
            {isActive('otodom') ? (
              <span className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Aktywne
              </span>
            ) : isConfigured('otodom') ? (
              <span className="flex items-center gap-2 text-yellow-600 text-sm">
                <XCircle className="w-4 h-4" />
                Wymaga autoryzacji
              </span>
            ) : (
              <span className="text-slate-400 text-sm">Nie skonfigurowane</span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={formData.otodom.clientId}
                onChange={(e) => handleChange('otodom', 'clientId', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Twój Client ID z Otodom Developer Portal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={formData.otodom.clientSecret}
                onChange={(e) => handleChange('otodom', 'clientSecret', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Twój Client Secret z Otodom Developer Portal"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave('otodom')}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Zapisz
              </button>

              {isConfigured('otodom') && !isActive('otodom') && (
                <button
                  type="button"
                  onClick={() => handleAuthorize('otodom')}
                  className="px-4 py-2 rounded-lg border border-primary-600 text-primary-600 font-medium hover:bg-primary-50"
                >
                  Autoryzuj
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <p className="font-medium mb-2">💡 Wskazówka:</p>
        <p>
          Po zapisaniu credentials, kliknij "Autoryzuj", aby połączyć aplikację z Twoim kontem OLX/Otodom.
          Zostaniesz przekierowany do strony logowania, gdzie musisz zaakceptować uprawnienia.
        </p>
      </div>
    </div>
  );
}
