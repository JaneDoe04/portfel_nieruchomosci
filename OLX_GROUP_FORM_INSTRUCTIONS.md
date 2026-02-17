# Wypełnienie formularza "New Application" w OLX Group (Otodom)

## Wartości do wpisania w formularzu

| Pole | Wartość | Uwagi |
|------|---------|--------|
| **Name** | `Portfel Nieruchomości` | Zostaw jak jest (nazwa widoczna na stronie autoryzacji). |
| **Urn** | `urn:partner:portfel-nieruchomosci` | Zostaw auto-uzupełnione (powinno być dostępne). |
| **Logo** | (opcjonalnie) | "Wybierz plik" – logo CRM, np. PNG/JPEG. |
| **Url** | Strona WWW Twojego CRM | Np. `https://twoja-domena.onrender.com` lub w dev `http://localhost:5173`. |
| **Authentication callback url** | Adres backendu + ścieżka callback | **Backend**, nie frontend. Przykłady: |
| | **Dev:** `http://localhost:5000/api/api-config/otodom/callback` | |
| | **Produkcja:** `https://twoja-domena-backendu.onrender.com/api/api-config/otodom/callback` | Na ten adres OLX wysyła parametr `code` (wymieniany potem na `access_token`). |
| **Scopes** | `read adverts`, `write adverts` | Zostaw zaznaczone. |
| **Receive webhook notifications** | **Enable** | Włącz. |
| **Notification secret** | Wygenerowany przez Ciebie secret | Np. długi losowy string (32+ znaki). Zapisz go – wpisz też w `.env` jako `OTODOM_WEBHOOK_SECRET`. Używany do podpisu webhooków. |
| **Notification callback url** | Adres backendu + ścieżka webhooka | **Backend.** Przykłady: |
| | **Dev:** `http://localhost:5000/api/webhooks/otodom` | W dev OLX nie zobaczy localhost – do testów użyj np. ngrok. |
| | **Produkcja:** `https://twoja-domena-backendu.onrender.com/api/webhooks/otodom` | Na ten adres OLX wysyła powiadomienia webhook. W `.env` ustaw `OTODOM_WEBHOOK_SECRET` = ta sama wartość co w polu "Notification secret". |
| **Notification flows** | Zostaw zaznaczone | "Advert Lifecycle" i "Publish Advert". |

Po wypełnieniu kliknij **"Test Callback"** przy Notification callback url (gdy backend jest wdrożony i dostępny), potem **Save**.

---

## Konto testowe Otodom (od OLX Group)

- **E-mail:** `api-integration+ppms@olx.com`
- **Hasło:** `D1{=HEM$,k`
- **Typ konta:** Agencja

Reguły ogłoszeń testowych: https://developer.olxgroup.com/docs/test-account

### Zasady ogłoszeń testowych na Otodom

1. **Tytuł** – musi zaczynać się od: `[qatest-mercury]`  
   Np. `[qatest-mercury] Mieszkanie 2-pokojowe, Śródmieście`.

2. **Opis** – użyj dokładnie tego opisu:
   ```
   Czasami musimy dodać takie ogłoszenie, żeby zweryfikować działanie niektórych funkcji systemu. Liczymy na Twoją wyrozumiałość  Radzimy skorzystać ponownie z naszej wyszukiwarki ofert.<br/><br/> Powodzenia w dalszych poszukiwaniach!
   ```

3. **Limit** – maksymalnie **5 aktywnych** ogłoszeń testowych na koncie.

4. **Po teście** – dezaktywuj ogłoszenia testowe. Kolejnego dnia możesz je ponownie aktywować lub dodać nowe.

---

## Wymagania lokalizacji (Otodom API)

Dla każdego ogłoszenia wymagane jest:

- **Współrzędne:** `lat`, `lon` (np. z geokodowania).
- **Dodatkowo** w `location.custom_fields`:
  - `city_id` – ID miejscowości (z dokumentacji/słownika OLX),
  - `street_name` – nazwa ulicy (zawsze razem z `city_id`).

Przykład w payloadzie:

```json
"location": {
  "exact": true,
  "lat": 52.370974,
  "lon": 16.7473175,
  "custom_fields": {
    "city_id": 1,
    "street_name": "Przyjemna"
  }
}
```

Dokumentacja: https://developer.olxgroup.com/docs/otodom-locations  
Słowniki (dumpy): województwa/powiaty/miejscowości/dzielnice – do trzymania bazy po swojej stronie.

---

## Sesja walidacyjna

Po wdrożeniu podstaw: autoryzacja, zarządzanie ogłoszeniami, webhook – OLX Group umówi wideo-spotkanie (sesja walidacyjna), żeby sprawdzić integrację.

Scenariusze testowe: https://developer.olxgroup.com/docs/testing-your-integration

Kontakt: developer-support@olx.com

---

## Co jest zrobione w aplikacji

- **Authentication callback url** – obsługiwany przez `GET /api/api-config/otodom/callback` (publiczny, bez logowania).
- **Notification callback url** – obsługiwany przez `POST /api/webhooks/otodom`. W `.env` ustaw `OTODOM_WEBHOOK_SECRET` (ta sama wartość co "Notification secret" w formularzu).
- **Lokalizacja** – przy publikacji na Otodom wysyłane jest `location` z `exact`, `lat`, `lon` oraz `custom_fields.city_id` i `custom_fields.street_name`. W modelu mieszkania są pola `cityId` i `streetName` (opcjonalne; bez nich używane są domyślne: Warszawa, ul. Świętokrzyska).
- Ogłoszenia **testowe** – tytuł i opis musisz ustawić ręcznie (prefix `[qatest-mercury]` w tytule i podany wyżej opis), albo dopilnuj tego przed publikacją z aplikacji.
