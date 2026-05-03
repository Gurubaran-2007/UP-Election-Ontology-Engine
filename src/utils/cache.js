const { getActiveNewsKey, NEWSDATA_KEYS } = require('../config/ai');

const newsCache = new Map();           // per-query news cache
const stateNewsCache = new Map();      // per-state news cache
const districtNewsCache = new Map();   // per-district news cache
const schemesCache = { data: null, ts: 0 };
const CACHE_DURATION         = 4 * 60 * 60 * 1000;  // 4 hours
const SCHEMES_CACHE_DURATION = 4 * 60 * 60 * 1000;  // 4 hours
const STATE_CACHE_DURATION   = 4 * 60 * 60 * 1000;  // 4 hours per state
const DIST_CACHE_DURATION    = 4 * 60 * 60 * 1000;  // 4 hours per district

// Shared NewsData.io fetch helper — auto-rotates between 2 API keys on rate limit
const fetchNewsData = async (query, cacheMap, cacheKey, duration, maxResults = 5) => {
    if (NEWSDATA_KEYS.length === 0) {
        return [];
    }

    const now = Date.now();
    const cached = cacheMap.get(cacheKey);
    if (cached && now - cached.ts < duration) {
        console.log(`[NEWS CACHE] Hit for: ${cacheKey}`);
        return cached.data;
    }

    // Try both keys — switch automatically if one is rate-limited
    for (let attempt = 0; attempt < NEWSDATA_KEYS.length; attempt++) {
        const keyObj = getActiveNewsKey();
        if (!keyObj) break;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(
                `https://newsdata.io/api/1/news?apikey=${keyObj.key}&q=${encodeURIComponent(query)}&country=in&language=en&size=${maxResults}`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (res.status === 429) {
                // Mark this key as exhausted and try the next key
                keyObj.exhausted = true;
                keyObj.resetAt = Date.now();
                console.warn(`[NEWS KEY] Key ...${keyObj.key.slice(-6)} rate-limited — switching to next key`);
                continue; // retry loop with next key
            }
            if (!res.ok) return cached ? cached.data : [];
            const data = await res.json();
            if (data.status === 'error') {
                if (data.message && data.message.toLowerCase().includes('limit')) {
                    keyObj.exhausted = true;
                    keyObj.resetAt = Date.now();
                    console.warn(`[NEWS KEY] Key ...${keyObj.key.slice(-6)} quota error — switching key`);
                    continue;
                }
                return cached ? cached.data : [];
            }
            cacheMap.set(cacheKey, { data: data.results || [], ts: now });
            return data.results || [];
        } catch (e) {
            console.warn(`[NEWS] Fetch error on attempt ${attempt + 1}:`, e.message);
            // Don't return — try the next key
            continue;
        }
    }

    // Both keys exhausted — serve stale cache
    console.warn('[NEWS] Both API keys exhausted — serving stale cache');
    return cached ? cached.data : [];
};

const getCachedNews = async (query) => {
    const results = await fetchNewsData(query, newsCache, query, CACHE_DURATION, 5);
    return (results || []).slice(0, 3).map(a => a.title).join(' | ');
};

module.exports = {
    newsCache,
    stateNewsCache,
    districtNewsCache,
    schemesCache,
    CACHE_DURATION,
    SCHEMES_CACHE_DURATION,
    STATE_CACHE_DURATION,
    DIST_CACHE_DURATION,
    fetchNewsData,
    getCachedNews
};
