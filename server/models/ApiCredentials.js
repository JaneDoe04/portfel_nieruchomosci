import mongoose from 'mongoose';

/**
 * Model do przechowywania credentials API dla OLX i Otodom.
 * 
 * WAŻNE: Istnieją dwa typy credentials:
 * 1. App-level credentials (client_id, client_secret) - jeden zestaw dla całej aplikacji
 * 2. User-level tokens (access_token, refresh_token) - każdy użytkownik ma swoje tokeny
 * 
 * Ten model przechowuje app-level credentials (globalne) oraz user-level tokens.
 */
const apiCredentialsSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['olx', 'otodom'],
      required: true,
    },
    // App-level credentials (jeden zestaw dla całej aplikacji)
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    clientSecret: {
      type: String,
      required: true,
      trim: true,
    },
    // User-level tokens (każdy użytkownik ma swoje)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = app-level credentials, ObjectId = user-specific tokens
    },
    // OAuth 2.0 credentials
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    clientSecret: {
      type: String,
      required: true,
      trim: true,
    },
    // OAuth tokens (aktualizowane po autoryzacji użytkownika)
    accessToken: {
      type: String,
      default: null,
      trim: true,
    },
    refreshToken: {
      type: String,
      default: null,
      trim: true,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    // Status konfiguracji
    isConfigured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    // Dodatkowe informacje
    olxAccountEmail: {
      type: String,
      default: null,
      trim: true,
      comment: 'Email konta OLX/Otodom powiązanego z tymi tokenami',
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index: app-level credentials (platform + userId = null)
// Index: user-level tokens (platform + userId)
apiCredentialsSchema.index({ platform: 1, userId: 1 }, { unique: true });

export default mongoose.model('ApiCredentials', apiCredentialsSchema);
