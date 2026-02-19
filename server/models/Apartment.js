import mongoose from 'mongoose';

const STATUS_ENUM = ['WOLNE', 'WYNAJĘTE', 'REMANENT'];

const externalIdsSchema = new mongoose.Schema(
  {
    olx: { type: String, default: null },
    otodom: { type: String, default: null },
  },
  { _id: false }
);

const apartmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      comment: 'Pełny adres (generowany automatycznie z street, streetNumber, postalCode, city)',
    },
    street: {
      type: String,
      default: '',
      trim: true,
      comment: 'Nazwa ulicy (bez prefiksów typu "ul.", "al.")',
    },
    streetNumber: {
      type: String,
      default: '',
      trim: true,
      comment: 'Numer budynku/mieszkania',
    },
    postalCode: {
      type: String,
      default: '',
      trim: true,
      comment: 'Kod pocztowy (format: XX-XXX)',
    },
    city: {
      type: String,
      default: '',
      trim: true,
      comment: 'Miasto',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    area: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Metraż w m²',
    },
    numberOfRooms: {
      type: Number,
      default: null,
      min: 1,
      max: 10,
      comment: 'Liczba pokoi (wymagana dla Otodom API)',
    },
    heating: {
      type: String,
      default: null,
      enum: ['boiler-room', 'gas', 'electrical', 'urban', 'other', 'tiled-stove'],
      comment: 'Typ ogrzewania (Otodom: urn:concept:heating)',
    },
    floor: {
      type: String,
      default: null,
      enum: ['cellar', 'ground-floor', '1st-floor', '2nd-floor', '3rd-floor', '4th-floor', '5th-floor', '6th-floor', '7th-floor', '8th-floor', '9th-floor', '10th-floor', '11th-floor-and-above', 'garret'],
      comment: 'Piętro mieszkania (Otodom: urn:concept:floor)',
    },
    finishingStatus: {
      type: String,
      default: null,
      enum: ['to-complete', 'ready-to-use', 'in-renovation'],
      comment: 'Stan wykończenia (Otodom: urn:concept:status)',
    },
    availableFrom: {
      type: Date,
      default: null,
      comment: 'Dostępne od (Otodom: urn:concept:free-from)',
    },
    rentCharges: {
      type: Number,
      default: null,
      min: 0,
      comment: 'Czynsz/miesiąc (opcjonalne, dodatkowe do ceny)',
    },
    deposit: {
      type: Number,
      default: null,
      min: 0,
      comment: 'Kaucja (opcjonalne)',
    },
    hasElevator: {
      type: Boolean,
      default: false,
      comment: 'Czy budynek ma windę (Otodom: urn:concept:extras -> urn:concept:lift)',
    },
    cityId: {
      type: Number,
      default: null,
      comment: 'ID miejscowości Otodom/OLX (z dokumentacji lokalizacji)',
    },
    streetName: {
      type: String,
      default: '',
      trim: true,
      comment: 'Nazwa ulicy (wymagana z city_id dla Otodom API)',
    },
    lat: {
      type: Number,
      default: null,
      comment: 'Szerokość geograficzna (Otodom/OLX)',
    },
    lon: {
      type: Number,
      default: null,
      comment: 'Długość geograficzna (Otodom/OLX)',
    },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'WOLNE',
    },
    contractEndDate: {
      type: Date,
      default: null,
    },
    photos: [
      {
        type: String,
        trim: true,
      },
    ],
    externalIds: {
      type: externalIdsSchema,
      default: () => ({}),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

apartmentSchema.index({ status: 1 });
apartmentSchema.index({ contractEndDate: 1 });

export { STATUS_ENUM };
export default mongoose.model('Apartment', apartmentSchema);
