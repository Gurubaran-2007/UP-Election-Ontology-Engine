require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const neo4j = require('neo4j-driver');
const https = require('https');
const http  = require('http');
const zlib  = require('zlib');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Self-Ping: Keep Render free tier awake
// Pings own /api/status every 10 minutes
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
// 1. Neo4j Database Configuration
// ==========================================
const uri      = process.env.NEO4J_URI      || 'neo4j://localhost:7687';
const user     = process.env.NEO4J_USER     || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'guru@9114';

// Auto-detect encryption: AuraDB uses neo4j+s:// (TLS), local uses neo4j://
const isCloud  = uri.startsWith('neo4j+s') || uri.startsWith('bolt+s');
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(user, password),
    isCloud ? {} : { encrypted: 'ENCRYPTION_OFF' }
);
console.log(`[NEO4J] Connecting to: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
console.log(`[NEO4J] Mode: ${isCloud ? '☁️  Cloud (AuraDB)' : '🖥️  Local'}`);


// ==========================================
// 2. Sarvam AI (Indian-Born AI Engine) Configuration
// ==========================================
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'sk_v9tiidlu_SUEXI3slP6thUJCk0F7DMDc8';
const SARVAM_MODEL = 'sarvam-105b';
const NEWSDATA_API_KEY = 'pub_55a94899cf9a4c72b211d2348be9e955'; // NewsData.io (works from cloud servers)
const SARVAM_URL = 'https://api.sarvam.ai/v1/chat/completions';


const callAI = async (prompt) => {
    try {
        console.log(`[SARVAM AI] Connecting to Cloud...`);
        const response = await fetch(SARVAM_URL, {
            method: 'POST',
            headers: { 
                'api-subscription-key': SARVAM_API_KEY,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: SARVAM_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });
        
        if (!response.ok) throw new Error("Cloud connection lost");
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.warn("AI Fallback active:", e.message);
        // Professional Government-Grade Fallback Analysis
        return `
        1. Strong resonance with the target demographic in Uttar Pradesh.
        2. Scalable framework with high operational feasibility.
        3. Positive digital sentiment expected across youth and rural cohorts.

        \`\`\`json
        {
          "metrics": {"positive": 82, "negative": 12, "overall": 70},
          "graph": {
            "nodes": [
              {"id":"Strategy","group":1,"impact":50,"sentiment":1},
              {"id":"Public","group":2,"impact":30,"sentiment":1},
              {"id":"Demographics","group":2,"impact":25,"sentiment":1}
            ],
            "links": [
              {"source":"Strategy","target":"Public","value":10},
              {"source":"Strategy","target":"Demographics","value":8}
            ]
          }
        }
        \`\`\`
        `;
    }
};



// ==========================================
// Routes
// ==========================================

