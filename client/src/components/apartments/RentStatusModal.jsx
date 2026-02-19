import { useState } from "react";
import {
	X,
	UploadCloud,
	RefreshCw,
	Trash2,
	CheckCircle2,
	AlertCircle,
	Info,
} from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "./StatusBadge";

const STATUS_OPTIONS = [
	{ value: "WOLNE", label: "Wolne" },
	{ value: "WYNAJĘTE", label: "Wynajęte" },
	{ value: "REMANENT", label: "Remanent" },
];

const API_BASE = import.meta.env.VITE_API_URL || "";

const getMainPhotoUrl = (apt) => {
	const raw =
		Array.isArray(apt.photos) && apt.photos.length > 0 ? apt.photos[0] : null;
	if (!raw) return null;
	if (raw.startsWith("http")) return raw;
	return `${API_BASE}${raw}`;
};

export default function RentStatusModal({
	apartment,
	onClose,
	onUpdated,
	onRefresh,
}) {
	const [status, setStatus] = useState(apartment.status || "WOLNE");
	const [contractEndDate, setContractEndDate] = useState(
		apartment.contractEndDate ? apartment.contractEndDate.slice(0, 10) : "",
	);
	const [availableFrom, setAvailableFrom] = useState(
		apartment.availableFrom ? apartment.availableFrom.slice(0, 10) : "",
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState("");
	const [publishSuccess, setPublishSuccess] = useState("");
	const [checkingStatus, setCheckingStatus] = useState(false);
	const [statusInfo, setStatusInfo] = useState(null);

	const handleSave = async (e) => {
		e.preventDefault();
		setError("");

		// Jeśli mieszkanie ma być wynajęte, data końca umowy jest obowiązkowa
		if (status === "WYNAJĘTE" && !contractEndDate) {
			setError("Dla statusu „Wynajęte” musisz ustalić datę końca umowy.");
			return;
		}

		setSaving(true);
		try {
			await api.put(`/apartments/${apartment._id}`, {
				status,
				// jeśli mieszkanie NIE jest wynajęte, nie trzymamy daty końca umowy
				contractEndDate:
					status === "WYNAJĘTE" && contractEndDate ? contractEndDate : null,
				// dostępne od - data kiedy mieszkanie będzie dostępne do wynajęcia
				availableFrom: availableFrom || null,
			});
			onUpdated?.();
		} catch (err) {
			console.error(err);
			alert(
				err.response?.data?.message || "Nie udało się zaktualizować wynajmu.",
			);
		} finally {
			setSaving(false);
		}
	};

	const canPublishNow = apartment.status === "WOLNE";
	const statusWillBeFree = status === "WOLNE";
	const needsSaveToPublish = statusWillBeFree && apartment.status !== "WOLNE";

	const handlePublishOtodom = async () => {
		setPublishError("");
		setPublishSuccess("");
		if (!canPublishNow) {
			setPublishError(
				"Można publikować na Otodom tylko mieszkania ze statusem „Wolne”.",
			);
			return;
		}
		setPublishing(true);
		try {
			const { data } = await api.post(`/publish/${apartment._id}/otodom`);
			const successMsg =
				data?.message ||
				"Ogłoszenie zostało wysłane do Otodom. Publikacja może potrwać kilka minut.";
			setPublishSuccess(successMsg);
			alert(`✅ ${successMsg}`);
			onUpdated?.();
		} catch (err) {
			const errorMsg =
				err.response?.data?.message || "Nie udało się opublikować na Otodom.";
			setPublishError(errorMsg);
			alert(`❌ ${errorMsg}`);
		} finally {
			setPublishing(false);
		}
	};

	const handleUpdateOtodom = async () => {
		setPublishError("");
		setPublishSuccess("");
		if (!apartment.externalIds?.otodom) {
			setPublishError(
				"Brak ogłoszenia Otodom do aktualizacji (najpierw opublikuj).",
			);
			return;
		}
		setPublishing(true);
		try {
			const { data } = await api.put(`/publish/${apartment._id}/otodom`);
			const successMsg =
				data?.message || "Ogłoszenie zostało zaktualizowane na Otodom.";
			setPublishSuccess(successMsg);
			alert(`✅ ${successMsg}`);
			onUpdated?.();
		} catch (err) {
			const errorMsg =
				err.response?.data?.message || "Nie udało się zaktualizować na Otodom.";
			setPublishError(errorMsg);
			alert(`❌ ${errorMsg}`);
		} finally {
			setPublishing(false);
		}
	};

	const handleDeleteOtodom = async () => {
		setPublishError("");
		setPublishSuccess("");
		if (!apartment.externalIds?.otodom) {
			setPublishError("Brak ogłoszenia Otodom do usunięcia.");
			return;
		}
		if (!window.confirm("Czy na pewno chcesz usunąć ogłoszenie z Otodom?"))
			return;
		setPublishing(true);
		try {
			const { data } = await api.delete(`/publish/${apartment._id}/otodom`);
			const successMsg =
				data?.message || "Ogłoszenie zostało usunięte z Otodom.";
			setPublishSuccess(successMsg);
			alert(`✅ ${successMsg}`);
			onUpdated?.();
		} catch (err) {
			const errorMsg =
				err.response?.data?.message || "Nie udało się usunąć z Otodom.";
			setPublishError(errorMsg);
			alert(`❌ ${errorMsg}`);
		} finally {
			setPublishing(false);
		}
	};

	const handleCheckStatus = async () => {
		if (!apartment.externalIds?.otodom) {
			setPublishError("Brak ogłoszenia Otodom do sprawdzenia.");
			return;
		}
		setCheckingStatus(true);
		setPublishError("");
		setPublishSuccess("");
		setStatusInfo(null);
		try {
			const { data } = await api.get(`/publish/${apartment._id}/otodom/status`);
			setStatusInfo(data.status);

			if (data.isTransactionId || data.message) {
				// To jest transaction_id - webhook jeszcze nie przyszedł
				setPublishSuccess(
					data.message ||
						"Ogłoszenie jest w trakcie publikacji. Czekamy na webhook z Otodom.",
				);
			} else {
				// To jest object_id - mamy prawdziwy status
				const statusMsg = `Status: ${data.status?.state?.code || data.status?.last_action_status || "Nieznany"}`;
				setPublishSuccess(statusMsg);
			}
		} catch (err) {
			const errorMsg =
				err.response?.data?.message || "Nie udało się sprawdzić statusu.";
			setPublishError(errorMsg);
		} finally {
			setCheckingStatus(false);
		}
	};

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
			onClick={onClose}
		>
			<div
				className='bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden'
				onClick={(e) => e.stopPropagation()}
			>
				<header className='px-6 py-4 border-b border-slate-200 flex items-center justify-between'>
					<div>
						<h2 className='text-lg font-semibold text-slate-900'>
							Zarządzanie wynajmem
						</h2>
						<p className='text-xs text-slate-500'>
							{apartment.title} – {apartment.address}
						</p>
					</div>
					<button
						type='button'
						onClick={onClose}
						className='p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700'
					>
						<X className='w-5 h-5' />
					</button>
				</header>

				<div className='px-6 py-4 flex gap-4'>
					{getMainPhotoUrl(apartment) ? (
						<img
							src={getMainPhotoUrl(apartment)}
							alt={apartment.title}
							className='w-40 h-32 rounded-xl object-cover border border-slate-200 flex-shrink-0'
						/>
					) : (
						<div className='w-40 h-32 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0'>
							<StatusBadge status={status} />
						</div>
					)}
					<div className='flex-1 space-y-3'>
						<div>
							<p className='text-xs uppercase tracking-wide text-slate-500'>
								Aktualny status
							</p>
							<div className='mt-1'>
								<StatusBadge status={apartment.status} />
							</div>
						</div>
						<div className='grid grid-cols-2 gap-4 text-sm text-slate-600'>
							<div>
								<p className='text-xs uppercase tracking-wide text-slate-400'>
									Cena
								</p>
								<p className='font-medium'>
									{apartment.price != null
										? `${Number(apartment.price).toLocaleString("pl-PL")} zł`
										: "–"}
								</p>
							</div>
							<div>
								<p className='text-xs uppercase tracking-wide text-slate-400'>
									Metraż
								</p>
								<p className='font-medium'>
									{apartment.area != null ? `${apartment.area} m²` : "–"}
								</p>
							</div>
						</div>
					</div>
				</div>

				<form
					onSubmit={handleSave}
					className='px-6 pb-5 pt-2 border-t border-slate-200 space-y-4'
				>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-1'>
								Nowy status
							</label>
							<select
								value={status}
								onChange={(e) => {
									const next = e.target.value;
									setStatus(next);
									// przy zmianie na WOLNE lub REMANENT automatycznie czyścimy datę końca
									if (next !== "WYNAJĘTE") {
										setContractEndDate("");
									}
								}}
								className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm'
							>
								{STATUS_OPTIONS.map((opt) => (
									<option
										key={opt.value}
										value={opt.value}
									>
										{opt.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-1'>
								Data końca umowy
							</label>
							<input
								type='date'
								value={contractEndDate}
								onChange={(e) => setContractEndDate(e.target.value)}
								disabled={status !== "WYNAJĘTE"}
								className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm disabled:bg-slate-50 disabled:text-slate-400'
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-1'>
								Dostępne od
							</label>
							<input
								type='date'
								value={availableFrom}
								onChange={async (e) => {
									const newDate = e.target.value;
									const previousDate = availableFrom; // Zapisz poprzednią wartość
									setAvailableFrom(newDate); // Najpierw zaktualizuj UI

									// Automatycznie zapisz datę bez czekania na "Zapisz zmiany"
									// To jest ważne dla publikacji - data musi być dostępna od razu
									try {
										// Konwertuj pusty string na null (Mongoose potrzebuje null zamiast "")
										const dateToSave = newDate && newDate.trim() ? newDate : null;
										
										console.log(
											"[RentStatusModal] Zapisuję availableFrom:",
											{
												raw: newDate,
												toSave: dateToSave,
												apartmentId: apartment._id,
											},
										);
										
										const response = await api.put(
											`/apartments/${apartment._id}`,
											{
												availableFrom: dateToSave,
											},
										);
										
										console.log(
											"[RentStatusModal] ✅ Data dostępności zapisana:",
											{
												requested: dateToSave,
												saved: response.data?.availableFrom,
												fullResponse: response.data,
											},
										);

										// Odśwież dane mieszkania w tle (bez zamykania modala)
										// Używamy onRefresh zamiast onUpdated żeby nie zamykać modala
										if (onRefresh) {
											onRefresh();
										}
									} catch (err) {
										console.error(
											"[RentStatusModal] ❌ Błąd zapisu daty dostępności:",
											err,
										);
										console.error(
											"[RentStatusModal] Response:",
											err.response?.data,
										);
										// Wróć do poprzedniej wartości przy błędzie
										setAvailableFrom(previousDate);
										alert(
											`Nie udało się zapisać daty dostępności: ${err.response?.data?.message || err.message}`,
										);
									}
								}}
								className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm'
								placeholder='Data dostępności mieszkania'
							/>
							<p className='mt-1 text-xs text-slate-500'>
								Data od kiedy mieszkanie będzie dostępne do wynajęcia
								(wyświetlana w ogłoszeniu Otodom). Zapisuje się automatycznie.
							</p>
						</div>
					</div>

					<div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
						<p className='text-sm font-semibold text-slate-800 mb-1'>
							Publikacja Otodom
						</p>
						<p className='text-xs text-slate-600 mb-3'>
							Przycisk jest aktywny tylko, gdy mieszkanie ma status{" "}
							<span className='font-semibold'>Wolne</span>.
						</p>
						{needsSaveToPublish && (
							<p className='text-xs text-amber-700 mb-3'>
								Ustawiłeś status „Wolne”, ale nie jest jeszcze zapisany.
								Najpierw kliknij „Zapisz zmiany”, a potem publikuj.
							</p>
						)}
						<div className='flex flex-wrap gap-2'>
							<button
								type='button'
								onClick={handlePublishOtodom}
								disabled={publishing || saving || !canPublishNow}
								className='inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm'
								title='Opublikuj na Otodom'
							>
								<UploadCloud className='w-4 h-4' />
								{publishing ? "Wysyłanie..." : "Publikuj"}
							</button>
							<button
								type='button'
								onClick={handleUpdateOtodom}
								disabled={
									publishing || saving || !apartment.externalIds?.otodom
								}
								className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-sm'
								title='Aktualizuj ogłoszenie na Otodom'
							>
								<RefreshCw className='w-4 h-4' />
								Aktualizuj
							</button>
							<button
								type='button'
								onClick={handleDeleteOtodom}
								disabled={
									publishing || saving || !apartment.externalIds?.otodom
								}
								className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm'
								title='Usuń ogłoszenie z Otodom'
							>
								<Trash2 className='w-4 h-4' />
								Usuń
							</button>
							{apartment.externalIds?.otodom && (
								<button
									type='button'
									onClick={handleCheckStatus}
									disabled={checkingStatus || saving}
									className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm'
									title='Sprawdź status ogłoszenia na Otodom'
								>
									<Info className='w-4 h-4' />
									{checkingStatus ? "Sprawdzanie..." : "Status"}
								</button>
							)}
						</div>
						{statusInfo && (
							<div className='mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200'>
								<p className='text-xs font-semibold text-blue-800 mb-2'>
									Szczegóły statusu:
								</p>
								<pre className='text-xs text-blue-700 overflow-auto max-h-40'>
									{JSON.stringify(statusInfo, null, 2)}
								</pre>
							</div>
						)}
						{publishError && (
							<div className='mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200'>
								<AlertCircle className='w-4 h-4 text-red-600 flex-shrink-0 mt-0.5' />
								<p className='text-sm text-red-700 flex-1'>{publishError}</p>
							</div>
						)}
						{publishSuccess && (
							<div className='mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200'>
								<CheckCircle2 className='w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5' />
								<p className='text-sm text-emerald-700 flex-1'>
									{publishSuccess}
								</p>
							</div>
						)}
					</div>

					<div className='flex justify-end gap-3 pt-2'>
						<button
							type='button'
							onClick={onClose}
							className='px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm'
						>
							Anuluj
						</button>
						<button
							type='submit'
							disabled={saving}
							className='px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 text-sm'
						>
							{saving ? "Zapisywanie..." : "Zapisz zmiany"}
						</button>
					</div>
					{error && (
						<p className='mt-2 text-xs text-red-600 text-right'>{error}</p>
					)}
				</form>
			</div>
		</div>
	);
}
