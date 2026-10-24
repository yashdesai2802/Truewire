const express = require('express');
const router = express.Router();
const verificationService = require('../services/verificationService');
const articleService = require('../services/articleService');
const { handleImageUpload } = require('../middleware/uploadValidation');
const { sanitizeText } = require('../utils/validation');

/**
 * POST /api/verify/text
 * Verifies a claim or news excerpt submitted as plain text.
 */
router.post('/text', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a non-empty text claim to verify.'
      });
    }

    const cleanText = sanitizeText(text, 5000);
    const result = await verificationService.verifyText(cleanText);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/verify/link
 * Fetches an article securely and cross-checks its claims.
 */
router.post('/link', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an article URL to verify.'
      });
    }

    // 1. Fetch & extract article safely
    const articleData = await articleService.processArticleUrl(url.trim());

    // 2. Perform verification on extracted article data
    const result = await verificationService.verifyLink(articleData);

    res.json({
      success: true,
      article: {
        title: articleData.title,
        publisher: articleData.publisher,
        publishedAt: articleData.publishedAt,
        url: articleData.url
      },
      data: result
    });
  } catch (err) {
    // Return friendly error code for invalid/blocked URLs
    if (err.message.includes('SSRF') || err.message.includes('protocols are allowed') || err.message.includes('Malformed')) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    if (err.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: 'The target article server timed out. Please check the URL or try again.'
      });
    }
    next(err);
  }
});

/**
 * POST /api/verify/image
 * Verifies claims in an uploaded image using vision analysis.
 */
router.post('/image', handleImageUpload, async (req, res, next) => {
  try {
    const file = req.file;
    const result = await verificationService.verifyImage(
      file.buffer,
      file.verifiedMimeType || file.mimetype,
      file.originalname || 'uploaded-image.png'
    );

    res.json({
      success: true,
      fileInfo: {
        filename: file.originalname,
        mimeType: file.verifiedMimeType || file.mimetype,
        sizeBytes: file.size
      },
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/verify
 * Unified verification endpoint supporting { type: 'text'|'url'|'image', text, url, image }
 */
router.post('/', async (req, res, next) => {
  try {
    const { type, text, url } = req.body || {};

    if (type === 'url' || url) {
      const targetUrl = url || text;
      if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ success: false, error: 'Article URL is required.' });
      }
      const articleData = await articleService.processArticleUrl(targetUrl.trim());
      const result = await verificationService.verifyLink(articleData);
      return res.json({ success: true, article: articleData, data: result });
    }

    // Default to text
    const claimText = text || '';
    if (!claimText || !claimText.trim()) {
      return res.status(400).json({ success: false, error: 'Text claim is required.' });
    }

    const cleanText = sanitizeText(claimText, 5000);
    const result = await verificationService.verifyText(cleanText);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
