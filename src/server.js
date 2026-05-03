require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const driver = require('./config/db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ==========================================
// Middleware: API Key Security (PRD §7.6)
// ==========================================
const API_KEY = process.env.INTERNAL_API_KEY;

const apiKeyAuth = (req, res, next) => {
    // Skip auth for GET routes (Public Dashboards)
    if (req.method === 'GET') return next();

    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    if (!API_KEY) {
        console.warn('[AUTH] INTERNAL_API_KEY not configured. Allowing access for development.');
        return next();
    }

    if (providedKey !== API_KEY) {
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'A valid X-API-KEY header is required for this action.' 
        });
    }
    next();
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Apply auth to all analytical/write routes globally if needed, 
// or let routers handle it. For now, matching original server logic:
app.post('/api/strategy', apiKeyAuth);
app.post('/api/analyze', apiKeyAuth);
app.post('/api/search', apiKeyAuth);

// ==========================================
// Self-Ping: Keep Render free tier awake
// ==========================================
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
setInterval(async () => {
    try {
        await fetch(`${RENDER_URL}/api/status`);
        console.log('[SELF-PING] Server kept alive at', new Date().toISOString());
    } catch (e) {
        console.warn('[SELF-PING] Failed:', e.message);
    }
}, 10 * 60 * 1000); // every 10 minutes

// ==========================================
// Routers
// ==========================================
const geographyRoutes = require('./routes/geography');
const boothRoutes = require('./routes/booth');
const sentimentRoutes = require('./routes/sentiment');
const strategyRoutes = require('./routes/strategy');
const newsRoutes = require('./routes/news');
const schemesRoutes = require('./routes/schemes');
const electionsRoutes = require('./routes/elections');
const proxyRoutes = require('./routes/proxy');
const statusRoutes = require('./routes/status');

// Mount routes
app.use('/api/up', geographyRoutes); // /api/up/region, /api/up/district, /api/up/geo
app.use('/api/up/booth', boothRoutes);
app.use('/api/up/sentiment', sentimentRoutes);
app.use('/api', strategyRoutes); // /api/strategy, /api/analyze, /api/search
app.use('/api/up', newsRoutes); // /api/up/channel-live, /api/up/weather, /api/up/news
app.use('/api/up/schemes', schemesRoutes);
app.use('/api/up', electionsRoutes); // constituency/.../results, candidates, competitive, recommendation
app.use('/proxy/myneta', proxyRoutes);
app.use('/api', statusRoutes); // /api/status, /api/state-info/:state

// ==========================================
// Sentiment Pipeline Cron (every 6 hours)
// ==========================================
const { execFile } = require('child_process');

function runSentimentPipeline() {
    const python = process.env.PYTHON_BIN || 'python3';
    const script = path.join(__dirname, '..', 'scripts', 'run_sentiment_pipeline.py');
    console.log('[CRON] Starting sentiment pipeline...');
    execFile(python, [script], { cwd: path.join(__dirname, '..'), timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
        if (err) {
            console.error('[CRON] Sentiment pipeline error:', err.message);
            if (stderr) console.error('[CRON] stderr:', stderr.slice(0, 500));
        } else {
            console.log('[CRON] Sentiment pipeline complete.');
            if (stdout) console.log('[CRON]', stdout.slice(-500));
        }
    });
}

const SENTIMENT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
setInterval(runSentimentPipeline, SENTIMENT_INTERVAL_MS);

process.on('SIGINT', async () => {
    await driver.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Ontology Engine server is running on http://localhost:${port}`);
});
