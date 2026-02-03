import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'WOLNE', label: 'Wolne' },
  { value: 'WYNAJĘTE', label: 'Wynajęte' },
  { value: 'REMANENT', label: 'Remanent' },
];

export default function ApartmentForm({ apartment = null, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '',
    address: '',
    price: '',
    description: '',
    area: '',
    status: 'WOLNE',
    contractEndDate: '',
    photos: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (apartment) {
      setForm({
        title: apartment.title || '',
        address: apartment.address || '',
        price: apartment.price ?? '',
        description: apartment.description || '',
        area: apartment.area ?? '',
        status: apartment.status || 'WOLNE',
        contractEndDate: apartment.contractEndDate
          ? apartment.contractEndDate.slice(0, 10)
          : '',
        photos: Array.isArray(apartment.photos) ? apartment.photos.join('\n') : '',
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
    const price = Number(form.price);
    const area = Number(form.area);
    if (!form.title.trim() || !form.address.trim()) {
      setError('Tytuł i adres są wymagane.');
      return;
    }
    if (isNaN(price) || price < 0 || isNaN(area) || area < 0) {
      setError('Cena i metraż muszą być liczbami nieujemnymi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        address: form.address.trim(),
        price,
        description: form.description.trim(),
        area,
        status: form.status,
        contractEndDate: form.contractEndDate || null,
        photos: form.photos
          ? form.photos
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Wystąpił błąd zapisu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {apartment ? 'Edytuj mieszkanie' : 'Dodaj mieszkanie'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="np. Mieszkanie 2-pokojowe, Śródmieście"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adres *</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="ul. Przykładowa 1, 00-001 Warszawa"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cena (zł/mies.) *</label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metraż (m²) *</label>
                <input
                  type="number"
                  name="area"
                  value={form.area}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data końca umowy</label>
              <input
                type="date"
                name="contractEndDate"
                value={form.contractEndDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Krótki opis mieszkania..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zdjęcia (URL, jeden w linii)</label>
              <textarea
                name="photos"
                value={form.photos}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                placeholder="https://example.com/photo1.jpg"
              />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Zapisywanie...' : apartment ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
