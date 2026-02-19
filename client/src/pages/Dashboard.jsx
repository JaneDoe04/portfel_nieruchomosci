import { useState, useEffect } from "react";
import { Building2, Key, AlertCircle } from "lucide-react";
import api from "../api/axios";
import StatusBadge from "../components/apartments/StatusBadge";
import RentStatusModal from "../components/apartments/RentStatusModal";

const API_BASE = import.meta.env.VITE_API_URL || "";

const getMainPhotoUrl = (apt) => {
	const raw = Array.isArray(apt.photos) && apt.photos.length > 0 ? apt.photos[0] : null;
	if (!raw) return null;
	if (raw.startsWith("http")) return raw;
	return `${API_BASE}${raw}`;
};

export default function Dashboard() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchApartments = () =>
    api
      .get("/apartments")
      .then(({ data }) => {
        setApartments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    fetchApartments();
  }, []);

  const wolne = apartments.filter((a) => a.status === "WOLNE").length;
  const wynajete = apartments.filter((a) => a.status === "WYNAJĘTE").length;
  const remanent = apartments.filter((a) => a.status === "REMANENT").length;
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringSoon = apartments.filter((a) => {
    if (a.status !== "WYNAJĘTE" || !a.contractEndDate) return false;
    const end = new Date(a.contractEndDate);
    return end <= in30Days && end >= now;
  });

  const expired = apartments.filter((a) => {
    if (a.status !== "WYNAJĘTE" || !a.contractEndDate) return false;
    const end = new Date(a.contractEndDate);
    return end < now;
  });

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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-3">
            <AlertCircle className="w-5 h-5" />
            Umowy kończące się w ciągu 30 dni
          </div>
          <ul className="space-y-2">
            {expiringSoon.map((apt) => (
              <li
                key={apt._id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">
                  {apt.title} – {apt.address}
                </span>
                <span className="text-amber-700 font-medium">
                  {new Date(apt.contractEndDate).toLocaleDateString("pl-PL")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-3">
            <AlertCircle className="w-5 h-5" />
            Umowy po terminie – wymagają Twojej decyzji
          </div>
          <ul className="space-y-2">
            {expired.map((apt) => (
              <li
                key={apt._id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">
                  {apt.title} – {apt.address}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-semibold">
                    Umowa wygasła
                  </span>
                  <span className="text-red-700 font-medium">
                    {new Date(apt.contractEndDate).toLocaleDateString("pl-PL")}
                  </span>
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
            {apartments.map((apt) => (
              <li
                key={apt._id}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/80 cursor-pointer"
                onClick={() => setSelected(apt)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {getMainPhotoUrl(apt) && (
                    <img
                      src={getMainPhotoUrl(apt)}
                      alt={apt.title}
                      className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{apt.title}</p>
                    <p className="text-sm text-slate-500 truncate">{apt.address}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={apt.status} />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    {apt.contractEndDate ? (
                      <>
                        <span>
                          Koniec umowy:{" "}
                          {new Date(apt.contractEndDate).toLocaleDateString("pl-PL")}
                        </span>
                        {new Date(apt.contractEndDate) < now && (
                          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold">
                            WYGASŁA
                          </span>
                        )}
                      </>
                    ) : (
                      "Brak daty końca"
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <RentStatusModal
          apartment={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            // Zamknij modal i odśwież dane po zapisaniu zmian (przycisk "Zapisz zmiany")
            setSelected(null);
            fetchApartments();
          }}
          onRefresh={async () => {
            // Tylko odśwież dane bez zamykania modala (dla automatycznego zapisu)
            try {
              await fetchApartments();
              // Po odświeżeniu, zaktualizuj selected z najnowszymi danymi z bazy
              const { data } = await api.get(`/apartments/${selected._id}`);
              console.log("[Dashboard] Refreshed apartment data:", {
                id: data._id,
                availableFrom: data.availableFrom,
              });
              setSelected(data);
              
              // Wyślij event do innych komponentów (np. ApartmentList) żeby odświeżyły dane
              // Używamy custom event żeby komunikować się między komponentami
              window.dispatchEvent(new CustomEvent('apartmentUpdated', { 
                detail: { apartmentId: data._id, apartment: data } 
              }));
            } catch (err) {
              console.error("[Dashboard] Error refreshing apartment:", err);
            }
          }}
        />
      )}
    </div>
  );
}
