/**
 * OLX XML feed generator.
 * Produces XML for apartments with status 'WOLNE' (available for rent),
 * compatible with OLX bulk feed requirements (UTF-8, advert structure).
 * 
 * Requirements:
 * - Title: max 70 chars, min 5 chars
 * - Description: max 9000 chars, min 20 chars
 * - Price: required, cannot be 0
 * - Images: at least 1 image required
 * - Location: latitude and longitude required
 */

import Apartment from '../../models/Apartment.js';

const escapeXml = (str) => {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Truncate string to max length
 */
const truncate = (str, maxLen) => {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) : str;
};

/**
 * Ensure minimum length by padding
 */
const ensureMinLength = (str, minLen, padStr = '...') => {
  if (!str) return padStr.repeat(minLen);
  return str.length < minLen ? str + padStr.repeat(minLen - str.length) : str;
};

/**
 * Extract coordinates from address (basic parsing - can be improved)
 * Returns default Warsaw coordinates if not found
 */
const extractCoordinates = (address) => {
  // TODO: Implement geocoding service integration
  // For now, return default coordinates (Warsaw center)
  // In production, use a geocoding API like Google Maps, OpenStreetMap Nominatim, etc.
  return {
    latitude: 52.2297,
    longitude: 21.0122,
  };
};

/**
 * Build a single advert node for OLX XML format
 */
function buildAdvertXml(apt, baseUrl) {
  const id = apt._id.toString();
  const externalId = apt.externalIds?.olx || id;
  
  // Title: max 70, min 5
  let title = truncate(apt.title || 'Mieszkanie do wynajęcia', 70);
  if (title.length < 5) {
    title = ensureMinLength(title, 5);
  }
  
  // Description: max 9000, min 20
  let description = apt.description || apt.title || 'Mieszkanie do wynajęcia';
  description = truncate(description, 9000);
  if (description.length < 20) {
    description = ensureMinLength(description, 20);
  }
  
  const price = apt.price || 0;
  const area = apt.area || 0;
  const images = Array.isArray(apt.photos) ? apt.photos : [];
  
  // Get coordinates (default to Warsaw if not available)
  const coords = extractCoordinates(apt.address);
  
  // Build images XML
  let imagesXml = '';
  if (images.length > 0) {
    images.forEach((url, index) => {
      const src = url.startsWith('http') 
        ? url 
        : (baseUrl ? `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}` : url);
      imagesXml += `        <image url="${escapeXml(src)}" />\n`;
    });
  } else {
    // OLX requires at least one image - use placeholder if none
    const placeholderUrl = baseUrl 
      ? `${baseUrl}/placeholder.jpg` 
      : 'https://via.placeholder.com/800x600';
    imagesXml = `        <image url="${escapeXml(placeholderUrl)}" />\n`;
  }
  
  return `  <advert>
    <id>${escapeXml(externalId)}</id>
    <basic>
      <title>${escapeXml(title)}</title>
      <description><![CDATA[${description}]]></description>
      <category>urn:concept:apartments-for-rent</category>
      <price>
        <value>${price}</value>
        <currency>PLN</currency>
      </price>
      <location>
        <latitude>${coords.latitude}</latitude>
        <longitude>${coords.longitude}</longitude>
      </location>
      <images>
${imagesXml}      </images>
    </basic>
    <attributes>
      <attribute>
        <name>urn:concept:net-area-m2</name>
        <value>${area}</value>
      </attribute>
      <attribute>
        <name>urn:concept:market</name>
        <value>urn:concept:secondary</value>
      </attribute>
    </attributes>
  </advert>`;
}

/**
 * Fetch all apartments with status WOLNE and return XML string (UTF-8).
 * @param {string} [baseUrl] - Base URL for image links
 * @param {string} [userEmail] - User email for tracking (optional)
 * @returns {Promise<string>}
 */
export async function generateOlxFeed(baseUrl = '', userEmail = '') {
  const apartments = await Apartment.find({ status: 'WOLNE' }).lean();
  
  // Filter out apartments without required fields
  const validApartments = apartments.filter(apt => {
    return apt.title && apt.price > 0 && apt.area > 0;
  });
  
  const adverts = validApartments.map((apt) => buildAdvertXml(apt, baseUrl)).join('\n');
  
  // OLX header with market (urn:site:olx.pl for Poland)
  const header = userEmail 
    ? `  <user>
    <email>${escapeXml(userEmail)}</email>
  </user>
  <market>urn:site:olx.pl</market>`
    : `  <market>urn:site:olx.pl</market>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<feed>
${header}
  <adverts>
${adverts}
  </adverts>
</feed>`;
}
