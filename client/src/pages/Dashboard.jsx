import { useState, useEffect } from 'react';
import { Building2, Key, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import StatusBadge from '../components/apartments/StatusBadge';

export default function Dashboard() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/apartments').then(({ data }) => {
      setApartments(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const wolne = apartments.filter((a) => a.status === 'WOLNE').length;
  const wynajete = apartments.filter((a) => a.status === 'WYNAJĘTE').length;
  const remanent = apartments.filter((a) => a.status === 'REMANENT').length;
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringSoon = apartments.filter(
    (a) => a.status === 'WYNAJĘTE' && a.contractEndDate && new Date(a.contractEndDate) <= in30Days && new Date(a.contractEndDate) >= now
  );

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Panel główny</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Wszystkie</p>
              <p className="text-2xl font-bold text-slate-800">{apartments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Wolne</p>
              <p className="text-2xl font-bold text-emerald-700">{wolne}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Wynajęte</p>
              <p className="text-2xl font-bold text-amber-700">{wynajete}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Remanent</p>
              <p className="text-2xl font-bold text-slate-700">{remanent}</p>
            </div>
          </div>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-3">
            <AlertCircle className="w-5 h-5" />
            Umowy kończące się w ciągu 30 dni
          </div>
          <ul className="space-y-2">
            {expiringSoon.map((apt) => (
              <li key={apt._id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{apt.title} – {apt.address}</span>
                <span className="text-amber-700 font-medium">
                  {new Date(apt.contractEndDate).toLocaleDateString('pl-PL')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <h2 className="px-6 py-4 border-b border-slate-200 text-lg font-semibold text-slate-800">
          Ostatnie mieszkania
        </h2>
        {apartments.length === 0 ? (
          <p className="p-6 text-slate-500">Brak mieszkań w bazie.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {apartments.slice(0, 8).map((apt) => (
              <li key={apt._id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50">
                <div>
                  <p className="font-medium text-slate-800">{apt.title}</p>
                  <p className="text-sm text-slate-500">{apt.address}</p>
                </div>
                <StatusBadge status={apt.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
