const express = require('express');
const router = express.Router();
const { fetchNewsData, SCHEMES_CACHE_DURATION, schemesCache } = require('../utils/cache');

router.get('/', async (req, res) => {
    const SCHEMES_CACHE_DURATION_LOCAL = 4 * 60 * 60 * 1000; // 4 hours
    if (schemesCache.data && Date.now() - schemesCache.ts < SCHEMES_CACHE_DURATION_LOCAL) {
        return res.json(schemesCache.data);
    }
    try {
        const results = await fetchNewsData(
            'Uttar Pradesh Government Scheme Yojana',
            new Map(),
            'up-schemes',
            SCHEMES_CACHE_DURATION,
            8
        );

        const processArticle = (article) => {
            const title = (article.title || 'Government Policy Update').replace(/<[^>]*>/g, '').substring(0, 120);
            const description = (article.description || article.content || 'No details available.')
                .replace(/<[^>]*>/g, '').substring(0, 160) + '...';
            const url = article.link || '#';
            let announcer = 'UP Government Official';
            const lower = title.toLowerCase();
            if (lower.includes('yogi')) announcer = 'CM Yogi Adityanath';
            else if (lower.includes('modi') || lower.includes(' pm ')) announcer = 'PM Narendra Modi';
            return { title, politician: announcer, description, url };
        };

        const articles = (results || []).map(processArticle);
        const result = {
            recent: articles.slice(0, 2),
            future: articles.slice(2, 4)
        };
        schemesCache.data = result;
        schemesCache.ts = Date.now();
        res.json(result);
    } catch (error) {
        console.error('[SCHEMES] Fetch failed:', error.message);
        if (schemesCache.data) return res.json(schemesCache.data);
        res.json({ recent: [], future: [] });
    }
});

module.exports = router;
