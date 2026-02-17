import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2, ExternalLink, Link2 } from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "./StatusBadge";
import ApartmentForm from "./ApartmentForm";
import ExternalLinksModal from "./ExternalLinksModal";

const API_BASE = import.meta.env.VITE_API_URL || "";

const getMainPhotoUrl = (apt) => {
	const raw = Array.isArray(apt.photos) && apt.photos.length > 0 ? apt.photos[0] : null;
	if (!raw) return null;
	if (raw.startsWith("http")) return raw;
	return `${API_BASE}${raw}`;
};

export default function ApartmentList() {
	const [apartments, setApartments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingApartment, setEditingApartment] = useState(null);
	const [linksModalOpen, setLinksModalOpen] = useState(false);
	const [selectedApartment, setSelectedApartment] = useState(null);

	const fetchApartments = async () => {
		setLoading(true);
		try {
			const { data } = await api.get("/apartments");
			setApartments(data);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchApartments();
	}, []);

	const handleSave = async (payload) => {
		if (editingApartment) {
			await api.put(`/apartments/${editingApartment._id}`, payload);
		} else {
			await api.post("/apartments", payload);
		}
		fetchApartments();
		setEditingApartment(null);
		setModalOpen(false);
	};

	const handleDelete = async (id) => {
		if (!window.confirm("Czy na pewno chcesz usunąć to mieszkanie?")) return;
		try {
			await api.delete(`/apartments/${id}`);
			fetchApartments();
		} catch (err) {
			alert(err.response?.data?.message || "Błąd usuwania.");
		}
	};

	const openEdit = (apt) => {
		setEditingApartment(apt);
		setModalOpen(true);
	};

	const openAdd = () => {
		setEditingApartment(null);
		setModalOpen(true);
	};

	const formatDate = (d) => (d ? new Date(d).toLocaleDateString("pl-PL") : "–");
	const formatPrice = (p) =>
		p != null ? `${Number(p).toLocaleString("pl-PL")} zł` : "–";

	const getFeedUrl = (platform) => {
		const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
		return `${baseUrl}/api/feeds/${platform}`;
	};

	const handleOpenFeed = (platform) => {
		const url = getFeedUrl(platform);
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	const openLinksModal = (apt) => {
		setSelectedApartment(apt);
		setLinksModalOpen(true);
	};

	const handleLinksSave = () => {
		fetchApartments();
	};

	return (
		<div className='p-6 lg:p-8'>
			<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
				<h1 className='text-2xl font-bold text-slate-800'>Mieszkania</h1>
				<button
					type='button'
					onClick={openAdd}
					className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm'
				>
					<Plus className='w-5 h-5' />
					Dodaj mieszkanie
				</button>
			</div>

			{loading ? (
				<div className='flex justify-center py-12'>
					<div className='animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent' />
				</div>
			) : apartments.length === 0 ? (
				<div className='bg-white rounded-xl border border-slate-200 p-12 text-center'>
					<Building2 className='w-12 h-12 text-slate-300 mx-auto mb-4' />
					<p className='text-slate-600'>
						Brak mieszkań w bazie. Użyj przycisku „Dodaj mieszkanie” u góry, aby
						dodać pierwsze.
					</p>
				</div>
			) : (
				<div className='bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm'>
					<div className='overflow-x-auto'>
						<table className='w-full'>
							<thead>
								<tr className='bg-slate-50 border-b border-slate-200'>
									<th className='text-left py-4 px-6 text-sm font-semibold text-slate-700'>
										Tytuł / Adres
									</th>
									<th className='text-right py-4 px-6 text-sm font-semibold text-slate-700'>
										Cena
									</th>
									<th className='text-right py-4 px-6 text-sm font-semibold text-slate-700'>
										m²
									</th>
									<th className='text-center py-4 px-6 text-sm font-semibold text-slate-700'>
										Publikacja
									</th>
									<th className='w-24 py-4 px-6' />
								</tr>
							</thead>
							<tbody>
								{apartments.map((apt) => (
									<tr
										key={apt._id}
										className='border-b border-slate-100 hover:bg-slate-50/50 transition-colors align-middle'
									>
										<td className='py-4 px-6'>
											<div className='flex items-center gap-4'>
												{getMainPhotoUrl(apt) ? (
													<img
														src={getMainPhotoUrl(apt)}
														alt={apt.title}
														className='w-32 h-24 rounded-lg object-cover flex-shrink-0 border border-slate-200'
													/>
												) : (
													<div className='w-32 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0'>
														<Building2 className='w-8 h-8' />
													</div>
												)}
												<div>
													<div className='font-semibold text-slate-900'>
														{apt.title}
													</div>
													<div className='text-sm text-slate-500'>
														{apt.address}
													</div>
												</div>
											</div>
										</td>
										<td className='py-4 px-6 text-right font-medium text-slate-800'>
											{formatPrice(apt.price)}
										</td>
										<td className='py-4 px-6 text-right text-slate-600'>
											{apt.area ?? "–"}
										</td>
										<td className='py-4 px-6'>
											<div className='flex flex-col items-center gap-2'>
												{apt.status === 'WOLNE' ? (
													<>
														<div className='flex items-center gap-2'>
															{apt.externalIds?.olx ? (
																<a
																	href={apt.externalIds.olx}
																	target='_blank'
																	rel='noopener noreferrer'
																	className='p-1.5 rounded text-orange-600 hover:bg-orange-50'
																	title='Otwórz ogłoszenie OLX'
																>
																	<ExternalLink className='w-4 h-4' />
																</a>
															) : (
																<button
																	type='button'
																	onClick={() => handleOpenFeed('olx')}
																	className='p-1.5 rounded text-slate-400 hover:bg-orange-50 hover:text-orange-600'
																	title='Otwórz feed OLX'
																>
																	<Link2 className='w-4 h-4' />
																</button>
															)}
															{apt.externalIds?.otodom ? (
																<a
																	href={apt.externalIds.otodom}
																	target='_blank'
																	rel='noopener noreferrer'
																	className='p-1.5 rounded text-blue-600 hover:bg-blue-50'
																	title='Otwórz ogłoszenie Otodom'
																>
																	<ExternalLink className='w-4 h-4' />
																</a>
															) : (
																<button
																	type='button'
																	onClick={() => handleOpenFeed('otodom')}
																	className='p-1.5 rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600'
																	title='Otwórz feed Otodom'
																>
																	<Link2 className='w-4 h-4' />
																</button>
															)}
														</div>
														<button
															type='button'
															onClick={() => openLinksModal(apt)}
															className='text-xs text-slate-500 hover:text-primary-600 underline'
															title='Zarządzaj linkami'
														>
															Linki
														</button>
													</>
												) : (
													<span className='text-xs text-slate-400'>–</span>
												)}
											</div>
										</td>
										<td className='py-4 px-6'>
											<div className='flex items-center gap-2'>
												<button
													type='button'
													onClick={() => openEdit(apt)}
													className='p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary-600'
													title='Edytuj'
												>
													<Pencil className='w-4 h-4' />
												</button>
												<button
													type='button'
													onClick={() => handleDelete(apt._id)}
													className='p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600'
													title='Usuń'
												>
													<Trash2 className='w-4 h-4' />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{modalOpen && (
				<ApartmentForm
					apartment={editingApartment}
					onSave={handleSave}
					onClose={() => {
						setModalOpen(false);
						setEditingApartment(null);
					}}
				/>
			)}

			{linksModalOpen && selectedApartment && (
				<ExternalLinksModal
					apartment={selectedApartment}
					onClose={() => {
						setLinksModalOpen(false);
						setSelectedApartment(null);
					}}
					onSave={handleLinksSave}
				/>
			)}
		</div>
	);
}
