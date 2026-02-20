import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "./StatusBadge";
import ApartmentForm from "./ApartmentForm";

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
    
    // Nasłuchuj na eventy aktualizacji mieszkania z innych komponentów (np. RentStatusModal)
    const handleApartmentUpdated = (event) => {
      const { apartmentId, apartment } = event.detail;
      
      // Jeśli formularz jest otwarty dla tego mieszkania, zaktualizuj editingApartment
      if (editingApartment && editingApartment._id === apartmentId) {
        setEditingApartment(apartment);
      }
      
      // Odśwież listę mieszkań
      fetchApartments();
    };
    
    window.addEventListener('apartmentUpdated', handleApartmentUpdated);
    
    return () => {
      window.removeEventListener('apartmentUpdated', handleApartmentUpdated);
    };
  }, [editingApartment]);

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

	return (
		<div className='p-4 sm:p-6 lg:p-8 pl-16 sm:pl-6 lg:pl-8'>
			<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6'>
				<h1 className='text-xl sm:text-2xl font-bold text-slate-800'>Mieszkania</h1>
				<button
					type='button'
					onClick={openAdd}
					className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm text-sm sm:text-base'
				>
					<Plus className='w-4 h-4 sm:w-5 sm:h-5' />
					<span className="sm:inline">Dodaj mieszkanie</span>
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
				<>
					{/* Mobile card view */}
					<div className='lg:hidden space-y-4'>
						{apartments.map((apt) => (
							<div
								key={apt._id}
								className='bg-white rounded-xl border border-slate-200 p-4 shadow-sm'
							>
								<div className='flex items-start gap-3 mb-3'>
									{getMainPhotoUrl(apt) ? (
										<img
											src={getMainPhotoUrl(apt)}
											alt={apt.title}
											className='w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-slate-200'
										/>
									) : (
										<div className='w-20 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0'>
											<Building2 className='w-6 h-6' />
										</div>
									)}
									<div className='flex-1 min-w-0'>
										<div className='font-semibold text-slate-900 text-sm mb-1 truncate'>
											{apt.title}
										</div>
										<div className='text-xs text-slate-500 truncate mb-2'>
											{apt.address}
										</div>
										<StatusBadge status={apt.status} />
									</div>
									<div className='flex items-center gap-1 shrink-0'>
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
								</div>
								<div className='grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-3'>
									<div>
										<div className='text-xs text-slate-500 mb-0.5'>Cena</div>
										<div className='font-medium text-slate-800'>
											{formatPrice(apt.price)}
										</div>
										{apt.rentCharges && (
											<div className='text-xs text-slate-500 mt-0.5'>
												+ {formatPrice(apt.rentCharges)} czynsz
											</div>
										)}
									</div>
									<div>
										<div className='text-xs text-slate-500 mb-0.5'>Powierzchnia</div>
										<div className='font-medium text-slate-800'>
											{apt.area ?? "–"} m²
										</div>
										{apt.numberOfRooms && (
											<div className='text-xs text-slate-500 mt-0.5'>
												{apt.numberOfRooms} pokoi
											</div>
										)}
									</div>
								</div>
								{(apt.floor || apt.heating || apt.finishingStatus || apt.hasElevator) && (
									<div className='mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1'>
										{apt.floor && (
											<div>
												<span className='text-slate-500'>Piętro: </span>
												<span className='font-medium'>
													{apt.floor === 'ground-floor' ? 'Parter' :
													 apt.floor === '1st-floor' ? '1. piętro' :
													 apt.floor === '2nd-floor' ? '2. piętro' :
													 apt.floor === '3rd-floor' ? '3. piętro' :
													 apt.floor === '4th-floor' ? '4. piętro' :
													 apt.floor === '5th-floor' ? '5. piętro' :
													 apt.floor === '6th-floor' ? '6. piętro' :
													 apt.floor === '7th-floor' ? '7. piętro' :
													 apt.floor === '8th-floor' ? '8. piętro' :
													 apt.floor === '9th-floor' ? '9. piętro' :
													 apt.floor === '10th-floor' ? '10. piętro' :
													 apt.floor === '11th-floor-and-above' ? '11+ piętro' :
													 apt.floor === 'cellar' ? 'Piwnica' :
													 apt.floor === 'garret' ? 'Poddasze' : apt.floor}
												</span>
											</div>
										)}
										{apt.heating && (
											<div>
												<span className='text-slate-500'>Ogrzewanie: </span>
												<span className='font-medium'>
													{apt.heating === 'boiler-room' ? 'Kotłownia' :
													 apt.heating === 'gas' ? 'Gazowe' :
													 apt.heating === 'electrical' ? 'Elektryczne' :
													 apt.heating === 'urban' ? 'Miejskie' :
													 apt.heating === 'tiled-stove' ? 'Piec kaflowy' :
													 apt.heating === 'other' ? 'Inne' : apt.heating}
												</span>
											</div>
										)}
										{apt.finishingStatus && (
											<div>
												<span className='text-slate-500'>Stan: </span>
												<span className='font-medium'>
													{apt.finishingStatus === 'to-complete' ? 'Do wykończenia' :
													 apt.finishingStatus === 'ready-to-use' ? 'Gotowe' :
													 apt.finishingStatus === 'in-renovation' ? 'W remoncie' : apt.finishingStatus}
												</span>
											</div>
										)}
										{apt.hasElevator && (
											<div className='text-emerald-600 font-medium'>✓ Winda</div>
										)}
									</div>
								)}
							</div>
						))}
					</div>

					{/* Desktop table view */}
					<div className='hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm'>
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
										<th className='text-left py-4 px-6 text-sm font-semibold text-slate-700'>
											Szczegóły
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
												{apt.rentCharges && (
													<div className='text-xs text-slate-500 mt-0.5'>
														+ {formatPrice(apt.rentCharges)} czynsz
													</div>
												)}
											</td>
											<td className='py-4 px-6 text-right text-slate-600'>
												{apt.area ?? "–"} m²
												{apt.numberOfRooms && (
													<div className='text-xs text-slate-500 mt-0.5'>
														{apt.numberOfRooms} pokoi
													</div>
												)}
											</td>
											<td className='py-4 px-6 text-sm text-slate-600'>
												<div className='space-y-1'>
													{apt.floor && (
														<div>
															<span className='text-slate-500'>Piętro: </span>
															<span className='font-medium'>
																{apt.floor === 'ground-floor' ? 'Parter' :
																 apt.floor === '1st-floor' ? '1. piętro' :
																 apt.floor === '2nd-floor' ? '2. piętro' :
																 apt.floor === '3rd-floor' ? '3. piętro' :
																 apt.floor === '4th-floor' ? '4. piętro' :
																 apt.floor === '5th-floor' ? '5. piętro' :
																 apt.floor === '6th-floor' ? '6. piętro' :
																 apt.floor === '7th-floor' ? '7. piętro' :
																 apt.floor === '8th-floor' ? '8. piętro' :
																 apt.floor === '9th-floor' ? '9. piętro' :
																 apt.floor === '10th-floor' ? '10. piętro' :
																 apt.floor === '11th-floor-and-above' ? '11+ piętro' :
																 apt.floor === 'cellar' ? 'Piwnica' :
																 apt.floor === 'garret' ? 'Poddasze' : apt.floor}
															</span>
														</div>
													)}
													{apt.heating && (
														<div>
															<span className='text-slate-500'>Ogrzewanie: </span>
															<span className='font-medium'>
																{apt.heating === 'boiler-room' ? 'Kotłownia' :
																 apt.heating === 'gas' ? 'Gazowe' :
																 apt.heating === 'electrical' ? 'Elektryczne' :
																 apt.heating === 'urban' ? 'Miejskie' :
																 apt.heating === 'tiled-stove' ? 'Piec kaflowy' :
																 apt.heating === 'other' ? 'Inne' : apt.heating}
															</span>
														</div>
													)}
													{apt.finishingStatus && (
														<div>
															<span className='text-slate-500'>Stan: </span>
															<span className='font-medium'>
																{apt.finishingStatus === 'to-complete' ? 'Do wykończenia' :
																 apt.finishingStatus === 'ready-to-use' ? 'Gotowe' :
																 apt.finishingStatus === 'in-renovation' ? 'W remoncie' : apt.finishingStatus}
															</span>
														</div>
													)}
													{apt.hasElevator && (
														<div className='text-emerald-600 font-medium'>✓ Winda</div>
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
				</>
			)}

			{modalOpen && (
				<ApartmentForm
					apartment={editingApartment}
					onSave={handleSave}
					onClose={() => {
						setModalOpen(false);
						setEditingApartment(null);
					}}
					onApartmentUpdated={(updatedApartment) => {
						// Gdy mieszkanie zostało zaktualizowane z zewnątrz (np. z RentStatusModal),
						// zaktualizuj editingApartment żeby formularz pokazywał najnowsze dane
						if (editingApartment && updatedApartment._id === editingApartment._id) {
							setEditingApartment(updatedApartment);
						}
					}}
				/>
			)}
		</div>
	);
}
