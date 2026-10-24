const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IP address belongs to a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (!ip) return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.0.0 – 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private network)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // Broadcast
    if (ip === '255.255.255.255') return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // Link-local (fe80::/10)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
        normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // Unique local address (fc00::/7 - fc or fd)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    return false;
  }

  return true;
}

/**
 * Validates a URL against SSRF and unsafe protocols.
 * Resolves DNS to check resolved IP address.
 * @param {string} rawUrl
 * @returns {Promise<{ valid: boolean, error?: string, parsedUrl?: URL }>}
 */
async function validateUrlForSsrf(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required and must be a string.' };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    return { valid: false, error: 'Malformed or invalid URL format.' };
  }

  // Restrict to http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and local names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return { valid: false, error: 'Access to localhost and internal hostnames is prohibited.' };
  }

  // If hostname is directly an IP
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, error: 'Access to private or local IP addresses is prohibited.' };
    }
  } else {
    // Resolve DNS
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const record of records) {
        if (isPrivateIp(record.address)) {
          return {
            valid: false,
            error: `Hostname ${hostname} resolves to private IP (${record.address}). Access denied.`
          };
        }
      }
    } catch (e) {
      return { valid: false, error: `Unable to resolve host ${hostname}: ${e.message}` };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Verifies image magic bytes to ensure the buffer matches an accepted image format.
 * Supported: JPEG, PNG, WEBP.
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, mimeType?: string, error?: string }}
 */
function validateImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: 'File buffer is too small to be a valid image.' };
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, mimeType: 'image/png' };
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // WebP signature: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: 'image/webp' };
  }

  return {
    valid: false,
    error: 'File signature does not match supported image formats (PNG, JPEG, WEBP).'
  };
}

/**
 * Sanitize untrusted text inputs.
 * Strips null bytes and normalizes whitespace.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeText(text, maxLen = 5000) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\0/g, '').trim().slice(0, maxLen);
}

module.exports = {
  isPrivateIp,
  validateUrlForSsrf,
  validateImageMagicBytes,
  sanitizeText
};
