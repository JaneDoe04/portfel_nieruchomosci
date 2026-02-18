import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Wysyła email przez Resend
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.warn('[email] RESEND_API_KEY lub RESEND_FROM_EMAIL nie ustawione - pomijam wysyłkę');
    return { success: false, error: 'Email nie skonfigurowany' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    if (error) {
      console.error('[email] Błąd wysyłki:', error);
      return { success: false, error };
    }

    console.log('[email] Email wysłany:', data?.id);
    return { success: true, data };
  } catch (err) {
    console.error('[email] Wyjątek:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Szablon emaila o zbliżającym się końcu umowy
 */
export function createExpiringLeaseEmail(apartments) {
  const subject = `Powiadomienie: ${apartments.length} ${apartments.length === 1 ? 'mieszkanie' : 'mieszkań'} z kończącą się umową`;

  const apartmentsList = apartments
    .map(
      (apt) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${apt.title || apt.address}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${apt.address}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${apt.contractEndDate?.toLocaleDateString('pl-PL') || 'Brak daty'}</td>
    </tr>
  `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e0e0e0; border-top: none; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #e0e7ff; padding: 10px; text-align: left; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Portfel Nieruchomości</h1>
    </div>
    <div class="content">
      <h2>Powiadomienie o kończących się umowach</h2>
      <p>Wykryto <strong>${apartments.length}</strong> ${apartments.length === 1 ? 'mieszkanie' : 'mieszkań'} z umową kończącą się w ciągu najbliższych 30 dni:</p>
      
      <table>
        <thead>
          <tr>
            <th style="padding: 10px; border-bottom: 2px solid #4f46e5;">Mieszkanie</th>
            <th style="padding: 10px; border-bottom: 2px solid #4f46e5;">Adres</th>
            <th style="padding: 10px; border-bottom: 2px solid #4f46e5;">Koniec umowy</th>
          </tr>
        </thead>
        <tbody>
          ${apartmentsList}
        </tbody>
      </table>
      
      <p style="margin-top: 20px;">Zaloguj się do systemu, aby sprawdzić szczegóły i podjąć odpowiednie działania.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Portfel Nieruchomości - Powiadomienie o kończących się umowach

Wykryto ${apartments.length} ${apartments.length === 1 ? 'mieszkanie' : 'mieszkań'} z umową kończącą się w ciągu najbliższych 30 dni:

${apartments.map((apt) => `- ${apt.title || apt.address}, ${apt.address} - koniec umowy: ${apt.contractEndDate?.toLocaleDateString('pl-PL') || 'Brak daty'}`).join('\n')}

Zaloguj się do systemu, aby sprawdzić szczegóły.
  `;

  return { subject, html, text };
}
