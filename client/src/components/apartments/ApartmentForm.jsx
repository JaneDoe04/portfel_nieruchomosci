import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import api from "../../api/axios";

const STATUS_OPTIONS = [
	{ value: "WOLNE", label: "Wolne" },
	{ value: "WYNAJĘTE", label: "Wynajęte" },
	{ value: "REMANENT", label: "Remanent" },
];

// Taksonomia Otodom – informacje dodatkowe, media, wyposażenie, zabezpieczenia
const EXTRAS_OPTIONS = [
	{ value: "balcony", label: "Balkon" },
	{ value: "usable-room", label: "Pom. użytkowe" },
	{ value: "garage", label: "Garaż/miejsce parkingowe" },
	{ value: "basement", label: "Piwnica" },
	{ value: "garden", label: "Ogródek" },
	{ value: "terrace", label: "Taras" },
	{ value: "two-storey", label: "Dwupoziomowe" },
	{ value: "separate-kitchen", label: "Oddzielna kuchnia" },
	{ value: "air-conditioning", label: "Klimatyzacja" },
];
const MEDIA_OPTIONS = [
	{ value: "internet", label: "Internet" },
	{ value: "cable-tv", label: "Telewizja kablowa" },
	{ value: "phone", label: "Telefon" },
];
const EQUIPMENT_OPTIONS = [
	{ value: "furniture", label: "Meble" },
	{ value: "washing-machine", label: "Pralka" },
	{ value: "dishwasher", label: "Zmywarka" },
	{ value: "fridge", label: "Lodówka" },
	{ value: "stove", label: "Kuchenka" },
	{ value: "oven", label: "Piekarnik" },
	{ value: "tv", label: "Telewizor" },
];
const SECURITY_OPTIONS = [
	{ value: "roller-shutters", label: "Rolety antywłamaniowe" },
	{ value: "anti-burglary-door", label: "Drzwi / okna antywłamaniowe" },
	{ value: "entryphone", label: "Domofon / wideofon" },
	{ value: "monitoring", label: "Monitoring / ochrona" },
	{ value: "alarm", label: "System alarmowy" },
	{ value: "closed-area", label: "Teren zamknięty" },
];

// Cechy budynku (Otodom taxonomy)
const BUILDING_TYPE_OPTIONS = [
	{ value: "infill", label: "Zabudowa śródścienna" },
	{ value: "block", label: "Blok" },
	{ value: "apartment", label: "Apartamentowiec" },
	{ value: "house", label: "Kamienica" },
	{ value: "ribbon", label: "Zabudowa szeregowa" },
	{ value: "tenement", label: "Kamienica" },
	{ value: "loft", label: "Loft" },
];
const BUILDING_MATERIAL_OPTIONS = [
	{ value: "brick", label: "Cegła" },
	{ value: "concrete", label: "Beton" },
	{ value: "reinforced-concrete", label: "Żelbet" },
	{ value: "cellular-concrete", label: "Beton komórkowy" },
	{ value: "concrete-plate", label: "Płyta betonowa" },
	{ value: "breeze-block", label: "Beton komórkowy (gazobeton)" },
	{ value: "silicate", label: "Silikat" },
	{ value: "hydroton", label: "Keramzyt" },
	{ value: "wood", label: "Drewno" },
	{ value: "other", label: "Inne" },
];
const WINDOWS_TYPE_OPTIONS = [
	{ value: "plastic", label: "Plastikowe" },
	{ value: "aluminium", label: "Aluminiowe" },
	{ value: "wooden", label: "Drewniane" },
];
const ENERGY_CERTIFICATE_OPTIONS = [
	{ value: "a-plus", label: "A+" },
	{ value: "a", label: "A" },
	{ value: "b", label: "B" },
	{ value: "b-minus", label: "B-" },
	{ value: "c", label: "C" },
	{ value: "d", label: "D" },
	{ value: "e", label: "E" },
	{ value: "f", label: "F" },
	{ value: "g", label: "G" },
	{ value: "exempt", label: "Zwolnione" },
];

