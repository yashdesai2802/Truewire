const cheerio = require('cheerio');
const { validateUrlForSsrf } = require('../utils/validation');

/**
 * Service to securely fetch and parse article web pages.
 */
class ArticleService {
  /**
   * Fetches the web page following redirects and checking SSRF at each step.
   * @param {string} initialUrl
   * @param {number} maxRedirects
   * @returns {Promise<{ html: string, finalUrl: string }>}
   */
  async fetchPageSafely(initialUrl, maxRedirects = 3) {
    let currentUrl = initialUrl;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
      // 1. SSRF check on currentUrl
      const ssrfCheck = await validateUrlForSsrf(currentUrl);
      if (!ssrfCheck.valid) {
        throw new Error(`SSRF Security Guard blocked request: ${ssrfCheck.error}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual', // handle redirects manually for SSRF inspection
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TrueWire/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Received redirect HTTP ${response.status} without Location header.`);
          }
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`Remote server responded with HTTP status ${response.status} (${response.statusText}).`);
        }

        // Verify content-type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          throw new Error(`Unsupported content type: ${contentType}. Only HTML web articles can be processed.`);
        }

        // Limit size to 2MB to prevent memory exhaustion
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
          throw new Error('Page content exceeds 2MB size limit.');
        }

        const html = new TextDecoder('utf-8').decode(arrayBuffer);
        return { html, finalUrl: currentUrl };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timed out while fetching article (8-second limit exceeded).');
        }
        throw err;
      }
    }

    throw new Error('Too many redirects while trying to reach article.');
  }

  /**
   * Extracts clean metadata and article body text from HTML.
   * @param {string} html
   * @param {string} url
   * @returns {{ title: string, publisher: string, author: string, publishedAt: string, bodyText: string, description: string }}
   */
  extractArticleData(html, url) {
    const $ = cheerio.load(html);

    // Remove noise elements
    $('script, style, noscript, iframe, svg, nav, header, footer, aside, form, .ad, .ads, .advertisement, [aria-hidden="true"]').remove();

    // Extract Title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      'Untitled Article';

    // Extract Publisher
    const publisher =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="publisher"]').attr('content') ||
      new URL(url).hostname.replace(/^www\./, '');

    // Extract Published Date
    const publishedAt =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish-date"]').attr('content') ||
      $('time').attr('datetime') ||
      null;

    // Extract Author
    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      null;

    // Extract Description / Summary
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // Extract body text from probable article containers
    let bodyText = '';
    const containerSelectors = [
      'article',
      '[itemprop="articleBody"]',
      '.article-body',
      '.story-content',
      '.post-content',
      '.entry-content',
      'main'
    ];

    for (const sel of containerSelectors) {
      if ($(sel).length > 0) {
        bodyText = $(sel).find('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
        if (bodyText.length > 200) break;
      }
    }

    if (!bodyText || bodyText.length < 150) {
      bodyText = $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 25).join('\n\n');
    }

    // Limit text length to prevent prompt token bloat while keeping substantive context
    const cleanBody = bodyText.slice(0, 6000).trim();

    return {
      title: title.slice(0, 300),
      publisher,
      author,
      publishedAt,
      description: description.slice(0, 500),
      bodyText: cleanBody
    };
  }

  /**
   * Main function: validates, fetches, and extracts article.
   * @param {string} url
   */
  async processArticleUrl(url) {
    const { html, finalUrl } = await this.fetchPageSafely(url);
    const data = this.extractArticleData(html, finalUrl);
    return {
      url: finalUrl,
      ...data
    };
  }
}

module.exports = new ArticleService();
