const express = require('express');
const router = express.Router();
const { fetchNewsData, STATE_CACHE_DURATION } = require('../utils/cache');

// ── YouTube Live Stream Resolver (dynamic, 30-min cache) ──────────────────
const _liveCacheMap = {};
router.get('/channel-live/:handle', async (req, res) => {
    const handle = req.params.handle;
    const now = Date.now();

    // Serve from cache if fresh (30 min)
    if (_liveCacheMap[handle] && now - _liveCacheMap[handle].ts < 30 * 60 * 1000) {
        console.log(`[LIVE] Cache hit: ${handle}`);
        return res.json(_liveCacheMap[handle]);
    }

    console.log(`[LIVE] Resolving live stream for: ${handle}`);
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`https://www.youtube.com/@${handle}/live`, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
        });
        clearTimeout(timeout);

        const html = await response.text();

        // Extract video ID from YouTube page source
        const patterns = [
            /"videoId":"([a-zA-Z0-9_-]{11})"/,
            /watch\?v=([a-zA-Z0-9_-]{11})/,
            /"LIVE_STREAM_OFFLINE"[^}]*"videoId":"([a-zA-Z0-9_-]{11})"/
        ];

        let videoId = null;
        for (const pat of patterns) {
            const m = html.match(pat);
            if (m) { videoId = m[1]; break; }
        }

        const result = {
            handle,
            videoId,
            embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : null,
            channelUrl: `https://www.youtube.com/@${handle}/live`,
            ts: now
        };

        if (videoId) _liveCacheMap[handle] = result;
        console.log(`[LIVE] ${handle} → videoId: ${videoId || 'NOT LIVE'}`);
        return res.json(result);

    } catch (e) {
        console.warn(`[LIVE] Failed for ${handle}: ${e.message}`);
        return res.json({
            handle,
            videoId: null,
            channelUrl: `https://www.youtube.com/@${handle}/live`,
            error: e.message,
            ts: now
        });
    }
});

// UP Dashboard: Weather Route
router.get('/weather', async (req, res) => {
    try {
        // Fetch weather for Lucknow, UP
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=26.8467&longitude=80.9462&current_weather=true');
        const data = await response.json();
        if (data && data.current_weather) {
            res.json(data.current_weather);
        } else {
            throw new Error("Invalid weather data");
        }
    } catch (error) {
        console.error("Weather fetch error:", error);
        res.status(500).json({ error: "Failed to fetch weather data" });
    }
});

// UP Social Media News Proxy — routes through dual-key rotation
// Called by upsocial.js instead of hitting NewsData.io directly
const upNewsCache = { data: null, ts: 0 };
router.get('/news', async (req, res) => {
    const CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours
    if (upNewsCache.data && Date.now() - upNewsCache.ts < CACHE_MS) {
        return res.json(upNewsCache.data);
    }
    const results = await fetchNewsData(
        'uttar pradesh',
        new Map(),
        'up-social-news',
        CACHE_MS,
        10
    );
    const articles = (results || []).slice(0, 10).map(a => ({
        title:       a.title || '',
        description: (a.description || '').replace(/<[^>]*>/g, '').substring(0, 200),
        link:        a.link || '#',
        pubDate:     a.pubDate || '',
        source_id:   a.source_id || 'News',
        image_url:   a.image_url || null
    }));
    upNewsCache.data = { status: 'success', results: articles };
    upNewsCache.ts = Date.now();
    res.json(upNewsCache.data);
});

module.exports = router;
