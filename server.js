require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const newsRoutes = require('./routes/news');
const verifyRoutes = require('./routes/verify');
const newsService = require('./services/newsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration - Allow same-origin, Render deployments, localhost, and external clients
app.use(cors());

// Body Parsers with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api', generalLimiter);

// Verification Endpoint Specific Rate Limiter (Protects AI Quotas)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Verification rate limit reached (40 checks per 15 minutes). Please wait before submitting more claims.'
  }
});
app.use('/api/verify', verifyLimiter);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (never exposes secrets or keys)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    configuration: {
      aiProvider: process.env.AI_PROVIDER || 'gemini',
      aiModel: process.env.AI_MODEL || 'gemini-1.5-flash',
      hasApiKey: Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 5),
      newsRefreshIntervalMs: parseInt(process.env.NEWS_REFRESH_INTERVAL || '300000', 10),
      cachedStoriesCount: newsService.cache.length,
      lastNewsFetch: newsService.lastFetched
    }
  });
});

// Mount Routes
app.use('/api/news', newsRoutes);
app.use('/api/verify', verifyRoutes);

// Fallback for SPA or unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.baseUrl}`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err.message);

  const status = err.status || 500;
  const message = err.message || 'An unexpected internal server error occurred.';

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server when run directly
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`TrueWire — Live Desk & AI Verification`);
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
    console.log(`AI API Key configured: ${Boolean(process.env.AI_API_KEY)}`);
    console.log(`=======================================================`);

    // Initial background fetch of news
    newsService.refreshStories().catch(e => {
      console.warn('[InitialFetch] Could not pre-fetch news:', e.message);
    });
  });
}

module.exports = { app, server };
