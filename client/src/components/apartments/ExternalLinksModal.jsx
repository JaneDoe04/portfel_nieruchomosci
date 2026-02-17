import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import api from '../../api/axios';

export default function ExternalLinksModal({ apartment, onClose, onSave }) {
  const [form, setForm] = useState({
    olx: '',
    otodom: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (apartment) {
      setForm({
        olx: apartment.externalIds?.olx || '',
        otodom: apartment.externalIds?.otodom || '',
      });
    }
  }, [apartment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        externalIds: {
          olx: form.olx.trim() || null,
          otodom: form.otodom.trim() || null,
        },
      };

      await api.put(`/apartments/${apartment._id}`, payload);
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Wystąpił błąd zapisu.');
    } finally {
      setSaving(false);
    }
  };

  if (!apartment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            Linki do ogłoszeń
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Link do ogłoszenia OLX
              </label>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="url"
                  name="olx"
                  value={form.olx}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://www.olx.pl/..."
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Wklej link do ogłoszenia na OLX (opcjonalnie)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Link do ogłoszenia Otodom
              </label>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="url"
                  name="otodom"
                  value={form.otodom}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://www.otodom.pl/..."
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Wklej link do ogłoszenia na Otodom (opcjonalnie)
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              <p className="font-medium mb-1">💡 Wskazówka:</p>
              <p>
                Po opublikowaniu ogłoszenia na OLX lub Otodom, skopiuj link do ogłoszenia i wklej go tutaj. 
                Linki będą wyświetlane w liście mieszkań.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
