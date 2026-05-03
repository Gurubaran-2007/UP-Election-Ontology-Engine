const express = require('express');
const router = express.Router();
const driver = require('../config/db');
const { SARVAM_API_KEY } = require('../config/ai');
const { fetchNewsData, STATE_CACHE_DURATION, stateNewsCache } = require('../utils/cache');
const fs = require('fs');
const path = require('path');

router.get('/status', async (req, res) => {
    let dbStatus = 'Disconnected';
    let aiStatus = 'Disconnected';

    const withTimeout = (promise, ms) =>
        Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);

    // Check DB
    try {
        const session = driver.session();
        await withTimeout(session.run('RETURN 1'), 3000);
        await session.close();
        dbStatus = 'Connected';
    } catch (err) {
        console.error("Neo4j connection error:", err.message);
    }

    // Check AI — verify Sarvam AI API connection
    try {
        if (SARVAM_API_KEY) {
            const sarvamStatus = await withTimeout(fetch('https://api.sarvam.ai/v1/models', {
                headers: { 'api-subscription-key': SARVAM_API_KEY }
            }), 3000);
            if (sarvamStatus.ok) {
                aiStatus = 'Connected';
            }
        } else {
            aiStatus = 'Unconfigured';
        }
    } catch (err) {
        console.error("Sarvam AI connection error:", err.message);
    }

    res.json({ 
        status: 'Server is running', 
        database: dbStatus, 
        ai: aiStatus 
    });
});

// ==========================================
// India Map State Info Aggregator
// ==========================================
router.get('/state-info/:state', async (req, res) => {
    const stateName = req.params.state;
    
    // 1. Fetch Political Data (Prioritize Graph for UP, Fallback to JSON)
    let stateData = {
        population: "Data Updating...",
        cm: "Updating...",
        cm_years: "0",
        districts: []
    };
    
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (d:District)
             WHERE toLower(d.state) = toLower($state)
             RETURN d.name AS name, d.sample_politician AS politician, d.sample_years AS years, d.total_population AS pop
             ORDER BY d.name`,
            { state: stateName }
        );
        await session.close();

        if (result.records.length > 0) {
            const districts = result.records.map(r => ({
                name: r.get('name'),
                politician: r.get('politician') || 'N/A',
                years: r.get('years') || '0'
            }));
            const totalPop = result.records.reduce((sum, r) => sum + (r.get('pop')?.toNumber() || 0), 0);
            
            stateData = {
                population: totalPop > 0 ? totalPop.toLocaleString() : "Data Ingesting...",
                cm: stateName === 'Uttar Pradesh' ? 'Yogi Adityanath' : 'Updating...',
                cm_years: stateName === 'Uttar Pradesh' ? '7' : '0',
                districts: districts.slice(0, 10) // Show top 10
            };
        } else {
            // Fallback to JSON for other states
            // Adjusted path since this file is now in src/routes/
            const dataPath = path.join(__dirname, '..', '..', 'data', 'india_data.json');
            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath, 'utf8');
                const parsedData = JSON.parse(rawData);
                stateData = parsedData[stateName] || parsedData["Default"];
            }
        }
    } catch (e) {
        console.error("Error fetching state data:", e.message);
    }

    // 2. Fetch Top 5 Headlines via NewsData.io (works from cloud servers)
    let news = [];
    try {
        const results = await fetchNewsData(
            stateName + ' politics',
            stateNewsCache,
            stateName,
            STATE_CACHE_DURATION,
            5
        );
        
        news = (results || []).slice(0, 5)
            .map(a => ({ title: a.title || '', url: a.link || '#' }))
            .filter(n => n.title.length > 5);

        if (news.length === 0) {
            news = [{ title: `No recent news found for ${stateName}.`, url: '#' }];
        }
    } catch (e) {
        console.error("News Fetch Error:", e.message);
        news = [{ title: "Unable to load real-time news at this time.", url: "#" }];
    }

    res.json({
        state: stateName,
        political_data: stateData,
        news: news
    });
});

module.exports = router;
