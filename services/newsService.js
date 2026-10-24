const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TrueWireNewsDesk/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// Sources registry with priority on Indian Hindi-language newsrooms
const SOURCES = [
  {
    id: 'aaj-tak',
    name: 'Aaj Tak',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:aajtak.in&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'abp-news',
    name: 'ABP News',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:hindi.abplive.com&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'ndtv-india',
    name: 'NDTV India',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:khabar.ndtv.com+OR+site:ndtv.in&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'zee-news',
    name: 'Zee News',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:zeenews.india.com/hindi&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'news18-hindi',
    name: 'News18 Hindi',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:hindi.news18.com&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'india-tv',
    name: 'India TV',
    language: 'hi',
    category: 'Hindi News Channel',
    url: 'https://news.google.com/rss/search?q=site:indiatv.in+OR+site:indiatvnews.com/hindi&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'dainik-jagran',
    name: 'Dainik Jagran',
    language: 'hi',
    category: 'Hindi Newspaper',
    url: 'https://rss.jagran.com/rss/news/national.xml',
    backupUrl: 'https://news.google.com/rss/search?q=site:jagran.com&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'amar-ujala',
    name: 'Amar Ujala',
    language: 'hi',
    category: 'Hindi Newspaper',
    url: 'https://www.amarujala.com/rss/breaking-news.xml',
    backupUrl: 'https://news.google.com/rss/search?q=site:amarujala.com&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'bbc-news-hindi',
    name: 'BBC News Hindi',
    language: 'hi',
    category: 'Hindi International',
    url: 'https://feeds.bbci.co.uk/hindi/rss.xml'
  },
  {
    id: 'dd-news',
    name: 'DD News',
    language: 'hi',
    category: 'Public Broadcaster',
    url: 'https://news.google.com/rss/search?q=site:ddnews.gov.in&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    id: 'top-hindi-wire',
    name: 'Live Hindi Wire',
    language: 'hi',
    category: 'Aggregated Wire',
    url: 'https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi'
  },
  // Optional English Sources
  {
    id: 'the-hindu',
    name: 'The Hindu',
    language: 'en',
    category: 'English National',
    url: 'https://www.thehindu.com/news/national/feeder/default.rss'
  },
  {
    id: 'indian-express',
    name: 'Indian Express',
    language: 'en',
    category: 'English National',
    url: 'https://indianexpress.com/feed/'
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    language: 'en',
    category: 'Technology',
    url: 'https://techcrunch.com/feed/'
  },
  {
    id: 'bbc-news',
    name: 'BBC News',
    language: 'en',
    category: 'International',
    url: 'https://feeds.bbci.co.uk/news/rss.xml'
  }
];

class NewsService {
  constructor() {
    this.cache = [];
    this.lastFetched = null;
    this.sourceStatuses = {};
    this.isFetching = false;
    this.refreshInterval = parseInt(process.env.NEWS_REFRESH_INTERVAL || '300000', 10);
    this.fallbackData = this.loadFallbackData();

    // Initialize statuses
    SOURCES.forEach(s => {
      this.sourceStatuses[s.id] = {
        name: s.name,
        status: 'initialized',
        lastSuccess: null,
        errorCount: 0
      };
    });
  }