export default function ApartmentForm({
	apartment = null,
	onSave,
	onClose,
	onApartmentUpdated,
}) {
	const [form, setForm] = useState({
		title: "",
		street: "",
		streetNumber: "",
		postalCode: "",
		city: "",
		price: "",
		description: "",
		area: "",
		numberOfRooms: "",
		heating: "",
		floor: "",
		finishingStatus: "",
		rentCharges: "",
		deposit: "",
		hasElevator: false,
		extras: [],
		mediaTypes: [],
		equipmentTypes: [],
		security: [],
		constructionYear: "",
		buildingType: "",
		buildingMaterial: "",
		windowsType: "",
		energyCertificate: "",
		status: "WOLNE", // status i data końca umowy będziemy edytować gdzie indziej
		contractEndDate: "",
		images: [],
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [uploading, setUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState("");
	const fileInputRef = useRef(null);

	useEffect(() => {
		if (apartment) {
			// Jeśli mieszkanie ma nowe pola (street, streetNumber, etc.), użyj ich
			// W przeciwnym razie spróbuj sparsować z address (kompatybilność wsteczna)
			let street = apartment.street || "";
			let streetNumber = apartment.streetNumber || "";
			let postalCode = apartment.postalCode || "";
			let city = apartment.city || "";

			// Jeśli brakuje nowych pól, spróbuj sparsować z address
			if (!street && !city && apartment.address) {
				const addressParts = apartment.address.split(",");
				if (addressParts.length >= 2) {
					// Parsuj "ul. Marszałkowska 15" -> "Marszałkowska" i "15"
					const streetPart = addressParts[0].trim();
					const streetMatch = streetPart.match(
						/^(ul\.|al\.|aleja|pl\.|os\.)?\s*(.+?)\s+(\d+[a-zA-Z]?(\s*\/\s*\d+)?)$/i,
					);
					if (streetMatch) {
						street = streetMatch[2].trim();
						streetNumber = streetMatch[3].trim();
					} else {
						// Jeśli nie ma numeru, całość to ulica
						street = streetPart
							.replace(/^(ul\.|al\.|aleja|pl\.|os\.)\s*/i, "")
							.trim();
					}

					// Ostatnia część to miasto (może zawierać kod pocztowy)
					const cityPart = addressParts[addressParts.length - 1].trim();
					const postalMatch = cityPart.match(/^(\d{2}-\d{3})\s+(.+)$/);
					if (postalMatch) {
						postalCode = postalMatch[1];
						city = postalMatch[2];
					} else {
						city = cityPart.replace(/\b\d{2}-\d{3}\b/g, "").trim();
					}
				}
			}

			setForm({
				title: apartment.title || "",
				street,
				streetNumber,
				postalCode,
				city,
				price: apartment.price ?? "",
				description: apartment.description || "",
				area: apartment.area ?? "",
				numberOfRooms: apartment.numberOfRooms ?? "",
				heating: apartment.heating || "",
				floor: apartment.floor || "",
				finishingStatus: apartment.finishingStatus || "",
				rentCharges: apartment.rentCharges ?? "",
				deposit: apartment.deposit ?? "",
				hasElevator: apartment.hasElevator || false,
				extras: Array.isArray(apartment.extras) ? [...apartment.extras] : [],
				mediaTypes: Array.isArray(apartment.mediaTypes) ? [...apartment.mediaTypes] : [],
				equipmentTypes: Array.isArray(apartment.equipmentTypes) ? [...apartment.equipmentTypes] : [],
				security: Array.isArray(apartment.security) ? [...apartment.security] : [],
				constructionYear: apartment.constructionYear ?? "",
				buildingType: apartment.buildingType || "",
				buildingMaterial: apartment.buildingMaterial || "",
				windowsType: apartment.windowsType || "",
				energyCertificate: apartment.energyCertificate || "",
				status: apartment.status || "WOLNE",
				contractEndDate: apartment.contractEndDate
					? apartment.contractEndDate.slice(0, 10)
					: "",
				images: Array.isArray(apartment.photos) ? apartment.photos : [],
			});

			// Powiadom parent component że dane mieszkania zostały załadowane/zaktualizowane
			if (onApartmentUpdated) {
				onApartmentUpdated(apartment);
			}
		}
	}, [apartment]);

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
		setError("");
	};

	const toggleArrayItem = (field, value) => {
		setForm((prev) => {
			const arr = prev[field] || [];
			const has = arr.includes(value);
			return {
				...prev,
				[field]: has ? arr.filter((v) => v !== value) : [...arr, value],
			};
		});
		setError("");
	};

	const handleImageChange = async (e) => {
		const files = Array.from(e.target.files || []);
		if (!files.length) return;

		setError("");
		setUploading(true);

		try {
			const results = await Promise.allSettled(
				files.map(async (file) => {
					const localUrl = URL.createObjectURL(file);

					try {
						const formData = new FormData();
						formData.append("image", file);
						const { data } = await api.post("/uploads", formData, {
							headers: { "Content-Type": "multipart/form-data" },
						});

						if (data?.url) {
							// Udało się wrzucić na serwer – budujemy pełny URL do backendu,
							// żeby podgląd działał także gdy frontend jest na innym porcie/domenie
							const base = import.meta.env.VITE_API_URL || "";
							if (data.url.startsWith("http")) {
								return data.url;
							}
							return `${base}${data.url}`;
						}

						// Brak URL z backendu – używamy lokalnego podglądu
						return localUrl;
					} catch (err) {
						// Błąd uploadu jednego konkretnego pliku – logujemy i używamy lokalnego URL
						console.error(err);
						return localUrl;
					}
				}),
			);

			const urlsToAdd = results
				.map((r) => (r.status === "fulfilled" ? r.value : null))
				.filter(Boolean);

			if (!urlsToAdd.length) {
				setError(
					"Nie udało się wysłać zdjęć na serwer, ale podgląd lokalny nadal działa.",
				);
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
		setError("");
		const price = Number(form.price);
		const area = Number(form.area);
		const numberOfRooms = form.numberOfRooms
			? Number(form.numberOfRooms)
			: null;
		if (!form.title.trim() || !form.street.trim() || !form.city.trim()) {
			setError("Tytuł, ulica i miasto są wymagane.");
			return;
		}
		if (isNaN(price) || price < 0 || isNaN(area) || area < 0) {
			setError("Cena i metraż muszą być liczbami nieujemnymi.");
			return;
		}
		if (
			numberOfRooms !== null &&
			(isNaN(numberOfRooms) || numberOfRooms < 1 || numberOfRooms > 10)
		) {
			setError("Liczba pokoi musi być liczbą od 1 do 10.");
			return;
		}
		setSaving(true);
		try {
			// Buduj pełny adres z osobnych pól (dla kompatybilności wstecznej)
			const addressParts = [];
			if (form.street.trim()) {
				const streetWithNumber = form.streetNumber.trim()
					? `${form.street.trim()} ${form.streetNumber.trim()}`
					: form.street.trim();
				addressParts.push(streetWithNumber);
			}
			if (form.postalCode.trim() || form.city.trim()) {
				const cityPart = [form.postalCode.trim(), form.city.trim()]
					.filter(Boolean)
					.join(" ");
				if (cityPart) addressParts.push(cityPart);
			}
			const fullAddress = addressParts.join(", ") || form.city.trim();

			const payload = {
				title: form.title.trim(),
				address: fullAddress, // Pełny adres dla kompatybilności wstecznej
				street: form.street.trim() || undefined,
				streetNumber: form.streetNumber.trim() || undefined,
				postalCode: form.postalCode.trim() || undefined,
				city: form.city.trim() || undefined,
				price,
				description: form.description.trim(),
				area,
				numberOfRooms: numberOfRooms || undefined,
				heating: form.heating || undefined,
				floor: form.floor || undefined,
				finishingStatus: form.finishingStatus || undefined,
				rentCharges: form.rentCharges ? Number(form.rentCharges) : undefined,
				deposit: form.deposit ? Number(form.deposit) : undefined,
				hasElevator: form.hasElevator,
				extras: form.extras || [],
				mediaTypes: form.mediaTypes || [],
				equipmentTypes: form.equipmentTypes || [],
				security: form.security || [],
				constructionYear: form.constructionYear ? Number(form.constructionYear) : undefined,
				buildingType: form.buildingType || undefined,
				buildingMaterial: form.buildingMaterial || undefined,
				windowsType: form.windowsType || undefined,
				energyCertificate: form.energyCertificate || undefined,
				// status i contractEndDate celowo NIE wysyłamy z tego formularza –
				// będą zarządzane z panelu głównego
				photos: form.images,
			};
			await onSave(payload);
			onClose();
		} catch (err) {
			setError(err.response?.data?.message || "Wystąpił błąd zapisu.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'
			onClick={onClose}
		>
			<div
				className='bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col mx-4 sm:mx-0'
				onClick={(e) => e.stopPropagation()}
			>
				<div className='flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200'>
					<h2 className='text-base sm:text-lg font-semibold text-slate-800'>
						{apartment ? "Edytuj mieszkanie" : "Dodaj mieszkanie"}
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700'
					>
						<X className='w-5 h-5' />
					</button>
				</div>
				<form
					onSubmit={handleSubmit}
					className='flex flex-col flex-1 overflow-hidden'
				>
					<div className='px-4 sm:px-6 py-4 overflow-y-auto space-y-4'>
						{error && (
							<div className='p-3 rounded-lg bg-red-50 text-red-700 text-sm'>
								{error}
							</div>
						)}
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-1'>
								Tytuł *
							</label>
							<input
								type='text'
								name='title'
								value={form.title}
								onChange={handleChange}
								className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								placeholder='np. Mieszkanie 2-pokojowe, Śródmieście'
							/>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='col-span-1 sm:col-span-2'>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Ulica *
								</label>
								<input
									type='text'
									name='street'
									value={form.street}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder="np. Marszałkowska (bez 'ul.' lub 'al.')"
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Numer
								</label>
								<input
									type='text'
									name='streetNumber'
									value={form.streetNumber}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='np. 15'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Kod pocztowy
								</label>
								<input
									type='text'
									name='postalCode'
									value={form.postalCode}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='00-001'
									pattern='\d{2}-\d{3}'
								/>
							</div>
							<div className='col-span-1 sm:col-span-2'>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Miasto *
								</label>
								<input
									type='text'
									name='city'
									value={form.city}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='np. Warszawa'
								/>
							</div>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Cena (zł/mies.) *
								</label>
								<input
									type='number'
									name='price'
									value={form.price}
									onChange={handleChange}
									min='0'
									step='1'
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Metraż (m²) *
								</label>
								<input
									type='number'
									name='area'
									value={form.area}
									onChange={handleChange}
									min='0'
									step='0.01'
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Liczba pokoi *
								</label>
								<input
									type='number'
									name='numberOfRooms'
									value={form.numberOfRooms}
									onChange={handleChange}
									min='1'
									max='10'
									step='1'
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='np. 2'
								/>
							</div>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Ogrzewanie
								</label>
								<select
									name='heating'
									value={form.heating}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								>
									<option value=''>Wybierz...</option>
									<option value='boiler-room'>Kotłownia</option>
									<option value='gas'>Gazowe</option>
									<option value='electrical'>Elektryczne</option>
									<option value='urban'>Miejskie</option>
									<option value='tiled-stove'>Piec kaflowy</option>
									<option value='other'>Inne</option>
								</select>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Piętro
								</label>
								<select
									name='floor'
									value={form.floor}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								>
									<option value=''>Wybierz...</option>
									<option value='cellar'>Piwnica</option>
									<option value='ground-floor'>Parter</option>
									<option value='1st-floor'>1. piętro</option>
									<option value='2nd-floor'>2. piętro</option>
									<option value='3rd-floor'>3. piętro</option>
									<option value='4th-floor'>4. piętro</option>
									<option value='5th-floor'>5. piętro</option>
									<option value='6th-floor'>6. piętro</option>
									<option value='7th-floor'>7. piętro</option>
									<option value='8th-floor'>8. piętro</option>
									<option value='9th-floor'>9. piętro</option>
									<option value='10th-floor'>10. piętro</option>
									<option value='11th-floor-and-above'>
										11. piętro i wyżej
									</option>
									<option value='garret'>Poddasze</option>
								</select>
							</div>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Stan wykończenia
								</label>
								<select
									name='finishingStatus'
									value={form.finishingStatus}
									onChange={handleChange}
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								>
									<option value=''>Wybierz...</option>
									<option value='to-complete'>Do wykończenia</option>
									<option value='ready-to-use'>Gotowe do zamieszkania</option>
									<option value='in-renovation'>W remoncie</option>
								</select>
							</div>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Czynsz (zł/mies.)
								</label>
								<input
									type='number'
									name='rentCharges'
									value={form.rentCharges}
									onChange={handleChange}
									min='0'
									step='1'
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='Opcjonalne'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-slate-700 mb-1'>
									Kaucja (zł)
								</label>
								<input
									type='number'
									name='deposit'
									value={form.deposit}
									onChange={handleChange}
									min='0'
									step='1'
									className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									placeholder='Opcjonalne'
								/>
							</div>
						</div>
						<div>
							<label className='flex items-center gap-2 cursor-pointer'>
								<input
									type='checkbox'
									name='hasElevator'
									checked={form.hasElevator}
									onChange={handleChange}
									className='w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500'
								/>
								<span className='text-sm font-medium text-slate-700'>
									Budynek ma windę
								</span>
							</label>
						</div>

						{/* Informacje dodatkowe (Otodom: extras) */}
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-2'>
								Informacje dodatkowe
							</label>
							<div className='flex flex-wrap gap-2'>
								{EXTRAS_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type='button'
										onClick={() => toggleArrayItem("extras", opt.value)}
										className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
											form.extras?.includes(opt.value)
												? "bg-primary-100 border-primary-300 text-primary-800"
												: "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
										}`}
									>
										{opt.label}
									</button>
								))}
							</div>
						</div>

						{/* Media (Otodom: media-types) */}
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-2'>
								Media
							</label>
							<div className='flex flex-wrap gap-2'>
								{MEDIA_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type='button'
										onClick={() => toggleArrayItem("mediaTypes", opt.value)}
										className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
											form.mediaTypes?.includes(opt.value)
												? "bg-primary-100 border-primary-300 text-primary-800"
												: "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
										}`}
									>
										{opt.label}
									</button>
								))}
							</div>
						</div>

						{/* Wyposażenie (Otodom: equipment-types) */}
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-2'>
								Wyposażenie
							</label>
							<div className='flex flex-wrap gap-2'>
								{EQUIPMENT_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type='button'
										onClick={() => toggleArrayItem("equipmentTypes", opt.value)}
										className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
											form.equipmentTypes?.includes(opt.value)
												? "bg-primary-100 border-primary-300 text-primary-800"
												: "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
										}`}
									>
										{opt.label}
									</button>
								))}
							</div>
						</div>

						{/* Zabezpieczenia (Otodom: security) */}
						<div>
							<label className='block text-sm font-medium text-slate-700 mb-2'>
								Zabezpieczenia
							</label>
							<div className='flex flex-wrap gap-2'>
								{SECURITY_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type='button'
										onClick={() => toggleArrayItem("security", opt.value)}
										className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
											form.security?.includes(opt.value)
												? "bg-primary-100 border-primary-300 text-primary-800"
												: "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
										}`}
									>
										{opt.label}
									</button>
								))}
							</div>
						</div>

						{/* Cechy budynku */}
						<div className='border-t border-slate-200 pt-4 mt-4'>
							<h3 className='text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2'>
								Cechy budynku
							</h3>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-slate-700 mb-1'>
										Rok budowy
									</label>
									<input
										type='number'
										name='constructionYear'
										value={form.constructionYear}
										onChange={handleChange}
										min='1800'
										max='2100'
										step='1'
										className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
										placeholder='np. 2020'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-slate-700 mb-1'>
										Rodzaj zabudowy
									</label>
									<select
										name='buildingType'
										value={form.buildingType}
										onChange={handleChange}
										className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									>
										<option value=''>Wybierz...</option>
										{BUILDING_TYPE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-slate-700 mb-1'>
										Materiał budynku
									</label>
									<select
										name='buildingMaterial'
										value={form.buildingMaterial}
										onChange={handleChange}
										className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									>
										<option value=''>Wybierz...</option>
										{BUILDING_MATERIAL_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-slate-700 mb-1'>
										Okna
									</label>
									<select
										name='windowsType'
										value={form.windowsType}
										onChange={handleChange}
										className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									>
										<option value=''>Wybierz...</option>
										{WINDOWS_TYPE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-slate-700 mb-1'>
										Certyfikat energetyczny
									</label>
									<select
										name='energyCertificate'
										value={form.energyCertificate}
										onChange={handleChange}
										className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
									>
										<option value=''>Wybierz...</option>
										{ENERGY_CERTIFICATE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>

						<div>
							<label className='block text-sm font-medium text-slate-700 mb-1'>
								Opis
							</label>
							<textarea
								name='description'
								value={form.description}
								onChange={handleChange}
								rows={3}
								className='w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
								placeholder='Krótki opis mieszkania...'
							/>
						</div>
						<div>
							<div className='flex items-center justify-between mb-1'>
								<label className='block text-sm font-medium text-slate-700'>
									Zdjęcia
								</label>
								<button
									type='button'
									onClick={() => fileInputRef.current?.click()}
									className='inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100 border border-primary-100'
								>
									Wybierz zdjęcia
								</button>
							</div>
							<input
								ref={fileInputRef}
								type='file'
								accept='image/*'
								multiple
								onChange={handleImageChange}
								className='hidden'
							/>
							{uploading && (
								<p className='mt-1 text-xs text-slate-500'>
									Wysyłanie zdjęć...
								</p>
							)}
							<div className='mt-2 space-y-2'>
								{form.images.length > 0 ? (
									<>
										<div className='space-y-2 pr-1 border border-slate-200 rounded-md bg-slate-50/60 p-1'>
											{form.images.map((url, index) => (
												<div
													key={url + index}
													className='flex items-center gap-2 rounded bg-white p-2 shadow-sm'
												>
													<span className='text-xs font-semibold text-slate-600 w-5'>
														#{index + 1}
													</span>
													<img
														src={url}
														alt={`Zdjęcie ${index + 1}`}
														className='w-20 h-16 object-cover rounded cursor-pointer'
														onClick={() => setPreviewUrl(url)}
													/>
													{index === 0 && (
														<span className='ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100'>
															Główne
														</span>
													)}
													<div className='ml-auto flex gap-1'>
														<button
															type='button'
															onClick={() => moveImage(index, -1)}
															disabled={index === 0}
															className='px-2 py-1 rounded border border-slate-200 text-[11px] disabled:opacity-40'
															title='W górę'
														>
															↑
														</button>
														<button
															type='button'
															onClick={() => moveImage(index, 1)}
															disabled={index === form.images.length - 1}
															className='px-2 py-1 rounded border border-slate-200 text-[11px] disabled:opacity-40'
															title='W dół'
														>
															↓
														</button>
														<button
															type='button'
															onClick={() => removeImage(index)}
															className='px-2 py-1 rounded border border-red-200 text-red-600 text-[11px]'
															title='Usuń'
														>
															✕
														</button>
													</div>
												</div>
											))}
										</div>
									</>
								) : (
									<p className='text-xs text-slate-400 italic'>
										Brak zdjęć – wybierz pliki powyżej, a podgląd i kolejność
										zobaczysz tutaj.
									</p>
								)}
							</div>
						</div>
					</div>
					<div className='px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm sm:text-base'
						>
							Anuluj
						</button>
						<button
							type='submit'
							disabled={saving}
							className='px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 text-sm sm:text-base'
						>
							{saving ? "Zapisywanie..." : apartment ? "Zapisz" : "Dodaj"}
						</button>
					</div>
				</form>
			</div>

			{previewUrl && (
				<div
					className='fixed inset-0 z-[60] flex items-center justify-center bg-black/70'
					onClick={(e) => {
						// Zatrzymujemy propagację, żeby kliknięcie w podgląd NIE zamykało całego modala mieszkania
						e.stopPropagation();
						setPreviewUrl("");
					}}
				>
					<img
						src={previewUrl}
						alt='Podgląd zdjęcia'
						className='max-w-[90vw] max-h-[90vh] rounded shadow-2xl'
						onClick={(e) => e.stopPropagation()}
					/>
				</div>
			)}
		</div>
	);
}
