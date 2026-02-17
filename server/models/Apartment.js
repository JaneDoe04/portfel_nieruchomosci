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