  loadFallbackData() {
    try {
      const fallbackPath = path.join(__dirname, '..', 'data', 'fallbackStories.json');
      if (fs.existsSync(fallbackPath)) {
        const raw = fs.readFileSync(fallbackPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[NewsService] Could not load fallbackStories.json:', e.message);
    }
    return [];
  }

  formatTimeAgo(dateStr) {
    if (!dateStr) return 'now';
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    if (isNaN(date)) return 'now';

    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDays = Math.floor(diffHour / 24);
    return `${diffDays}d`;
  }

  cleanTitle(title, sourceName) {
    if (!title) return '';
    let cleaned = title.replace(/\s+/g, ' ').trim();
    // Remove trailing source dash if added by Google News or RSS
    const trailingPatterns = [
      new RegExp(`\\s*[-|–—]\\s*${sourceName}\\s*$`, 'i'),
      /\s*[-|–—]\s*Google (?:News|समाचार)\s*$/i,
      /\s*[-|–—]\s*Amar Ujala\s*$/i,
      /\s*[-|–—]\s*Jagran\s*$/i,
      /\s*[-|–—]\s*NDTV\s*$/i,
      /\s*[-|–—]\s*Aaj Tak\s*$/i,
      /\s*[-|–—]\s*Zee News\s*$/i,
      /\s*[-|–—]\s*ABP News\s*$/i
    ];
    trailingPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '').trim();
    });
    return cleaned;
  }

  normalizeStory(item, sourceDef) {
    let sourceName = sourceDef.name;
    // If the feed has a specific item source (like Google News RSS)
    if (item.source && typeof item.source === 'string') {
      sourceName = item.source.trim();
    } else if (item.source && item.source._) {
      sourceName = item.source._.trim();
    }

    const title = this.cleanTitle(item.title, sourceName);
    const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
    const timeAgo = this.formatTimeAgo(pubDate);

    // Extract image if available
    let imageUrl = null;
    if (item.enclosure && item.enclosure.url) {
      imageUrl = item.enclosure.url;
    } else if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
      imageUrl = item['media:content'].$.url;
    }

    // Clean snippet
    let summary = item.contentSnippet || item.content || '';
    summary = summary.replace(/<[^>]*>/g, '').trim().slice(0, 300);

    const id = `${sourceDef.id}-${Buffer.from(title.slice(0, 40)).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;

    return {
      id,
      source: sourceName,
      sourceId: sourceDef.id,
      language: sourceDef.language,
      title,
      link: item.link || '#',
      publishedAt: pubDate,
      timeAgo,
      summary,
      imageUrl
    };
  }

  async fetchSingleSource(sourceDef) {
    const tryUrls = [sourceDef.url];
    if (sourceDef.backupUrl) tryUrls.push(sourceDef.backupUrl);

    for (const feedUrl of tryUrls) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const stories = (feed.items || []).slice(0, 25).map(item => this.normalizeStory(item, sourceDef));
        this.sourceStatuses[sourceDef.id] = {
          name: sourceDef.name,
          status: 'online',
          lastSuccess: new Date().toISOString(),
          errorCount: 0
        };
        return stories;
      } catch (err) {
        // Continue to backup if available
      }
    }

    // If both failed
    this.sourceStatuses[sourceDef.id] = {
      name: sourceDef.name,
      status: 'error',
      lastSuccess: this.sourceStatuses[sourceDef.id]?.lastSuccess || null,
      errorCount: (this.sourceStatuses[sourceDef.id]?.errorCount || 0) + 1
    };
    return [];
  }

  async refreshStories() {
    if (this.isFetching) return this.cache;
    this.isFetching = true;

    try {
      // Fetch in parallel with concurrency limit
      const promises = SOURCES.map(s => this.fetchSingleSource(s));
      const results = await Promise.allSettled(promises);

      const allFetched = [];
      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allFetched.push(...res.value);
        }
      });

      // Deduplicate by normalized title
      const seenTitles = new Set();
      const deduped = [];

      allFetched.forEach(story => {
        const normTitle = story.title.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
        if (normTitle && !seenTitles.has(normTitle)) {
          seenTitles.add(normTitle);
          deduped.push(story);
        }
      });

      // Sort by publication date descending
      deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      if (deduped.length > 0) {
        this.cache = deduped;
        this.lastFetched = new Date().toISOString();
      } else if (this.cache.length === 0) {
        // Use fallback if cache is empty and network produced 0 items
        this.cache = this.fallbackData.map(item => ({
          ...item,
          timeAgo: this.formatTimeAgo(item.publishedAt)
        }));
        this.lastFetched = new Date().toISOString();
      }

      return this.cache;
    } catch (e) {
      console.error('[NewsService] Refresh error:', e.message);
      if (this.cache.length === 0) {
        this.cache = this.fallbackData.map(item => ({
          ...item,
          timeAgo: this.formatTimeAgo(item.publishedAt)
        }));
        this.lastFetched = new Date().toISOString();
      }
      return this.cache;
    } finally {
      this.isFetching = false;
    }
  }

  async getNews({ source, language, search, limit = 80 }) {
    // If cache is empty or older than refresh interval, fetch
    const now = Date.now();
    const cacheAge = this.lastFetched ? now - new Date(this.lastFetched).getTime() : Infinity;

    if (!this.cache.length || cacheAge > this.refreshInterval) {
      await this.refreshStories();
    }

    let result = [...this.cache];

    // Filter by source
    if (source && source !== 'all') {
      const lowerSource = source.toLowerCase();
      result = result.filter(s =>
        s.sourceId.toLowerCase() === lowerSource ||
        s.source.toLowerCase().includes(lowerSource)
      );
    }

    // Filter by language
    if (language && language !== 'all') {
      result = result.filter(s => s.language === language);
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.summary && s.summary.toLowerCase().includes(q)) ||
        s.source.toLowerCase().includes(q)
      );
    }

    return {
      stories: result.slice(0, parseInt(limit, 10)),
      total: result.length,
      lastFetched: this.lastFetched,
      sourcesCount: Object.keys(this.sourceStatuses).length
    };
  }

  async searchLiveWeb(query, language = 'hi') {
    if (!query || !query.trim()) return [];
    try {
      const encoded = encodeURIComponent(query.trim());
      const feedUrl = language === 'hi'
        ? `https://news.google.com/rss/search?q=${encoded}&hl=hi&gl=IN&ceid=IN:hi`
        : `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;

      const feed = await parser.parseURL(feedUrl);
      return (feed.items || []).slice(0, 10).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: item.source?._ || item.source || 'News Wire',
        summary: item.contentSnippet || ''
      }));
    } catch (e) {
      console.warn(`[NewsService] Live web search error for "${query}":`, e.message);
      return [];
    }
  }

  getSources() {
    return SOURCES.map(s => ({
      id: s.id,
      name: s.name,
      language: s.language,
      category: s.category,
      status: this.sourceStatuses[s.id]?.status || 'unknown',
      lastSuccess: this.sourceStatuses[s.id]?.lastSuccess || null
    }));
  }
}

const newsServiceInstance = new NewsService();

module.exports = newsServiceInstance;
