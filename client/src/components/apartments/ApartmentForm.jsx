import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import api from '../../api/axios';

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
    images: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

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
        images: Array.isArray(apartment.photos) ? apartment.photos : [],
      });
    }
  }, [apartment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError('');
    setUploading(true);

    try {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const localUrl = URL.createObjectURL(file);

          try {
            const formData = new FormData();
            formData.append('image', file);
            const { data } = await api.post('/uploads', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (data?.url) {
              // Udało się wrzucić na serwer – używamy URL z backendu
              return data.url;
            }

            // Brak URL z backendu – używamy lokalnego podglądu
            return localUrl;
          } catch (err) {
            // Błąd uploadu jednego konkretnego pliku – logujemy i używamy lokalnego URL
            console.error(err);
            return localUrl;
          }
        })
      );

      const urlsToAdd = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean);

      if (!urlsToAdd.length) {
        setError('Nie udało się wysłać zdjęć na serwer, ale podgląd lokalny nadal działa.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...urlsToAdd],
      }));
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (index, direction) => {
    setForm((prev) => {
      const images = [...prev.images];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= images.length) return prev;
      const temp = images[index];
      images[index] = images[newIndex];
      images[newIndex] = temp;
      return { ...prev, images };
    });
  };

  const removeImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
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
        photos: form.images,
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Zdjęcia</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100 border border-primary-100"
                >
                  Wybierz zdjęcia
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
              {uploading && (
                <p className="mt-1 text-xs text-slate-500">Wysyłanie zdjęć...</p>
              )}
              <div className="mt-2 space-y-2">
                {form.images.length > 0 ? (
                  <>
                    <div className="space-y-2 pr-1 border border-slate-200 rounded-md bg-slate-50/60 p-1">
                      {form.images.map((url, index) => (
                        <div
                          key={url + index}
                          className="flex items-center gap-2 rounded bg-white p-2 shadow-sm"
                        >
                          <span className="text-xs font-semibold text-slate-600 w-5">
                            #{index + 1}
                          </span>
                          <img
                            src={url}
                            alt={`Zdjęcie ${index + 1}`}
                            className="w-20 h-16 object-cover rounded cursor-pointer"
                            onClick={() => setPreviewUrl(url)}
                          />
                          {index === 0 && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                              Główne
                            </span>
                          )}
                          <div className="ml-auto flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveImage(index, -1)}
                              disabled={index === 0}
                              className="px-2 py-1 rounded border border-slate-200 text-[11px] disabled:opacity-40"
                              title="W górę"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(index, 1)}
                              disabled={index === form.images.length - 1}
                              className="px-2 py-1 rounded border border-slate-200 text-[11px] disabled:opacity-40"
                              title="W dół"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="px-2 py-1 rounded border border-red-200 text-red-600 text-[11px]"
                              title="Usuń"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Brak zdjęć – wybierz pliki powyżej, a podgląd i kolejność zobaczysz tutaj.
                  </p>
                )}
              </div>
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

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
          onClick={() => setPreviewUrl('')}
        >
          <img
            src={previewUrl}
            alt="Podgląd zdjęcia"
            className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
