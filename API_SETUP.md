# Konfiguracja API OLX i Otodom

## Jak uzyskać dostęp do API?

### 1. Rejestracja w OLX Developer Portal

1. **Zarejestruj się na:** https://developer.olx.pl/
   - Musisz mieć konto OLX (możesz je założyć na https://www.olx.pl/)
   - Kliknij "Zaloguj" i użyj swoich danych OLX

2. **Zarejestruj aplikację:**
   - Po zalogowaniu przejdź do sekcji "Moje aplikacje"
   - Kliknij "Dodaj nową aplikację"
   - Wypełnij formularz:
     - **Nazwa aplikacji:** np. "Portfel Nieruchomości"
     - **Opis:** Opisz swoją aplikację
     - **Redirect URI:** `http://localhost:5000/api/api-config/olx/callback` (dla dev) lub URL twojego serwera w produkcji
     - **Scopes:** Wybierz `read` i `write`

3. **Pobierz credentials:**
   - Po rejestracji otrzymasz:
     - `client_id` (Client ID)
     - `client_secret` (Client Secret)
   - **WAŻNE:** Zapisz te dane bezpiecznie - `client_secret` jest pokazywany tylko raz!

### 2. Rejestracja w Otodom (przez OLX Group)

Otodom używa **OLX Group Developer Hub** (ten sam system co OLX):

1. **Przejdź na:** https://developer.olxgroup.com/
2. **Zarejestruj się** (jeśli nie masz konta) lub **zaloguj się**
3. **Kliknij "Request an APP"** lub "Get Started"
4. **Wybierz produkt:** "Real Estate API" (to jest API dla Otodom)
5. **Wybierz market:** "Otodom PL" (Poland)
6. **Wypełnij formularz:**
   - **Nazwa aplikacji:** np. "Portfel Nieruchomości"
   - **Opis:** Opisz swoją aplikację
   - **Redirect URI:** `http://localhost:5000/api/api-config/otodom/callback` (dla dev) lub URL twojego serwera w produkcji
   - **Scopes:** Wybierz `read` i `write`
7. **Poczekaj na akceptację** - aplikacja wymaga zatwierdzenia przez OLX Group
8. **Pobierz credentials:**
   - Po akceptacji otrzymasz:
     - `client_id` (Client ID)
     - `client_secret` (Client Secret)
   - **WAŻNE:** Zapisz te dane bezpiecznie - `client_secret` jest pokazywany tylko raz!

**Uwaga:** Otodom może wymagać osobnej rejestracji niż OLX, nawet jeśli używa tego samego portalu. Sprawdź czy masz dostęp do "Real Estate API" w swoim koncie.

## Konfiguracja w aplikacji

### Krok 1: Dodaj credentials do aplikacji

1. Zaloguj się do aplikacji
2. Przejdź do ustawień API (będzie dostępne w menu)
3. Wprowadź:
   - **Platform:** OLX lub Otodom
   - **Client ID:** Twój client_id z portalu deweloperskiego
   - **Client Secret:** Twój client_secret z portalu deweloperskiego
4. Kliknij "Zapisz"

### Krok 2: Autoryzacja OAuth 2.0

1. Po zapisaniu credentials, kliknij "Autoryzuj"
2. Zostaniesz przekierowany do strony OLX/Otodom
3. Zaloguj się i zaakceptuj uprawnienia
4. Zostaniesz przekierowany z powrotem do aplikacji
5. Status zmieni się na "Aktywne" ✅

### Krok 3: Publikacja ogłoszeń

Po autoryzacji możesz publikować ogłoszenia:

1. Przejdź do listy mieszkań
2. Dla mieszkania ze statusem "WOLNE" kliknij przycisk publikacji
3. Wybierz platformę (OLX/Otodom)
4. Ogłoszenie zostanie opublikowane automatycznie
5. Link do ogłoszenia zostanie zapisany w mieszkaniu

## Endpointy API

### Konfiguracja

- `GET /api/api-config` - Pobierz konfigurację API
- `POST /api/api-config` - Zapisz credentials
- `POST /api/api-config/:platform/authorize` - Rozpocznij autoryzację OAuth

### Publikacja

**OLX:**
- `POST /api/publish/:apartmentId/olx` - Opublikuj mieszkanie na OLX
- `PUT /api/publish/:apartmentId/olx` - Zaktualizuj ogłoszenie na OLX
- `DELETE /api/publish/:apartmentId/olx` - Usuń ogłoszenie z OLX

**Otodom:**
- `POST /api/publish/:apartmentId/otodom` - Opublikuj mieszkanie na Otodom
- `PUT /api/publish/:apartmentId/otodom` - Zaktualizuj ogłoszenie na Otodom
- `DELETE /api/publish/:apartmentId/otodom` - Usuń ogłoszenie z Otodom

## Ważne informacje

### Limity API

- **OLX:** 4500 requestów na 5 minut na IP
- **Otodom:** Podobne limity (sprawdź dokumentację)

### Wymagania

- Mieszkanie musi mieć status **WOLNE**
- Wymagane pola: `title`, `price`, `area`, `address`
- Przynajmniej jedno zdjęcie (wymagane przez OLX/Otodom)

### Geokodowanie

Obecnie aplikacja używa domyślnych współrzędnych (Warszawa). W przyszłości można dodać:
- Integrację z Google Maps Geocoding API
- Integrację z OpenStreetMap Nominatim API

## Rozwiązywanie problemów

### "OLX API nie jest skonfigurowane"
- Sprawdź czy zapisałeś credentials w ustawieniach API

### "Nie udało się odświeżyć tokenu"
- Token wygasł - kliknij "Autoryzuj" ponownie

### "Błąd publikacji"
- Sprawdź czy wszystkie wymagane pola są wypełnione
- Sprawdź czy masz przynajmniej jedno zdjęcie
- Sprawdź limity API

## Dokumentacja

- **OLX API:** https://developer.olx.pl/api/doc/
- **OLX Group Developer Hub:** https://developer.olxgroup.com/
- **Otodom Help:** https://pomoc.otodom.pl/
