# Portfel Nieruchomości – PMS

Profesjonalna aplikacja Full-stack do zarządzania wynajmem mieszkań (Property Management System).

## Stack

- **Frontend:** React (Vite), React Router, Axios, Tailwind CSS, lucide-react
- **Backend:** Node.js (Express), MongoDB (Mongoose), JWT
- **Stylistyka:** Granatowy/niebieski design (Otodom/Airbnb-like)

## Struktura projektu

```
/client          – aplikacja React (Vite)
/server           – aplikacja Node.js (Express + Mongoose)
  /models         – User, Apartment
  /routes         – auth, apartments, feeds
  /middleware     – auth (JWT)
  /services/publishers – logika feedów (Otodom XML), placeholder pod OLX/Otodom API
  /scripts        – checkExpiringLeases.js (placeholder wygasających umów)
```

## Uruchomienie

### Wymagania

- Node.js 18+
- MongoDB (lokalnie lub URI w `.env`)

### Backend

```bash
cd server
cp .env.example .env
# Edytuj .env: MONGODB_URI, JWT_SECRET
npm install
npm run dev
```

Serwer: `http://localhost:5000`

### Frontend

```bash
cd client
npm install
npm run dev
```

Aplikacja: `http://localhost:5173` (proxy do API pod `/api`).

### Pierwszy użytkownik

Zarejestruj się przez API (np. Postman) lub dodaj użytkownika do bazy:

```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{"email": "admin@example.com", "password": "haslo123", "name": "Admin"}
```

Następnie zaloguj się w aplikacji tym emailem i hasłem.

## Funkcjonalności

- **Autoryzacja:** logowanie JWT, chronione trasy (protected routes)
- **Mieszkania:** CRUD, statusy (WOLNE / WYNAJĘTE / REMANENT), data końca umowy, zdjęcia (URL), zewnętrzne ID (OLX, Otodom)
- **Dashboard:** sidebar, lista mieszkań z odznakami statusu, formularz dodawania/edycji (modal)
- **Feed Otodom:** `GET /api/feeds/otodom` – XML z mieszkaniami o statusie WOLNE
- **Skrypt umów:** `npm run check-leases` w `server` – placeholder sprawdzania wygasających umów

## Endpointy API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | /api/auth/register | Rejestracja |
| POST | /api/auth/login | Logowanie |
| GET | /api/auth/me | Aktualny użytkownik (Bearer) |
| GET | /api/apartments | Lista mieszkań (Bearer) |
| GET | /api/apartments/:id | Jedno mieszkanie (Bearer) |
| POST | /api/apartments | Dodaj mieszkanie (Bearer) |
| PUT | /api/apartments/:id | Edytuj (Bearer) |
| DELETE | /api/apartments/:id | Usuń (Bearer) |
| GET | /api/feeds/otodom | Feed XML Otodom (publiczny) |

## Licencja

MIT
