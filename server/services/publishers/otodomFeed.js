/**
 * Otodom XML feed generator.
 * Produces XML for apartments with status 'WOLNE' (available for rent),
 * compatible with Otodom bulk feed requirements (UTF-8, listing structure).
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
 * Build a single listing node for Otodom-style XML (generic listing structure).
 * Otodom expects category, attributes (price, area, etc.) and images.
 */
function buildListingXml(apt, baseUrl) {
  const id = apt._id.toString();
  const title = escapeXml(apt.title);
  const description = escapeXml(apt.description);
  const address = escapeXml(apt.address);
  const price = apt.price;
  const area = apt.area;
  const images = Array.isArray(apt.photos) ? apt.photos : [];
  const externalId = apt.externalIds?.otodom || id;

  let imagesXml = '';
  images.forEach((url) => {
    const src = url.startsWith('http') ? url : (baseUrl ? `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}` : url);
    imagesXml += `    <image url="${escapeXml(src)}" />\n`;
  });
  if (imagesXml === '' && baseUrl) {
    imagesXml = `    <image url="${escapeXml(baseUrl)}/placeholder.jpg" />\n`;
  }

  return `  <listing id="${escapeXml(externalId)}">
    <title>${title}</title>
    <description><![CDATA[${description || title}]]></description>
    <address>${address}</address>
    <price>${price}</price>
    <area unit="m2">${area}</area>
    <category>urn:concept:apartments-for-rent</category>
    <market>urn:concept:secondary</market>
    <attributes>
      <attribute name="urn:concept:net-area-m2">${area}</attribute>
    </attributes>
    <images>
${imagesXml}    </images>
  </listing>`;
}

/**
 * Fetch all apartments with status WOLNE and return XML string (UTF-8).
 * @param {string} [baseUrl] - Base URL for image links
 * @returns {Promise<string>}
 */
export async function generateOtodomFeed(baseUrl = '') {
  const apartments = await Apartment.find({ status: 'WOLNE' }).lean();
  const listings = apartments.map((apt) => buildListingXml(apt, baseUrl)).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.otodom.pl/feed">
  <listings>
${listings}
  </listings>
</feed>`;
}
