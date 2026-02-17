# Architektura autoryzacji API OLX/Otodom

## Problem: Jak działa autoryzacja dla wielu użytkowników?

### ❌ Nieprawidłowe podejście (obecne)
- Jeden zestaw credentials API dla całej aplikacji
- Jeden access_token dla wszystkich użytkowników
- **Problem:** Nie można użyć jednego konta OLX do zarządzania ogłoszeniami innych użytkowników

### ✅ Prawidłowe podejście

#### 1. App-Level Credentials (jeden zestaw)
- `client_id` i `client_secret` - **jeden zestaw dla całej aplikacji**
- Rejestrujesz aplikację w OLX Developer Portal jako właściciel aplikacji
- Te credentials identyfikują Twoją aplikację

#### 2. User-Level Tokens (każdy użytkownik osobno)
- Każdy użytkownik aplikacji musi **autoryzować aplikację na swoim koncie OLX/Otodom**
- Po autoryzacji otrzymuje swój własny `access_token` i `refresh_token`
- Tokeny są powiązane z kontem OLX/Otodom użytkownika
- **Każdy użytkownik zarządza tylko swoimi ogłoszeniami**

## Jak to działa w praktyce?

### Scenariusz 1: Ty jako właściciel aplikacji
1. Rejestrujesz aplikację w OLX Developer Portal → dostajesz `client_id` i `client_secret`
2. Wprowadzasz te credentials w ustawieniach aplikacji (app-level)
3. Autoryzujesz aplikację na swoim koncie OLX → dostajesz swoje tokeny (user-level)
4. Możesz publikować ogłoszenia jako Ty

### Scenariusz 2: Klient używa aplikacji
1. Klient loguje się do Twojej aplikacji
2. Klient przechodzi do "Ustawienia API" i klika "Autoryzuj OLX"
3. Klient zostaje przekierowany do OLX i loguje się **swoim kontem OLX**
4. Klient autoryzuje aplikację → aplikacja otrzymuje tokeny powiązane z kontem klienta
5. Klient może publikować ogłoszenia jako **on sam**, nie jako Ty

## Struktura danych

### App-Level Credentials (platform + userId = null)
```javascript
{
  platform: 'olx',
  clientId: 'xxx',
  clientSecret: 'yyy',
  userId: null, // null = app-level
  isConfigured: true
}
```

### User-Level Tokens (platform + userId)
```javascript
{
  platform: 'olx',
  clientId: 'xxx', // ten sam co app-level
  clientSecret: 'yyy', // ten sam co app-level
  userId: ObjectId('user123'), // konkretny użytkownik
  accessToken: 'zzz',
  refreshToken: 'aaa',
  tokenExpiresAt: Date,
  olxAccountEmail: 'klient@example.com',
  isActive: true
}
```

## Implementacja

### 1. Konfiguracja app-level credentials
- Admin aplikacji wprowadza `client_id` i `client_secret` raz
- Zapisujemy z `userId: null`

### 2. Autoryzacja użytkownika
- Użytkownik klika "Autoryzuj"
- Otwiera się OAuth flow z `client_id` aplikacji
- Użytkownik loguje się swoim kontem OLX
- Po autoryzacji zapisujemy tokeny z `userId: req.user._id`

### 3. Publikacja ogłoszenia
- Pobieramy tokeny dla konkretnego użytkownika (`userId: req.user._id`)
- Używamy tych tokenów do publikacji
- Ogłoszenie jest publikowane jako użytkownik, który autoryzował

## Ważne uwagi

1. **Każdy użytkownik musi mieć konto OLX/Otodom** - nie może użyć Twojego konta
2. **Tokeny są powiązane z kontem OLX** - nie można zarządzać ogłoszeniami innych
3. **App-level credentials są wspólne** - identyfikują aplikację
4. **User-level tokens są osobne** - każdy użytkownik ma swoje

## Bezpieczeństwo

- `client_secret` jest przechowywany tylko na serwerze (nigdy w frontendzie)
- `access_token` i `refresh_token` są powiązane z użytkownikiem i przechowywane bezpiecznie
- Każdy użytkownik widzi tylko swoje tokeny i może je odwołać
