const express = require('express');
const router = express.Router();
const newsService = require('../services/newsService');
const { sanitizeText } = require('../utils/validation');

/**
 * GET /api/news
 * Fetches latest headlines with filtering support.
 */
router.get('/', async (req, res, next) => {
  try {
    const { source, language, search, limit } = req.query;

    const cleanSource = source ? sanitizeText(source, 50) : 'all';
    const cleanLanguage = language ? sanitizeText(language, 10) : 'all';
    const cleanSearch = search ? sanitizeText(search, 100) : '';
    const cleanLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 80)) : 80;

    const data = await newsService.getNews({
      source: cleanSource,
      language: cleanLanguage,
      search: cleanSearch,
      limit: cleanLimit
    });

    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/news/search
 * Searches news using live web index.
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, lang } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required.'
      });
    }

    const cleanQuery = sanitizeText(q, 100);
    const language = lang === 'en' ? 'en' : 'hi';
    const results = await newsService.searchLiveWeb(cleanQuery, language);

    res.json({
      success: true,
      query: cleanQuery,
      total: results.length,
      results
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/news/sources
 * Returns source registry and current health status.
 */
router.get('/sources', (req, res) => {
  const sources = newsService.getSources();
  res.json({
    success: true,
    total: sources.length,
    sources
  });
});

/**
 * POST /api/news/refresh
 * Manually trigger refresh of stories.
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const stories = await newsService.refreshStories();
    res.json({
      success: true,
      message: 'Stories refreshed successfully.',
      total: stories.length,
      refreshedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