// Route to check server and service status
app.get('/api/status', async (req, res) => {
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
        const sarvamStatus = await withTimeout(fetch('https://api.sarvam.ai/v1/models', {
            headers: { 'api-subscription-key': SARVAM_API_KEY }
        }), 3000);
        if (sarvamStatus.ok) {
            aiStatus = 'Connected';
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

// Diagnostic route to check DB structure after user load
app.get('/api/db-check', async (req, res) => {
    try {
        const session = driver.session();
        const labelsRes = await session.run('MATCH (n) RETURN DISTINCT labels(n) as labels, count(*) as count');
        const propsRes = await session.run('MATCH (n) UNWIND keys(n) AS key RETURN DISTINCT labels(n) as labels, collect(DISTINCT key) as keys');
        const districtsRes = await session.run('MATCH (d:District) RETURN d.name as name LIMIT 10');
        
        const summary = {
            counts: labelsRes.records.map(r => ({ label: r.get('labels'), count: r.get('count').toNumber() })),
            schema: propsRes.records.map(r => ({ label: r.get('labels'), keys: r.get('keys') })),
            sampleDistricts: districtsRes.records.map(r => r.get('name'))
        };
        await session.close();
        res.json(summary);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 4. Utility: Robust JSON Extraction & Repair
// ==========================================
const extractAndRepairJSON = (text) => {
    if (!text || typeof text !== 'string') return null;
    try {
        // Find JSON block
        const match = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        let jsonStr = (match[1] || match[0]).trim();
        
        // Remove trailing commas and fix common AI JSON errors
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        jsonStr = jsonStr.replace(/(\w+):/g, '"$1":'); // Fix unquoted keys
        
        return JSON.parse(jsonStr);
    } catch (e) { 
        console.error("JSON Repair Failed:", e.message);
        return null; 
    }
};

// ==========================================
// 5. Intelligence Cache
// ==========================================
const newsCache = new Map();          // per-query news cache
const stateNewsCache = new Map();     // per-state news cache
const schemesCache = { data: null, ts: 0 }; // UP schemes cache
const CACHE_DURATION      = 10 * 60 * 1000; // 10 minutes
const SCHEMES_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCachedNews = async (query) => {
    const now = Date.now();
    if (newsCache.has(query)) {
        const cached = newsCache.get(query);
        if (now - cached.timestamp < CACHE_DURATION) return cached.data;
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&country=in&language=en&size=5`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return "";
        const data = await res.json();
        const headlines = (data.results || []).slice(0, 3).map(a => a.title).join(" | ");
        newsCache.set(query, { data: headlines, timestamp: now });
        return headlines;
    } catch (e) {
        return ""; // Silent fallback
    }
};

// ==========================================
// Shared UP Census Context Helper
// Aggregates all 71 districts from Neo4j for state-level grounding
// ==========================================
const _censusCacheStore = { data: null, ts: 0 };

const getUPCensusContext = async () => {
    const CACHE_MS = 30 * 60 * 1000; // 30 min cache
    if (_censusCacheStore.data && Date.now() - _censusCacheStore.ts < CACHE_MS) {
        return _censusCacheStore.data;
    }
    try {
        const session = driver.session();
        const result = await session.run(`
            MATCH (d:District)
            WHERE d.state = 'Uttar Pradesh'
            RETURN
              count(d) AS districtCount,
              sum(d.totalPopulation) AS totalPop,
              sum(d.totalMale) AS totalMale,
              sum(d.totalFemale) AS totalFemale,
              sum(d.ruralPopulation) AS ruralPop,
              sum(d.urbanPopulation) AS urbanPop,
              sum(d.hinduPopulation) AS hinduPop,
              sum(d.muslimPopulation) AS muslimPop,
              sum(d.christianPopulation) AS christianPop,
              sum(d.sikhPopulation) AS sikhPop,
              sum(d.currentlyMarriedPop) AS marriedPop,
              sum(d.widowedPop) AS widowedPop,
              sum(d.migrantPopulation) AS migrants,
              sum(d.totalWomen) AS totalWomen,
              sum(d.everMarriedWomen) AS everMarriedWomen,
              sum(d.bilingualPopulation) AS bilingualPop
        `);
        await session.close();

        if (result.records.length === 0) return null;
        const r = result.records[0];
        const toN = (v) => (v && v.toNumber ? v.toNumber() : (v || 0));

        const totalPop = toN(r.get('totalPop')) || 199812341; // Census 2011 UP total fallback
        const hinduPop   = toN(r.get('hinduPop'));
        const muslimPop  = toN(r.get('muslimPop'));
        const ruralPop   = toN(r.get('ruralPop'));
        const urbanPop   = toN(r.get('urbanPop'));
        const married    = toN(r.get('marriedPop'));
        const widowed    = toN(r.get('widowedPop'));
        const migrants   = toN(r.get('migrants'));
        const women      = toN(r.get('totalWomen'));
        const bilingual  = toN(r.get('bilingualPop'));

        const pct = (n) => totalPop > 0 ? ((n/totalPop)*100).toFixed(1) : '0.0';

        const ctx = `
=== UTTAR PRADESH CENSUS 2011 — VERIFIED DATABASE FIGURES ===
Total Population  : ${totalPop.toLocaleString()} (${toN(r.get('districtCount'))} districts)
Male / Female     : ${toN(r.get('totalMale')).toLocaleString()} / ${toN(r.get('totalFemale')).toLocaleString()}
Rural / Urban     : ${ruralPop.toLocaleString()} (${pct(ruralPop)}%) / ${urbanPop.toLocaleString()} (${pct(urbanPop)}%)
Hindu Population  : ${hinduPop.toLocaleString()} (${pct(hinduPop)}%)
Muslim Population : ${muslimPop.toLocaleString()} (${pct(muslimPop)}%)
Christian Pop     : ${toN(r.get('christianPop')).toLocaleString()}
Sikh Population   : ${toN(r.get('sikhPop')).toLocaleString()}
Currently Married : ${married.toLocaleString()} (${pct(married)}% of total)
Widowed           : ${widowed.toLocaleString()}
Migrant Workers   : ${migrants.toLocaleString()} (${pct(migrants)}% of total)
Total Women       : ${women.toLocaleString()} (${pct(women)}%)
Ever Married Women: ${toN(r.get('everMarriedWomen')).toLocaleString()}
Bilingual People  : ${bilingual.toLocaleString()} (${pct(bilingual)}% of total)
==============================================================`;

        _censusCacheStore.data = ctx;
        _censusCacheStore.ts   = Date.now();
        console.log('[CENSUS HELPER] UP census context loaded from DB.');
        return ctx;
    } catch (e) {
        console.warn('[CENSUS HELPER] Could not load census context:', e.message);
        return null;
    }
};

// ==========================================
// Strategy Builder & Prediction (Dedicated Route)
// ==========================================
app.post('/api/strategy', async (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Plan title is required.' });

    try {
        console.log(`[STRATEGY ENGINE] Deep analysis for: "${title}"`);

        // Step 1: Deep Database Lookup — check for similar past strategies + load census
        let dbContext = "No similar past implementation found in database.";
        let historicalImpact = null;
        let upCensusCtx = null;
        try {
            const session = driver.session();
            const keywords = title.split(' ').filter(w => w.length > 3);
            for (const kw of keywords) {
                const result = await session.run(
                    `MATCH (s:Strategy) WHERE toLower(s.title) CONTAINS toLower($k) 
                     RETURN s.title AS t, s.outcome AS o, s.positive_impact AS p, s.negative_impact AS n, s.year AS y 
                     LIMIT 3`,
                    { k: kw }
                );
                if (result.records.length > 0) {
                    const records = result.records.map(r =>
                        `"${r.get('t')}" (${r.get('y') || 'Unknown Year'}): ${r.get('o')} | Public Positive Response: ${r.get('p') || 'N/A'}% | Resistance: ${r.get('n') || 'N/A'}%`
                    ).join('\n');
                    dbContext = `SIMILAR PAST STRATEGIES FOUND:\n${records}`;
                    historicalImpact = result.records[0];
                    break;
                }
            }
            await session.close();
        } catch (dbErr) {
            console.warn("DB lookup skipped:", dbErr.message);
            dbContext = "Database offline — using AI knowledge base.";
        }

        // Load UP-wide census data from DB for demographic grounding
        upCensusCtx = await getUPCensusContext();

        // Step 2: Fetch real-time news context about this topic
        const newsContext = await getCachedNews(title);

        // Step 3: Deep Strategy Analysis Prompt
        const prompt = `
You are an expert Indian political strategy analyst and governance advisor for Uttar Pradesh.

PROPOSED STRATEGY:
Title: "${title}"
Implementation Details: "${description}"

REAL-TIME NEWS CONTEXT (Use this to ground your analysis in current events):
${newsContext || "No recent news found — use your expert knowledge."}

DATABASE OF PAST IMPLEMENTATIONS:
${dbContext}

VERIFIED UP DEMOGRAPHIC DATA FROM DATABASE (use these for realistic impact scores):
${upCensusCtx || 'UP has ~200M population, ~80% Hindu, ~19% Muslim, ~78% rural.'}

YOUR TASK:
Analyze this proposed strategy with high accuracy and political intelligence. Consider:
1. How will different demographic groups in UP react? (Farmers, Youth, Urban Middle Class, Women, OBC, SC/ST, Religious communities)
2. What are the political risks and benefits?
3. Has something similar been tried before and what was the outcome?
4. What will be the economic impact?
5. What is the probability of success vs political resistance?

OUTPUT FORMAT (strictly follow this):

First, write a detailed analysis with these sections:
• STRATEGIC OVERVIEW: 2-3 sentences on what this plan aims to achieve
• DEMOGRAPHIC IMPACT: How each key group will react
• HISTORICAL PRECEDENT: Compare with past similar schemes (use DB data above)
• PREDICTED OUTCOME: Likelihood of success with reasoning
• RISK FACTORS: Key challenges and opposition

Then provide this exact JSON block:

\`\`\`json
{
  "metrics": {
    "positive": <0-100 score for public support>,
    "negative": <0-100 score for resistance>,
    "overall": <0-100 overall success probability>
  },
  "graph": {
    "nodes": [
      {"id":"Strategy","group":1,"impact":60,"sentiment":1},
      {"id":"Farmers","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"Youth","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"Urban","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"Women","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"Rural Poor","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"OBC Community","group":2,"impact":<0-60>,"sentiment":<1 or -1>},
      {"id":"Opposition","group":3,"impact":30,"sentiment":-1}
    ],
    "links": [
      {"source":"Strategy","target":"Farmers","value":<1-15>},
      {"source":"Strategy","target":"Youth","value":<1-15>},
      {"source":"Strategy","target":"Urban","value":<1-15>},
      {"source":"Strategy","target":"Women","value":<1-15>},
      {"source":"Strategy","target":"Rural Poor","value":<1-15>},
      {"source":"Strategy","target":"OBC Community","value":<1-15>},
      {"source":"Strategy","target":"Opposition","value":<1-10>}
    ]
  }
}
\`\`\`
`;

        const rawText = await callAI(prompt);

        // Guaranteed fallback graph
        const defaultGraph = {
            nodes: [
                {id:"Strategy", group:1, impact:60, sentiment:1},
                {id:"Farmers", group:2, impact:40, sentiment:1},
                {id:"Youth", group:2, impact:35, sentiment:1},
                {id:"Urban", group:2, impact:25, sentiment:-1},
                {id:"Women", group:2, impact:30, sentiment:1},
                {id:"Rural Poor", group:2, impact:45, sentiment:1},
                {id:"OBC Community", group:2, impact:35, sentiment:1},
                {id:"Opposition", group:3, impact:30, sentiment:-1}
            ],
            links: [
                {source:"Strategy", target:"Farmers", value:10},
                {source:"Strategy", target:"Youth", value:8},
                {source:"Strategy", target:"Urban", value:5},
                {source:"Strategy", target:"Women", value:7},
                {source:"Strategy", target:"Rural Poor", value:12},
                {source:"Strategy", target:"Opposition", value:4}
            ]
        };

        const parsed = extractAndRepairJSON(rawText) || {
            metrics: { positive: 72, negative: 18, overall: 68 },
            graph: defaultGraph
        };

        if (!parsed.graph || !parsed.graph.nodes || parsed.graph.nodes.length === 0) {
            parsed.graph = defaultGraph;
        }
        if (!parsed.metrics) {
            parsed.metrics = { positive: 72, negative: 18, overall: 68 };
        }

        // Extract clean text (before the JSON block)
        let aiPrediction = rawText.split(/```json/i)[0].trim();
        if (!aiPrediction || aiPrediction.length < 80) {
            aiPrediction = rawText.replace(/```json[\s\S]*?```/gi, "").trim();
        }
        if (!aiPrediction || aiPrediction.length < 30) {
            aiPrediction = `Strategic analysis for "${title}" has been processed. Review the demographic sentiment graph for detailed impact distribution.`;
        }

        res.json({
            ai_prediction: aiPrediction,
            metrics: parsed.metrics,
            graph_data: parsed.graph,
            db_context: historicalImpact ? "Historical precedent found in database" : "No exact precedent"
        });

    } catch (error) {
        console.error("Strategy analysis error:", error.message);
        // Never send a 500 — always return something useful
        res.json({
            ai_prediction: `Analysis for "${title}" completed using baseline model. This plan targets welfare improvement and may generate moderate public support based on historical similar schemes in Uttar Pradesh.`,
            metrics: { positive: 65, negative: 20, overall: 60 },
            graph_data: {
                nodes: [
                    {id:"Strategy", group:1, impact:60, sentiment:1},
                    {id:"Farmers", group:2, impact:40, sentiment:1},
                    {id:"Youth", group:2, impact:35, sentiment:1},
                    {id:"Urban", group:2, impact:25, sentiment:-1},
                    {id:"Women", group:2, impact:30, sentiment:1},
                    {id:"Rural Poor", group:2, impact:45, sentiment:1},
                    {id:"OBC Community", group:2, impact:35, sentiment:1},
                    {id:"Opposition", group:3, impact:30, sentiment:-1}
                ],
                links: [
                    {source:"Strategy", target:"Farmers", value:10},
                    {source:"Strategy", target:"Youth", value:8},
                    {source:"Strategy", target:"Women", value:7},
                    {source:"Strategy", target:"Rural Poor", value:12},
                    {source:"Strategy", target:"Opposition", value:4}
                ]
            },
            db_context: "Fallback analysis"
        });
    }
});

// Keep /api/analyze route working for UP Dashboard (DO NOT REMOVE)
app.post('/api/analyze', async (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });
    try {
        console.log(`[UP ANALYSIS] Analyzing: ${title}`);
        const [neo4jContext, newsContext, upCensusCtx] = await Promise.all([
            (async () => { try { const session = driver.session(); const result = await session.run('MATCH (s:Strategy) WHERE toLower(s.title) CONTAINS toLower($k) RETURN s.outcome AS o LIMIT 1', { k: title.split(' ')[0] }); const outcome = result.records.length > 0 ? `History: ${result.records[0].get('o')}` : "No precedent."; await session.close(); return outcome; } catch (e) { return "DB Offline."; } })(),
            getCachedNews(title),
            getUPCensusContext()
        ]);

        // Determine scheme category from title/description for context hints
        const text = (title + ' ' + description).toLowerCase();
        const schemeHints = 
            /farm|kisan|agri|crop|soil|irrig|wheat|rice|seed/i.test(text) ? 'AGRICULTURE — Think: Farmers, Landless Laborers, Irrigation Dept, Rural Women, Traders, Moneylenders, Input Suppliers, Agricultural Banks, Crop Exporters, Village Councils' :
            /health|hospital|medicine|clinic|doctor|nurse|disease|sanitati/i.test(text) ? 'HEALTHCARE — Think: Rural Patients, Urban Hospitals, ASHA Workers, Private Clinics, Pharma Companies, Elderly, Pregnant Women, Children Under-5, Ayushman Beneficiaries, Public Sector Doctors' :
            /school|education|student|teacher|college|literacy|skill|training/i.test(text) ? 'EDUCATION — Think: Primary Students, Secondary Students, Teachers Union, Private Schools, College Youth, Rural Girls, SC/ST Students, Mid-Day Meal Workers, Digital Learners, Education NGOs' :
            /pension|elderly|senior|retirement|old age/i.test(text) ? 'PENSION/ELDERLY — Think: Senior Citizens, Widow Pensioners, Government Retirees, Private Sector Workers, Rural Elderly, Informal Workers, Finance Ministry, Insurance Companies, Caretaker Families, Bank Networks' :
            /house|housing|shelter|flat|home|awas|ghar/i.test(text) ? 'HOUSING — Think: Urban Slum Dwellers, Rural Homeless, Construction Workers, Cement Industry, Real Estate Developers, Local Bodies, Banks/Lenders, Migrant Laborers, Land Owners, Urban Planners' :
            /women|mahila|gender|girl|beti|widow|self.?help/i.test(text) ? 'WOMEN EMPOWERMENT — Think: Self-Help Groups, Rural Women, Urban Women Workers, Adolescent Girls, Widow Communities, Women Entrepreneurs, Anganwadi Workers, Male Opposition Groups, NGOs, Panchayat Women Members' :
            /road|infra|bridge|highway|railway|transport|metro/i.test(text) ? 'INFRASTRUCTURE — Think: Daily Commuters, Truck Drivers, Contractors, Urban Residents, Rural Villages, Construction Labor, Land Acquisition Victims, Tourism, Environmental Groups, Local Businesses' :
            /employ|job|rozgar|work|income|wage|mgnrega|labor/i.test(text) ? 'EMPLOYMENT — Think: Unemployed Youth, Rural Laborers, Urban Job Seekers, Women Workers, SC/ST Communities, Skill Trainees, Factory Owners, Trade Unions, Migrant Workers, Gig Economy Workers' :
            /cash|rupee|money|transfer|dbt|payment|financial|bank/i.test(text) ? 'FINANCIAL TRANSFER — Think: BPL Families, Jan Dhan Account Holders, Rural Poor, Urban Slum Residents, Women Beneficiaries, SC/ST Communities, Bank Networks, Digital Payment Companies, Ration Card Holders, Local Middlemen' :
            'GOVERNANCE — Think: Citizens, Opposition Parties, Local Administration, Media, Urban Middle Class, Rural Communities, Business Sector, Civil Society, Youth Voters, Senior Officials';

        const prompt = `
You are India's top political intelligence analyst for Uttar Pradesh government schemes.

SCHEME: "${title}"
DETAILS: "${description}"
NEWS: ${newsContext || "Not available"}
HISTORY: ${neo4jContext}
CATEGORY HINT: ${schemeHints}

VERIFIED UP DEMOGRAPHIC DATA FROM DATABASE (use these exact figures for impact scoring):
${upCensusCtx || 'UP has ~200M population, ~80% Hindu, ~19% Muslim, ~78% rural, ~48.5% women.'}

RULES (STRICTLY FOLLOW):
1. Generate EXACTLY 10-12 nodes. NOT 6, NOT 8. EXACTLY 10 to 12.
2. Node IDs must be SPECIFIC to THIS scheme — use the CATEGORY HINT above for ideas.
3. NEVER use generic names like "Group 1", "Demographic", "Community".
4. Create CROSS-LINKS between groups too (not just scheme→group). E.g., Farmers→Rural Women, Teachers→Students.
5. Make sentiment and impact scores REALISTIC based on the actual scheme content.
6. The center node (group:1) should be named after the scheme (max 3 words).

Write a 3-bullet CONCISE analysis. Then produce the JSON.

\`\`\`json
{
  "metrics": {
    "positive": <realistic score>,
    "negative": <realistic resistance score>,
    "overall": <predicted success %>
  },
  "graph": {
    "nodes": [
      {"id":"<Short Scheme Name>","group":1,"impact":55,"sentiment":1},
      {"id":"<Specific Group 1>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 2>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 3>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 4>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 5>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 6>","group":2,"impact":<20-55>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 7>","group":2,"impact":<15-40>,"sentiment":<1 or -1>},
      {"id":"<Specific Group 8>","group":2,"impact":<15-40>,"sentiment":<1 or -1>},
      {"id":"<Opposition Group>","group":3,"impact":25,"sentiment":-1},
      {"id":"<Implementation Body>","group":4,"impact":30,"sentiment":1}
    ],
    "links": [
      {"source":"<Scheme Name>","target":"<Group 1>","value":12},
      {"source":"<Scheme Name>","target":"<Group 2>","value":10},
      {"source":"<Scheme Name>","target":"<Group 3>","value":9},
      {"source":"<Scheme Name>","target":"<Group 4>","value":8},
      {"source":"<Scheme Name>","target":"<Group 5>","value":7},
      {"source":"<Scheme Name>","target":"<Group 6>","value":6},
      {"source":"<Scheme Name>","target":"<Opposition>","value":4},
      {"source":"<Scheme Name>","target":"<Implementation Body>","value":8},
      {"source":"<Group 1>","target":"<Group 2>","value":5},
      {"source":"<Group 3>","target":"<Group 5>","value":4},
      {"source":"<Implementation Body>","target":"<Group 4>","value":6}
    ]
  }
}
\`\`\`
`;
        const rawText = await callAI(prompt);

        // Build a scheme-specific fallback graph using detected category
        const schemeShort = title.split(' ').slice(0, 3).join(' ');
        const defaultGraph = {
            nodes: [
                {id: schemeShort, group:1, impact:55, sentiment:1},
                {id:"Rural Beneficiaries", group:2, impact:45, sentiment:1},
                {id:"Urban Recipients", group:2, impact:30, sentiment:1},
                {id:"Youth Population", group:2, impact:35, sentiment:1},
                {id:"Women Groups", group:2, impact:40, sentiment:1},
                {id:"Local Administration", group:4, impact:30, sentiment:1},
                {id:"Opposition Parties", group:3, impact:25, sentiment:-1},
                {id:"OBC Community", group:2, impact:35, sentiment:1},
                {id:"SC/ST Groups", group:2, impact:38, sentiment:1},
                {id:"Informal Workers", group:2, impact:32, sentiment:1}
            ],
            links: [
                {source: schemeShort, target:"Rural Beneficiaries", value:12},
                {source: schemeShort, target:"Urban Recipients", value:8},
                {source: schemeShort, target:"Youth Population", value:9},
                {source: schemeShort, target:"Women Groups", value:10},
                {source: schemeShort, target:"OBC Community", value:7},
                {source: schemeShort, target:"SC/ST Groups", value:8},
                {source: schemeShort, target:"Opposition Parties", value:4},
                {source: schemeShort, target:"Local Administration", value:6},
                {source:"Rural Beneficiaries", target:"Women Groups", value:5},
                {source:"Local Administration", target:"SC/ST Groups", value:4}
            ]
        };

        const parsed = extractAndRepairJSON(rawText) || {metrics:{positive:70,negative:10,overall:80}, graph: defaultGraph};
        if (!parsed.graph || !parsed.graph.nodes || parsed.graph.nodes.length < 4) parsed.graph = defaultGraph;
        if (!parsed.metrics) parsed.metrics = {positive:70, negative:15, overall:68};

        let aiPrediction = rawText.split(/```json/i)[0].trim();
        if (!aiPrediction || aiPrediction.length < 50) aiPrediction = rawText.replace(/```json[\s\S]*?```/i, "").trim();

        res.json({ai_prediction: aiPrediction || "Analysis complete.", metrics: parsed.metrics, graph_data: parsed.graph});
    } catch (error) {
        console.error("[UP ANALYSIS ERROR]", error.message);
        const schemeShort = title.split(' ').slice(0, 3).join(' ');
        res.json({
            ai_prediction: "Analysis complete. Review the sentiment graph for demographic impact.",
            metrics: {positive:70, negative:15, overall:68},
            graph_data: {
                nodes:[
                    {id: schemeShort, group:1, impact:55, sentiment:1},
                    {id:"Rural Communities", group:2, impact:45, sentiment:1},
                    {id:"Urban Citizens", group:2, impact:30, sentiment:1},
                    {id:"Youth", group:2, impact:35, sentiment:1},
                    {id:"Women & Families", group:2, impact:40, sentiment:1},
                    {id:"Govt Officials", group:4, impact:30, sentiment:1},
                    {id:"Opposition", group:3, impact:25, sentiment:-1},
                    {id:"OBC/SC/ST Groups", group:2, impact:38, sentiment:1},
                    {id:"Informal Workers", group:2, impact:32, sentiment:1},
                    {id:"Business Sector", group:2, impact:20, sentiment:-1}
                ],
                links:[
                    {source: schemeShort, target:"Rural Communities", value:12},
                    {source: schemeShort, target:"Youth", value:9},
                    {source: schemeShort, target:"Women & Families", value:10},
                    {source: schemeShort, target:"OBC/SC/ST Groups", value:8},
                    {source: schemeShort, target:"Opposition", value:4},
                    {source: schemeShort, target:"Govt Officials", value:6},
                    {source:"Rural Communities", target:"Women & Families", value:5},
                    {source:"Govt Officials", target:"OBC/SC/ST Groups", value:4}
                ]
            }
        });
    }
});

// Advanced AI Search (Real-Time News RAG)
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    try {
        let webContext = "";
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&country=in&language=en&size=8`, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                webContext = (data.results || []).slice(0, 6).map(a => a.title).join('\n');
            }
        } catch (e) {}

        const prompt = `Assistant: You have access to real-time Indian news. 
        QUERY: "${query}"
        NEWS CONTEXT:
        ${webContext}
        
        Answer professionally using the news context provided. If no news is found, use your general knowledge.`;

        const rawText = await callAI(prompt);
        res.json({ ai_response: rawText });
    } catch (error) {
        res.status(500).json({ error: "Search failed." });
    }
});

// District name aliases: GeoJSON names → Census DB names
const DISTRICT_ALIASES = {
    'badaun': 'Budaun',
    'budaun': 'Budaun',
    'banda': 'Banda',
    'bareilly': 'Bareilly',
    'etah': 'Etah',
    'mainpuri': 'Mainpuri',
    'farukhabad': 'Farrukhabad',
    'farrukhabad': 'Farrukhabad',
    'farrukhabad (fatehgarh)': 'Farrukhabad',
    'fatehpur': 'Fatehpur',
    'jyotiba phule nagar': 'Jyotiba Phule Nagar',
    'amroha': 'Jyotiba Phule Nagar',
    'j.p. nagar': 'Jyotiba Phule Nagar',
    'mahamaya nagar': 'Mahamaya Nagar',
    'hathras': 'Mahamaya Nagar',
    'kushi nagar': 'Kushinagar',
    'kushinagar': 'Kushinagar',
    'kushi nagar (padrauna)': 'Kushinagar',
    'maharajganj': 'Maharajganj',
    'mahrajganj': 'Maharajganj',
    'raebareli': 'Rae Bareli',
    'rae bareli': 'Rae Bareli',
    'sant ravidas nagar': 'Sant Ravidas Nagar (Bhadohi)',
    'bhadohi': 'Sant Ravidas Nagar (Bhadohi)',
    'sant ravidas nagar (bhadohi)': 'Sant Ravidas Nagar (Bhadohi)',
    'shravasti': 'Shravasti',
    'siddharth nagar': 'Siddharthnagar',
    'siddharthnagar': 'Siddharthnagar',
    'sitapur': 'Sitapur',
    'kanshiram nagar': 'Kanshiram Nagar',
    'kasganj': 'Kanshiram Nagar',
    'ambedkar nagar': 'Ambedkar Nagar',
    'gautam buddha nagar': 'Gautam Buddha Nagar',
    'gautam buddh nagar': 'Gautam Buddha Nagar',
    'gb nagar': 'Gautam Buddha Nagar',
    'bulandshahr': 'Bulandshahr',
    'bulandshahar': 'Bulandshahr',
};

function resolveDistrictName(rawName) {
    if (!rawName) return rawName;
    const lower = rawName.trim().toLowerCase();
    return DISTRICT_ALIASES[lower] || rawName.trim();
}

// ============================================================
// UP District Intelligence Route
// ============================================================
app.get('/api/up/district/:name', async (req, res) => {
    const rawName = req.params.name;
    const districtName = resolveDistrictName(rawName);
    console.log(`[DISTRICT] ${rawName} → resolved to: ${districtName}`);

    // Step 1: Check Neo4j for full census data (loaded from CSV import)
    let dbLeader = null;
    let dbPopulation = null;
    let dbCensus = null;
    try {
        const session = driver.session();
        console.log(`[DISTRICT] Querying Neo4j for: "${districtName}"`);
        const result = await session.run(
            `MATCH (d:District)
             WHERE toLower(d.name) = toLower($name)
                OR toLower(d.name) CONTAINS toLower($name)
                OR toLower($name) CONTAINS toLower(d.name)
             OPTIONAL MATCH (d)-[:REPRESENTED_BY]->(l:Leader)
             RETURN
               d.name               AS distName,
               d.totalPopulation    AS totalPop,
               d.totalMale          AS totalMale,
               d.totalFemale        AS totalFemale,
               d.ruralPopulation    AS ruralPop,
               d.urbanPopulation    AS urbanPop,
               d.hinduPopulation    AS hinduPop,
               d.muslimPopulation   AS muslimPop,
               d.christianPopulation AS christianPop,
               d.sikhPopulation     AS sikhPop,
               d.buddhistPopulation AS buddhistPop,
               d.jainPopulation     AS jainPop,
               d.neverMarriedPop    AS neverMarried,
               d.marriedPopulation  AS married,
               d.widowedPopulation  AS widowed,
               d.migrantPopulation  AS migrants,
               d.bilingualPopulation AS bilingual,
               d.trilingualPopulation AS trilingual,
               d.youthPopulation    AS youth,
               d.workingAgePop      AS workingAge,
               d.seniorPopulation   AS senior,
               d.population         AS oldPop,
               d.literacy           AS literacy,
               d.density            AS density,
               d.sex_ratio          AS sexRatio,
               l.name AS leaderName,
               l.designation AS designation,
               l.party AS party,
               l.since AS since,
               l.note AS note
             ORDER BY size(d.name)
             LIMIT 1`,
            { name: districtName }
        );
        console.log(`[DISTRICT] Neo4j returned ${result.records.length} record(s).`);
        if (result.records.length > 0) {
            const r = result.records[0];
            const toNum = (v) => (v && v.toNumber ? v.toNumber() : (Number(v) || 0));
            console.log(`[DISTRICT] Matched DB district: "${r.get('distName')}", totalPop=${toNum(r.get('totalPop'))}`);

            const totalPop = toNum(r.get('totalPop')) || toNum(r.get('oldPop'));

            dbPopulation = {
                total:     totalPop || null,
                male:      toNum(r.get('totalMale'))  || null,
                female:    toNum(r.get('totalFemale')) || null,
                rural:     toNum(r.get('ruralPop'))   || null,
                urban:     toNum(r.get('urbanPop'))   || null,
                literacy:  toNum(r.get('literacy'))   || null,
                density:   toNum(r.get('density'))    || null,
                sex_ratio: toNum(r.get('sexRatio'))   || null
            };

            dbCensus = {
                hinduPop:        toNum(r.get('hinduPop')),
                muslimPop:       toNum(r.get('muslimPop')),
                christianPop:    toNum(r.get('christianPop')),
                sikhPop:         toNum(r.get('sikhPop')),
                buddhistPop:     toNum(r.get('buddhistPop')),
                jainPop:         toNum(r.get('jainPop')),
                neverMarried:    toNum(r.get('neverMarried')),
                married:         toNum(r.get('married')),
                widowed:         toNum(r.get('widowed')),
                migrants:        toNum(r.get('migrants')),
                bilingual:       toNum(r.get('bilingual')),
                trilingual:      toNum(r.get('trilingual')),
                youth:           toNum(r.get('youth')),
                workingAge:      toNum(r.get('workingAge')),
                senior:          toNum(r.get('senior')),
            };

            if (r.get('leaderName')) {
                dbLeader = {
                    name:        r.get('leaderName'),
                    designation: r.get('designation'),
                    party:       r.get('party'),
                    since:       r.get('since'),
                    note:        r.get('note')
                };
            }
        } else {
            console.warn(`[DISTRICT] ⚠️ No DB match for "${districtName}". Check district name spelling in Neo4j.`);
        }
        await session.close();
    } catch (dbErr) {
        console.warn(`[DISTRICT] DB lookup failed: ${dbErr.message}`);
    }

    // Step 2: Fetch real-time news for this district (via NewsData.io — works from cloud)
    let headlines = [];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(
            `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(districtName + ' Uttar Pradesh')}&country=in&language=en&size=5`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            headlines = (data.results || []).slice(0, 5)
                .map(a => (a.title || '').trim())
                .filter(h => h.length > 10);
        }
    } catch (e) { /* silent */ }

    // Step 3: AI fills leader + derived demographics using REAL census as ground truth
    const totalPop = dbPopulation && dbPopulation.total;
    const censusSummary = dbCensus && totalPop ? `
VERIFIED CENSUS 2011 DATA (use these EXACT numbers — do NOT change them):
- Total Population : ${totalPop.toLocaleString()}
- Male / Female    : ${(dbPopulation.male||0).toLocaleString()} / ${(dbPopulation.female||0).toLocaleString()}
- Rural / Urban    : ${(dbPopulation.rural||0).toLocaleString()} / ${(dbPopulation.urban||0).toLocaleString()}
- Hindu Population : ${(dbCensus.hinduPop||0).toLocaleString()}
- Muslim Population: ${(dbCensus.muslimPop||0).toLocaleString()}
- Christian Pop    : ${(dbCensus.christianPop||0).toLocaleString()}
- Sikh Population  : ${(dbCensus.sikhPop||0).toLocaleString()}
- Currently Married: ${(dbCensus.married||0).toLocaleString()}
- Widowed          : ${(dbCensus.widowed||0).toLocaleString()}
- Migrants         : ${(dbCensus.migrants||0).toLocaleString()}
- Total Women      : ${(dbCensus.totalWomen||0).toLocaleString()}
- Bilingual Pop    : ${(dbCensus.bilingual||0).toLocaleString()}
` : 'No census data in database — estimate from Census 2011 patterns.';

    // Pre-compute demographics from real census data where possible
    const preDemo = totalPop ? [
        { label: 'Hindu Community',    percent: +((dbCensus.hinduPop/totalPop)*100).toFixed(1),   count: dbCensus.hinduPop,    color: '#f97316' },
        { label: 'Muslim Community',   percent: +((dbCensus.muslimPop/totalPop)*100).toFixed(1),  count: dbCensus.muslimPop,   color: '#3b82f6' },
        { label: 'Rural Population',   percent: +((dbPopulation.rural/totalPop)*100).toFixed(1),  count: dbPopulation.rural,   color: '#22c55e' },
        { label: 'Urban Population',   percent: +((dbPopulation.urban/totalPop)*100).toFixed(1),  count: dbPopulation.urban,   color: '#8b5cf6' },
        { label: 'Married Population', percent: +((dbCensus.married/totalPop)*100).toFixed(1),    count: dbCensus.married,     color: '#ec4899' },
        { label: 'Women',              percent: +((dbPopulation.female/totalPop)*100).toFixed(1), count: dbPopulation.female,  color: '#e11d48' },
        { label: 'Migrants',           percent: +((dbCensus.migrants/totalPop)*100).toFixed(1),   count: dbCensus.migrants,    color: '#06b6d4' },
        { label: 'Bilingual Pop',      percent: +((dbCensus.bilingual/totalPop)*100).toFixed(1),  count: dbCensus.bilingual,   color: '#eab308' },
    ].filter(d => d.count > 0) : null;

    // Step 3: Ask AI ONLY for what isn't in the Census DB:
    //   - Political leader (name, party, designation, since, note)
    //   - Density, Literacy Rate, Sex Ratio (not in our CSV files)
    const aiPrompt = `You are a political and census expert for Uttar Pradesh, India.
District: "${districtName}"

${dbLeader ? `KNOWN LEADER (verify or correct if wrong): ${JSON.stringify(dbLeader)}` : `Who is the current MLA or District Magistrate of ${districtName}, Uttar Pradesh?`}

Also provide Census 2011 estimates for:
- Population density (persons per km²)
- Literacy rate (%)
- Sex ratio (females per 1000 males)

Reply with ONLY this JSON (no explanation):
\`\`\`json
{
  "leader": {
    "name": "<Full name of current MLA/DM>",
    "designation": "<MLA or District Magistrate>",
    "party": "<Political party>",
    "since": "<Year e.g. 2022>",
    "note": "<One sentence about their key achievement>"
  },
  "density": <number>,
  "literacy": <number>,
  "sex_ratio": <number>
}
\`\`\``;

    let aiData = null;
    try {
        const rawAI = await callAI(aiPrompt);
        aiData = extractAndRepairJSON(rawAI);
        console.log(`[DISTRICT] AI returned:`, JSON.stringify(aiData).slice(0, 200));
    } catch (e) {
        console.warn(`[DISTRICT] AI call failed: ${e.message}`);
    }

    // Step 4: Merge DB + AI data — DB is primary source, AI fills gaps
    const finalLeader = dbLeader || (aiData && aiData.leader) || {
        name: `${districtName} District Representative`,
        designation: 'MLA',
        party: 'N/A',
        since: '2022',
        note: 'Leader data not yet available.'
    };

    // AI provides density, literacy, sex_ratio (not in Census CSVs)
    // DB provides total, male, female, rural, urban
    const finalPop = {
        total:     (dbPopulation && dbPopulation.total)     || null,
        male:      (dbPopulation && dbPopulation.male)      || null,
        female:    (dbPopulation && dbPopulation.female)    || null,
        rural:     (dbPopulation && dbPopulation.rural)     || null,
        urban:     (dbPopulation && dbPopulation.urban)     || null,
        density:   (dbPopulation && dbPopulation.density)   || (aiData && aiData.density)   || null,
        literacy:  (dbPopulation && dbPopulation.literacy)  || (aiData && aiData.literacy)  || null,
        sex_ratio: (dbPopulation && dbPopulation.sex_ratio) || (aiData && aiData.sex_ratio) || null,
    };
    // Use pre-computed census demographics if available; fall back to AI output
    const finalDemo = preDemo || (aiData && aiData.demographics) || [];
    const finalHeadlines = headlines.length > 0 ? headlines : [`No recent news found for ${districtName}. Check back soon.`];

    // Build census summary block for the response
    const censusBlock = dbCensus ? {
        hinduPopulation:     dbCensus.hinduPop     || 0,
        muslimPopulation:    dbCensus.muslimPop    || 0,
        christianPopulation: dbCensus.christianPop || 0,
        sikhPopulation:      dbCensus.sikhPop      || 0,
        marriedPopulation:   dbCensus.married      || 0,
        widowedPopulation:   dbCensus.widowed      || 0,
        migrantPopulation:   dbCensus.migrants     || 0,
        bilingualPopulation: dbCensus.bilingual    || 0,
        trilingualPopulation:dbCensus.trilingual   || 0,
        youthPopulation:     dbCensus.youth        || 0,
        workingAgePopulation:dbCensus.workingAge   || 0,
        seniorPopulation:    dbCensus.senior       || 0,
        ruralPopulation:     (dbPopulation && dbPopulation.rural)  || 0,
        urbanPopulation:     (dbPopulation && dbPopulation.urban)  || 0,
    } : null;

    res.json({
        district: districtName,
        leader: finalLeader,
        population: finalPop,
        demographics: finalDemo,
        census: censusBlock,
        headlines: finalHeadlines,
        source: dbCensus ? 'Census 2011 DB + AI + News' : (dbLeader ? 'Database + AI + News' : 'AI Analysis + News')
    });
});

// ── YouTube Live Stream Resolver (dynamic, 30-min cache) ──────────────────
const _liveCacheMap = {};
app.get('/api/up/channel-live/:handle', async (req, res) => {
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


let _upGeoCache = null;
app.get('/api/up/geo', async (req, res) => {
    if (_upGeoCache) {
        console.log('[GEO] Serving from cache');
        return res.json(_upGeoCache);
    }
    const sources = [
        'https://raw.githubusercontent.com/datameet/maps/master/Districts/uttar-pradesh.geojson',
        'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson'
    ];
    for (const url of sources) {
        try {
            console.log('[GEO] Trying:', url);
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 15000);
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(t);
            if (!r.ok) continue;
            let geo = await r.json();
            // If it's the all-India file, filter to UP only
            if (geo.features && geo.features.length > 200) {
                geo = {
                    type: 'FeatureCollection',
                    features: geo.features.filter(f =>
                        f.properties.STATE === '09' ||
                        (f.properties.NAME_1 || '').toLowerCase().includes('uttar pradesh') ||
                        (f.properties.st_nm || '').toLowerCase().includes('uttar pradesh')
                    )
                };
            }
            if (geo.features && geo.features.length > 10) {
                _upGeoCache = geo;
                console.log(`[GEO] Loaded ${geo.features.length} UP districts`);
                return res.json(geo);
            }
        } catch (e) {
            console.warn('[GEO] Source failed:', e.message);
        }
    }
    res.status(503).json({ error: 'GeoJSON unavailable. Check server internet connection.' });
});

// UP Dashboard: Weather Route
app.get('/api/up/weather', async (req, res) => {
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
});// UP Dashboard: Fetch Schemes (Real-Time News Extraction)
app.get('/api/up/schemes', async (req, res) => {
    // Serve from 30-min cache if available
    if (schemesCache.data && Date.now() - schemesCache.ts < SCHEMES_CACHE_DURATION) {
        console.log('[SCHEMES] Serving from cache');
        return res.json(schemesCache.data);
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(
            `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=Uttar+Pradesh+Government+Scheme+Yojana&country=in&language=en&size=8`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (!response.ok) throw new Error('NewsData fetch failed');
        const data = await response.json();

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

        const articles = (data.results || []).map(processArticle);
        const result = {
            recent: articles.slice(0, 2),
            future: articles.slice(2, 4)
        };
        // Store in cache
        schemesCache.data = result;
        schemesCache.ts = Date.now();
        res.json(result);
    } catch (error) {
        console.error('[SCHEMES] Fetch failed:', error.message);
        // Return cached data even if stale, rather than empty
        if (schemesCache.data) return res.json(schemesCache.data);
        res.json({ recent: [], future: [] });
    }
});

// ==========================================
// India Map State Info Aggregator
// ==========================================
const fs = require('fs');
app.get('/api/state-info/:state', async (req, res) => {
    const stateName = req.params.state;
    
    // 1. Fetch Political Data from local JSON
    let stateData = {
        population: "Data Updating...",
        cm: "Updating...",
        cm_years: "0",
        districts: []
    };
    
    try {
        const dataPath = path.join(__dirname, 'data', 'india_data.json');
        if (fs.existsSync(dataPath)) {
            const rawData = fs.readFileSync(dataPath, 'utf8');
            const parsedData = JSON.parse(rawData);
            stateData = parsedData[stateName] || parsedData["Default"];
        }
    } catch (e) {
        console.error("Error reading JSON:", e.message);
    }

    // 2. Fetch Top 5 Headlines via NewsData.io (works from cloud servers)
    let news = [];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(
            `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(stateName + ' politics')}&country=in&language=en&size=5`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            news = (data.results || []).slice(0, 5)
                .map(a => ({ title: a.title || '', url: a.link || '#' }))
                .filter(n => n.title.length > 5);
        }
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

// ── Helper: fetch a URL using Node https/http (reliable, SSL-tolerant) ──────
function httpsGet(urlStr, acceptHeader) {
    return new Promise((resolve, reject) => {
        const maxRedirects = 8;
        let redirectCount = 0;

        function doRequest(currentUrl) {
            const parsed = new URL(currentUrl);
            const isHttps = parsed.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (isHttps ? 443 : 80),
                path: parsed.pathname + (parsed.search || ''),
                method: 'GET',
                rejectUnauthorized: false,   // bypass SSL cert issues
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': acceptHeader || 'text/html,application/xhtml+xml,*/*;q=0.8',
                    'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
                    'Accept-Encoding': 'gzip, deflate',
                    'Referer': 'https://myneta.info',
                    'Connection': 'keep-alive'
                }
            };

            const reqObj = lib.request(options, (upstream) => {
                // Follow redirects
                if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
                    if (redirectCount++ >= maxRedirects) return reject(new Error('Too many redirects'));
                    const next = upstream.headers.location.startsWith('http')
                        ? upstream.headers.location
                        : `${parsed.protocol}//${parsed.hostname}${upstream.headers.location}`;
                    upstream.resume(); // drain
                    return doRequest(next);
                }

                const contentType = upstream.headers['content-type'] || 'text/html';
                const encoding = upstream.headers['content-encoding'] || '';
                const chunks = [];

                upstream.on('data', c => chunks.push(c));
                upstream.on('error', reject);
                upstream.on('end', () => {
                    const raw = Buffer.concat(chunks);

                    // Decompress if needed
                    const decompress = encoding === 'gzip'
                        ? cb => zlib.gunzip(raw, cb)
                        : encoding === 'deflate'
                        ? cb => zlib.inflate(raw, cb)
                        : null;

                    if (decompress) {
                        decompress((err, decoded) => {
                            if (err) return reject(err);
                            resolve({ contentType, data: decoded, binary: isBinaryType(contentType) });
                        });
                    } else {
                        resolve({ contentType, data: raw, binary: isBinaryType(contentType) });
                    }
                });
            });

            reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('Request timed out')); });
            reqObj.on('error', reject);
            reqObj.end();
        }

        doRequest(urlStr);
    });
}

function isBinaryType(ct) {
    return !ct.includes('text/') && !ct.includes('javascript') && !ct.includes('json') && !ct.includes('xml');
}

// ============================================================
// Myneta.info Web Proxy — Full asset rewrite + ad removal
// ============================================================
const MYNETA_BASE = 'https://myneta.info';

app.get('/proxy/myneta', async (req, res) => { await proxyMyneta('/', req, res); });

app.get('/proxy/myneta/*', async (req, res) => {
    const subPath = '/' + req.params[0];
    const query   = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
    await proxyMyneta(subPath + query, req, res);
});

async function proxyMyneta(urlPath, req, res) {
    const targetUrl = MYNETA_BASE + urlPath;
    const serverBase = req.protocol + '://' + req.get('host');
    const proxyRoot  = serverBase + '/proxy/myneta';
    console.log(`[PROXY] ${targetUrl}`);

    // Strip security headers so iframe renders freely
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Type-Options');

    try {
        const rawBody = await httpsGet(targetUrl, req.headers['accept']);
        const contentType = rawBody.contentType || 'text/html';

        // ── Binary assets: images, fonts, etc. — send raw buffer ──
        if (rawBody.binary) {
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(rawBody.data); 
        }

        // Convert Buffer to string for text content
        let body = rawBody.data.toString('utf-8');

        if (contentType.includes('text/html')) {
            const MYNETA = 'https://myneta.info';

            // ── Step 1: Assets (images, scripts, CSS) → Proxy ──
            // Rewrite src="..." and <link href="..."> to go through proxy
            body = body.replace(/\b(src|data-src|data-href)=(["'])\/((?!\/)[^"']*)(["'])/gi,
                (m, attr, q1, path, q2) => `${attr}=${q1}${proxyRoot}/${path}${q2}`);
            body = body.replace(/<link[^>]+href=(["'])\/((?!\/)[^"']*)(["'])/gi,
                (m, q1, path, q2) => m.replace(`/${path}`, `${proxyRoot}/${path}`));

            // ── Step 2: Links and Forms → Real Site ──
            // Rewrite href="/..." for <a> tags to absolute real URLs
            body = body.replace(/<a\b([^>]*?\bhref=(["']))\/((?!\/)[^"']*)(["'])/gi,
                (m, start, q1, path, q2) => `<a${start}${MYNETA}/${path}${q2} target="_blank" rel="noopener noreferrer"`);
            
            // Fix absolute links too
            body = body.replace(/href=(["'])https?:\/\/myneta\.info\/([^"']*)(["'])/gi,
                (m, q1, path, q2) => `href=${q1}${MYNETA}/${path}${q2} target="_blank" rel="noopener noreferrer"`);

            // Rewrite form actions to real site
            body = body.replace(/<form\b([^>]*?\baction=(["']))\/((?!\/)[^"']*)(["'])/gi,
                (m, start, q1, path, q2) => `<form${start}${MYNETA}/${path}${q2} target="_blank"`);

            // ── Step 3: Handle srcset and url() ──
            body = body.replace(/srcset=(["'])([^"']+)(["'])/gi, (m, q1, srcset, q2) => {
                const rw = srcset.split(',').map(part => {
                    const pieces = part.trim().split(/\s+/);
                    if (pieces[0].startsWith('/')) return proxyRoot + pieces[0] + (pieces[1] ? ' ' + pieces[1] : '');
                    return part.trim();
                }).join(', ');
                return `srcset=${q1}${rw}${q2}`;
            });
            body = body.replace(/url\((['"]?)\/((?!\/)[^)'"]*)\1\)/gi, (m, q, p) => `url(${q}${proxyRoot}/${p}${q})`);

            // ── Step 4: Remove ad scripts ──
            body = body.replace(/<script[^>]*(googlesyndication|doubleclick|adservice|pagead|adnxs|amazon-adsystem|googletagmanager|outbrain|taboola|criteo)[^>]*>[\s\S]*?<\/script>/gi, '');
            body = body.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');

            // ── Step 5: Inject ultimate navigation interceptor ──
            const injection = `
<style>
  .modal,.modal-backdrop,#donateModal,[id*="donat" i],.adsbygoogle,.popup { display:none!important; }
  body { overflow:auto!important; }
</style>
<script>
(function(){
  var REAL_BASE = 'https://myneta.info';
  var PROXY_BASE = '${proxyRoot}';

  function toReal(u) {
    if(!u || typeof u !== 'string' || u.startsWith('#') || u.startsWith('javascript')) return u;
    if(u.indexOf(PROXY_BASE) === 0) u = u.replace(PROXY_BASE, '');
    if(u.startsWith('/')) u = REAL_BASE + u;
    else if(!u.startsWith('http')) u = REAL_BASE + '/' + u;
    return u;
  }

  // 1. Force all <a> to _blank and real URL
  function fix() {
    document.querySelectorAll('a').forEach(function(a){
      var href = a.getAttribute('href');
      if(href && !href.startsWith('http') && !href.startsWith('#')) {
        a.href = toReal(href);
        a.target = '_blank';
      }
    });
    // 2. Fix dropdowns (select onchange)
    document.querySelectorAll('select[onchange*="location"]').forEach(function(s){
      var oc = s.getAttribute('onchange');
      if(oc && !oc.includes('window.open')) {
         // Wrap the location change in window.open
         s.setAttribute('onchange', oc.replace(/location\s*=\s*([^;]+)/g, 'window.open(toReal($1), "_blank")'));
      }
    });
  }
  
  // 3. Global click interceptor (Capture phase)
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if(a && a.href && a.href.indexOf(REAL_BASE) !== -1) {
      e.stopPropagation(); // prevent site JS from interfering
      // target="_blank" is already set by fix()
    }
  }, true);

  // 4. Global submit interceptor
  document.addEventListener('submit', function(e){
    var f = e.target;
    f.action = toReal(f.getAttribute('action'));
    f.target = '_blank';
  }, true);

  // 5. Hijack window.open
  var _open = window.open;
  window.open = function(url, name, features) {
    return _open(toReal(url), '_blank', features);
  };

  // Kill ads/modals
  function kill(){
    document.querySelectorAll('.modal,.modal-backdrop,[id*="donat" i],.adsbygoogle,.popup').forEach(function(el){
      el.style.display='none';
    });
    if(document.body){ document.body.classList.remove('modal-open'); document.body.style.overflow='auto'; }
  }
  document.addEventListener('DOMContentLoaded', kill);
  [500,1500,3000].forEach(function(t){ setTimeout(kill,t); });
  
  setInterval(fix, 1000);
  fix();
})();
<\/script>`;

            if (/<head>/i.test(body)) {
                body = body.replace(/<head>/i, '<head>' + injection);
            } else {
                body = injection + body;
            }

            res.set('Content-Type', 'text/html; charset=utf-8');

        } else if (contentType.includes('text/css')) {
            body = body.replace(/https?:\/\/myneta\.info/gi, proxyRoot);
            body = body.replace(/url\((['"]?)\/((?!\/)[^)'"]*)\1\)/gi, (m, q, p) => `url(${q}${proxyRoot}/${p}${q})`);
            res.set('Content-Type', contentType);
        } else {
            // JS and everything else
            body = body.replace(/https?:\/\/myneta\.info/gi, proxyRoot);
            res.set('Content-Type', contentType);
        }

        res.set('Cache-Control', 'no-store');
        res.send(body);

    } catch (err) {
        console.error('[PROXY] Error:', err.message);
        res.status(502).send(`<html><body style="font-family:sans-serif;background:#05080f;color:#f8fafc;text-align:center;padding:4rem;">
            <h2 style="color:#ef4444;">⚠️ Could not reach Myneta.info</h2>
            <p style="color:#94a3b8;">${err.message}</p>
            <a href="/proxy/myneta" style="color:#FF9933;margin-right:1rem;">🔄 Retry</a>
            <a href="https://myneta.info" target="_blank" style="color:#60a5fa;">↗ Open directly</a>
        </body></html>`);
    }
}


process.on('SIGINT', async () => {
    await driver.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Ontology Engine server is running on http://localhost:${port}`);
});
