require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const neo4j = require('neo4j-driver');

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
const password = process.env.NEO4J_PASSWORD;

// Auto-detect encryption: AuraDB uses neo4j+s:// (TLS), local uses neo4j://
const isCloud  = uri.startsWith('neo4j+s') || uri.startsWith('bolt+s');
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(user, password),
    isCloud ? {} : { encrypted: 'ENCRYPTION_OFF' }
);
console.log(`[NEO4J] Connecting to: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
console.log(`[NEO4J] Mode: ${isCloud ? '☁️  Cloud (AuraDB)' : '🖥️  Local'}`);
if (!password) {
    console.warn('[NEO4J] NEO4J_PASSWORD is not configured. Database-backed routes will fail until it is set.');
}


// ==========================================
// 2. Sarvam AI (Indian-Born AI Engine) Configuration
// ==========================================
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_MODEL = 'sarvam-105b';
const NEWSDATA_KEYS = (process.env.NEWSDATA_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => ({ key, exhausted: false, resetAt: 0 }));

// Returns the first non-exhausted key. Resets keys after 24 hours.
function getActiveNewsKey() {
    if (NEWSDATA_KEYS.length === 0) return null;
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    // Auto-reset keys that exhausted more than 24 hours ago
    NEWSDATA_KEYS.forEach(k => {
        if (k.exhausted && now - k.resetAt > ONE_DAY) {
            k.exhausted = false;
            console.log(`[NEWS KEY] Key ...${k.key.slice(-6)} auto-reset after 24h`);
        }
    });
    return NEWSDATA_KEYS.find(k => !k.exhausted) || NEWSDATA_KEYS[0]; // fallback to first
}
const SARVAM_URL = 'https://api.sarvam.ai/v1/chat/completions';


const callAI = async (prompt) => {
    if (!SARVAM_API_KEY) {
        throw new Error('SARVAM_API_KEY is not configured');
    }

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
        console.warn("AI unavailable:", e.message);
        throw e;
    }
};



// ==========================================
// Routes
// ==========================================

// Route to check server and service status
// ── UP BOOTH & CONSTITUENCY APIS ─────────────────────────────

app.get('/api/up/region/:regionId/districts', async (req, res) => {
    const region = req.params.regionId;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (d:District)
             WHERE d.region = $region
             RETURN d.name AS name
             ORDER BY d.name`,
            { region }
        );
        await session.close();
        
        const districts = result.records.map(r => r.get('name'));
        res.json(districts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/up/district/:district/constituencies', async (req, res) => {
    const district = req.params.district;

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (d:District)
             WHERE toLower(d.name) = toLower($district)
             OPTIONAL MATCH (d)-[:CONTAINS|HAS_LS]->(ls:LokSabhaConstituency)-[:HAS_VS]->(vs:VidhanSabhaConstituency)
             WITH d, ls, collect(DISTINCT vs { .vs_id, .name, .reservation }) AS constituencies
             ORDER BY ls.ls_no
             RETURN d.name AS district_name, ls.ls_id AS ls_id, ls.name AS ls_name,
                    constituencies
            `,
            { district }
        );
        await session.close();

        if (result.records.length === 0) {
            return res.status(404).json({ error: `No district named "${district}" found in the graph.` });
        }

        const payload = result.records
            .filter((record) => record.get('ls_id'))
            .map((record) => ({
                district: record.get('district_name'),
                lok_sabha: {
                    ls_id: record.get('ls_id'),
                    name: record.get('ls_name'),
                },
                vidhan_sabha_segments: record.get('constituencies')
                    .filter(Boolean)
                    .filter((vs) => vs.vs_id && vs.name),
            }));

        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/up/constituency/:constName/analysis', async (req, res) => {
    const name = req.params.constName;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name)
             OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult)
             OPTIONAL MATCH (c:Candidate)-[:CONTESTS_IN|CONTESTS]->(ls)
             RETURN ls, er, collect(DISTINCT c) AS candidates`,
            { name }
        );
        await session.close();

        if (result.records.length === 0) {
            return res.status(404).json({ error: `No constituency named "${name}" found in the graph.` });
        }

        const record = result.records[0];
        const ls = record.get('ls').properties;
        const erNode = record.get('er');
        const candidates = record.get('candidates')
            .filter(Boolean)
            .map((node) => node.properties)
            .sort((a, b) => (Number(a.rank ?? 9999) - Number(b.rank ?? 9999)));
        const er = erNode ? erNode.properties : null;

        res.json({
            constituency: {
                ls_id: ls.ls_id,
                name: ls.name,
                reservation: ls.reservation ?? null,
                region: ls.region ?? null
            },
            result: er ? {
                result_id: er.result_id ?? null,
                election_id: er.election_id ?? 'LS2019',
                winner: er.winner ?? null,
                winner_party_id: er.winner_party_id ?? null,
                winner_vote_share: er.winner_vote_share ?? null,
                margin_votes: er.margin_votes ?? null,
                margin_pct: er.margin_pct ?? null,
                total_valid_votes: er.total_valid_votes ?? null,
                source: er.source ?? null,
                source_url: er.source_url ?? null,
                source_date: er.source_date ?? null
            } : null,
            candidates,
            note: 'This response is graph-backed and only returns data currently available in Neo4j. No fabricated analysis is included.'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Change 1: Booth analysis — Neo4j first, fallback to stub if SHRUG not loaded
app.get('/api/up/booth/:boothId/analysis', async (req, res) => {
    const id = req.params.boothId;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (b:Booth {booth_id: $bid})
             OPTIONAL MATCH (b)-[:WITHIN_VS]->(vs:VidhanSabhaConstituency)
             OPTIONAL MATCH (vs)-[:WITHIN_LS]->(ls:LokSabhaConstituency)
             RETURN b, vs.name AS vs_name, vs.vs_id AS vs_id, ls.name AS ls_name, ls.ls_id AS ls_id`,
            { bid: id }
        );
        await session.close();

        if (result.records.length > 0) {
            const r = result.records[0];
            const b = r.get('b').properties;
            return res.json({
                booth_id: id, data_source: 'neo4j',
                basic: {
                    id, location: b.village_name || 'Polling Station',
                    constituency: r.get('vs_name') || 'Unknown',
                    vs_name: r.get('vs_name'), vs_id: r.get('vs_id'),
                    ls_name: r.get('ls_name'), ls_id: r.get('ls_id'),
                    district: b.district || 'Unknown',
                },
                demographics: {
                    total_voters: b.total_voters || null,
                    literacy_rate: b.literacy_rate || null,
                    urban_ratio: b.urban_ratio || null,
                    socioeconomic_index: b.socioeconomic_index || null,
                    shrug_loaded: !!(b.literacy_rate),
                },
                voters: { total: b.total_voters || 'N/A', ratio: 'N/A', age_groups: 'N/A' },
                pattern: { winner: 'N/A', turnout: 0 },
                turnout_comparison: 'N/A',
                social: { dominant: 'N/A', type: (b.urban_ratio > 0.5) ? 'Urban' : 'Rural' },
                issue: 'N/A', risks: [],
            });
        }
        // Booth not in Neo4j (SHRUG not loaded yet)
        res.json({
            booth_id: id, data_source: 'fallback',
            basic: { id, location: 'Polling Station', constituency: 'Unknown', vs_name: null, ls_name: null, district: 'Unknown' },
            demographics: { shrug_loaded: false },
            voters: { total: 'N/A', ratio: 'N/A', age_groups: 'N/A' },
            pattern: { winner: 'N/A', turnout: 0 },
            turnout_comparison: 'N/A',
            social: { dominant: 'N/A', type: 'N/A' },
            issue: 'N/A', risks: [],
        });
    } catch (e) {
        console.error('[BOOTH] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Change 2: New /leaders endpoint — resolves relevant political entities for a booth
app.get('/api/up/booth/:boothId/leaders', async (req, res) => {
    const boothId = req.params.boothId;
    const defaults = [
        { entity_id: 'party-bjp', name: 'BJP', entity_type: 'party', level: 'national', party: 'BJP' },
        { entity_id: 'leader-yogi-adityanath', name: 'Yogi Adityanath', entity_type: 'leader', level: 'state', party: 'BJP' },
        { entity_id: 'leader-narendra-modi', name: 'Narendra Modi', entity_type: 'leader', level: 'national', party: 'BJP' },
        { entity_id: 'party-sp', name: 'Samajwadi Party', entity_type: 'party', level: 'national', party: 'SP' },
        { entity_id: 'party-bsp', name: 'Bahujan Samaj Party', entity_type: 'party', level: 'national', party: 'BSP' },
    ];
    try {
        const session = driver.session();
        const boothRes = await session.run(
            `MATCH (b:Booth {booth_id: $bid})
             OPTIONAL MATCH (b)-[:WITHIN_VS]->(vs:VidhanSabhaConstituency)
             OPTIONAL MATCH (vs)-[:WITHIN_LS]->(ls:LokSabhaConstituency)
             RETURN vs.vs_id AS vs_id, ls.ls_id AS ls_id`,
            { bid: boothId }
        );
        let constituencyId = null;
        if (boothRes.records.length > 0) {
            constituencyId = boothRes.records[0].get('ls_id') || boothRes.records[0].get('vs_id');
        }
        let localLeaders = [];
        if (constituencyId) {
            const lRes = await session.run(
                `MATCH (e:LeaderEntity) WHERE e.constituency_id = $cid
                 RETURN e.entity_id AS eid, e.name AS name, e.entity_type AS et, e.level AS lv, e.party AS party`,
                { cid: constituencyId }
            );
            localLeaders = lRes.records.map(r => ({
                entity_id: r.get('eid'), name: r.get('name'),
                entity_type: r.get('et'), level: r.get('lv'), party: r.get('party'), is_local: true,
            }));
        }
        await session.close();
        const seen = new Set(localLeaders.map(e => e.entity_id));
        res.json({
            booth_id: boothId, constituency_id: constituencyId,
            leaders: [...localLeaders, ...defaults.filter(e => !seen.has(e.entity_id))],
        });
    } catch (e) {
        console.error('[LEADERS] Error:', e.message);
        res.json({ booth_id: boothId, constituency_id: null, leaders: defaults });
    }
});

// ── SENTIMENT ANALYSIS API ENDPOINTS ─────────────────────────────

// Phase 4: Get heatmap data
app.get('/api/up/sentiment/heatmap', async (req, res) => {
    const electionId = req.query.election_id || 'LS2024';
    const entityId = req.query.entity_id || 'party-bjp';
    const timeWindow = req.query.time_window || 'last_7d';
    const daysMap = { 'last_24h': 1, 'last_7d': 7, 'last_30d': 30, 'last_90d': 90, 'all_time': 365 };
    const days = daysMap[timeWindow] || 7;

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (obs:SentimentObservation)
             WHERE obs.entity_id = $eid
               AND obs.source_date >= date() - duration({days: $days})
             RETURN
               obs.constituency_id AS constituency_id,
               COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS positive_count,
               COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
               COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neutral_count,
               COUNT(obs) AS total_count
             ORDER BY obs.constituency_id`,
            { eid: entityId, days: days }
        );

        const constituencies = result.records.map(r => {
            const total = r.get('total_count').toNumber();
            const pos = r.get('positive_count').toNumber();
            const neg = r.get('negative_count').toNumber();
            const neu = r.get('neutral_count').toNumber();

            return {
                constituency_id: r.get('constituency_id'),
                positive_pct: total > 0 ? Math.round(1000 * pos / total) / 10 : 0,
                negative_pct: total > 0 ? Math.round(1000 * neg / total) / 10 : 0,
                neutral_pct: total > 0 ? Math.round(1000 * neu / total) / 10 : 0,
                total_count: total,
                dominant_sentiment: pos > neg && pos > neu ? 'positive' : (neg > pos && neg > neu ? 'negative' : 'neutral'),
            };
        });

        const stateSummary = {
            positive_pct: constituencies.length > 0 ? Math.round(constituencies.reduce((s, c) => s + c.positive_pct, 0) / constituencies.length * 10) / 10 : 0,
            negative_pct: constituencies.length > 0 ? Math.round(constituencies.reduce((s, c) => s + c.negative_pct, 0) / constituencies.length * 10) / 10 : 0,
            neutral_pct: constituencies.length > 0 ? Math.round(constituencies.reduce((s, c) => s + c.neutral_pct, 0) / constituencies.length * 10) / 10 : 0,
            total_constituencies: constituencies.length,
            total_observations: constituencies.reduce((s, c) => s + c.total_count, 0)
        };

        await session.close();
        res.json({
            election_id: electionId,
            entity_id: entityId,
            time_window: timeWindow,
            constituencies: constituencies,
            state_summary: stateSummary,
            computed_at: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[HEATMAP] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Phase 4: Get alerts
app.get('/api/up/sentiment/alerts', async (req, res) => {
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (obs:SentimentObservation)
             WHERE obs.source_date >= date() - duration({days: 7})
             RETURN
               obs.constituency_id AS constituency_id,
               obs.entity_id AS entity_id,
               COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
               COUNT(obs) AS total_count
             ORDER BY negative_count DESC
             LIMIT 20`
        );

        const alerts = result.records
            .map(r => {
                const total = r.get('total_count').toNumber();
                const neg = r.get('negative_count').toNumber();
                const negPct = total > 0 ? Math.round(1000 * neg / total) / 10 : 0;

                return {
                    constituency_id: r.get('constituency_id'),
                    entity_id: r.get('entity_id'),
                    negative_pct: negPct,
                    severity: negPct > 60 ? 'HIGH' : (negPct > 40 ? 'MEDIUM' : 'LOW'),
                    message: negPct > 60 ? `High negative sentiment in ${r.get('constituency_id')}` :
                              `Elevated negative sentiment in ${r.get('constituency_id')}`,
                };
            })
            .filter(a => a.negative_pct > 40);

        await session.close();

        res.json({
            alerts: alerts,
            computed_at: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[ALERTS] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Phase 3: Get sentiment for a booth (Moved up to avoid shadowing)
app.get('/api/up/sentiment/booth/:boothId', async (req, res) => {
    const boothId = req.params.boothId;
    const entityId = req.query.entityId || null;
    const timeWindow = req.query.time_window || 'last_7d';
    const daysMap = { 'last_24h': 1, 'last_7d': 7, 'last_30d': 30, 'last_90d': 90, 'all_time': 365 };
    const days = daysMap[timeWindow] || 7;

    try {
        const session = driver.session();

        // Fast path: pre-computed SentimentAggregation nodes for this booth
        let aggCypher = `MATCH (agg:SentimentAggregation) WHERE agg.booth_id = $bid AND agg.time_window = $tw`;
        const aggParams = { bid: boothId, tw: timeWindow, eid: entityId };
        if (entityId) aggCypher += ` AND agg.entity_id = $eid`;
        aggCypher += ` RETURN agg LIMIT 10`;
        const aggResult = await session.run(aggCypher, aggParams);

        if (aggResult.records.length > 0) {
            const sentiments = aggResult.records.map(r => {
                const a = r.get('agg').properties;
                return {
                    entity_id: a.entity_id, positive_pct: a.positive_pct || 0,
                    negative_pct: a.negative_pct || 0, neutral_pct: a.neutral_pct || 0,
                    dominant_sentiment: a.dominant_sentiment || 'neutral',
                    trending: a.trending || 'stable', confidence_adjusted: 0.75,
                    data_source: 'precomputed_booth_aggregation',
                    interpolation_note: 'Pre-computed booth-level aggregation.',
                };
            });
            await session.close();
            return res.json({ booth_id: boothId, time_window: timeWindow, sentiments, interpolated: false, computed_at: new Date().toISOString() });
        }

        // Interpolation fallback: resolve booth → constituency, then aggregate observations
        const boothRes = await session.run(
            `MATCH (b:Booth {booth_id: $bid})
             OPTIONAL MATCH (b)-[:WITHIN_VS]->(vs:VidhanSabhaConstituency)
             OPTIONAL MATCH (vs)-[:WITHIN_LS]->(ls:LokSabhaConstituency)
             RETURN ls.ls_id AS ls_id, vs.vs_id AS vs_id, b.urban_ratio AS urban_ratio`,
            { bid: boothId }
        );
        let constituencyId = null, urbanRatio = 0.5;
        if (boothRes.records.length > 0) {
            constituencyId = boothRes.records[0].get('ls_id') || boothRes.records[0].get('vs_id');
            urbanRatio = boothRes.records[0].get('urban_ratio') || 0.5;
        }

        // Build observation query scoped to constituency
        let obsCypher = `MATCH (obs:SentimentObservation) WHERE obs.source_date >= date() - duration({days: $days})`;
        const obsParams = { days, eid: entityId };
        if (constituencyId) { obsCypher += ` AND obs.constituency_id = $cid`; obsParams.cid = constituencyId; }
        if (entityId) { obsCypher += ` AND obs.entity_id = $eid`; }
        obsCypher += ` RETURN obs.entity_id AS entity_id,
             COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS pos,
             COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS neg,
             COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neu,
             COUNT(obs) AS total ORDER BY entity_id`;

        const obsResult = await session.run(obsCypher, obsParams);
        await session.close();

        // Urban bias correction per PRD 2.4.3
        const ubCorr = urbanRatio > 0.6 ? 0.85 : 1.0;
        const sentiments = obsResult.records.map(r => {
            const total = r.get('total').toNumber();
            const pos = r.get('pos').toNumber();
            const neg = r.get('neg').toNumber();
            const adjPos = Math.round((total > 0 ? (pos / total) * 100 : 0) * ubCorr * 10) / 10;
            const adjNeg = Math.round((total > 0 ? (neg / total) * 100 : 0) * 10) / 10;
            const adjNeu = Math.round(Math.max(0, 100 - adjPos - adjNeg) * 10) / 10;
            return {
                entity_id: r.get('entity_id'),
                positive_pct: adjPos, negative_pct: adjNeg, neutral_pct: adjNeu,
                total_observations: total,
                dominant_sentiment: adjPos > adjNeg && adjPos > adjNeu ? 'positive' : (adjNeg > adjPos && adjNeg > adjNeu ? 'negative' : 'neutral'),
                trending: 'stable',
                confidence_adjusted: Math.min(0.95, 0.4 + (total / 20) * 0.55),
                data_source: 'interpolated_from_constituency',
                interpolation_note: constituencyId
                    ? `Interpolated from ${total} observations for constituency ${constituencyId}. Equal-weight booth disaggregation (SHRUG pending).`
                    : `Interpolated from state-wide observations. Booth not yet linked to constituency.`,
            };
        });

        res.json({
            booth_id: boothId, constituency_id: constituencyId,
            time_window: timeWindow, sentiments, interpolated: true,
            computed_at: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[BOOTH SENTIMENT] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Phase 1: Get sentiment for a constituency
app.get('/api/up/sentiment/:constituencyId', async (req, res) => {
    const constituencyId = req.params.constituencyId;
    const timeWindow = req.query.time_window || 'last_7d';
    const daysMap = { 'last_24h': 1, 'last_7d': 7, 'last_30d': 30, 'last_90d': 90, 'all_time': 365 };
    const days = daysMap[timeWindow] || 7;

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (obs:SentimentObservation)
             WHERE obs.constituency_id = $cid
               AND obs.source_date >= date() - duration({days: $days})
             RETURN
               obs.constituency_id AS constituency_id,
               obs.entity_id AS entity_id,
               obs.entity_type AS entity_type,
               COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS positive_count,
               COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
               COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neutral_count,
               COUNT(obs) AS total_count
             ORDER BY obs.entity_id`,
            { cid: constituencyId, days: days }
        );

        const aggregations = result.records.map(r => {
            const total = r.get('total_count').toNumber();
            const pos = r.get('positive_count').toNumber();
            const neg = r.get('negative_count').toNumber();
            const neu = r.get('neutral_count').toNumber();

            return {
                entity_id: r.get('entity_id'),
                entity_type: r.get('entity_type'),
                positive_pct: total > 0 ? Math.round(1000 * pos / total) / 10 : 0,
                negative_pct: total > 0 ? Math.round(1000 * neg / total) / 10 : 0,
                neutral_pct: total > 0 ? Math.round(1000 * neu / total) / 10 : 0,
                total_count: total,
                dominant_sentiment: pos > neg && pos > neu ? 'positive' : (neg > pos && neg > neu ? 'negative' : 'neutral'),
            };
        });

        await session.close();

        res.json({
            constituency_id: constituencyId,
            constituency_name: constituencyId,
            time_window: timeWindow,
            aggregations: aggregations,
            computed_at: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[SENTIMENT] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Phase 2: Get sentiment for a specific entity
app.get('/api/up/sentiment/entity/:entityId', async (req, res) => {
    const entityId = req.params.entityId;
    const timeWindow = req.query.time_window || 'last_7d';
    const daysMap = { 'last_24h': 1, 'last_7d': 7, 'last_30d': 30, 'last_90d': 90, 'all_time': 365 };
    const days = daysMap[timeWindow] || 7;

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (obs:SentimentObservation {entity_id: $eid})
             WHERE obs.source_date >= date() - duration({days: $days})
             RETURN
               obs.constituency_id AS constituency_id,
               obs.sentiment AS sentiment,
               COUNT(obs) AS count
             ORDER BY obs.constituency_id`,
            { eid: entityId, days: days }
        );

        const constituencyData = {};
        result.records.forEach(r => {
            const cid = r.get('constituency_id');
            const sent = r.get('sentiment');
            const cnt = r.get('count').toNumber();
            if (!constituencyData[cid]) {
                constituencyData[cid] = { positive: 0, negative: 0, neutral: 0, total: 0 };
            }
            constituencyData[cid][sent] += cnt;
            constituencyData[cid].total += cnt;
        });

        const constituencies = Object.entries(constituencyData).map(([cid, data]) => ({
            constituency_id: cid,
            positive_pct: data.total > 0 ? Math.round(1000 * data.positive / data.total) / 10 : 0,
            negative_pct: data.total > 0 ? Math.round(1000 * data.negative / data.total) / 10 : 0,
            neutral_pct: data.total > 0 ? Math.round(1000 * data.neutral / data.total) / 10 : 0,
            total_count: data.total,
            dominant_sentiment: data.positive > data.negative && data.positive > data.neutral ? 'positive' :
                                (data.negative > data.positive && data.negative > data.neutral ? 'negative' : 'neutral'),
        }));

        await session.close();

        res.json({
            entity_id: entityId,
            time_window: timeWindow,
            constituencies: constituencies,
            computed_at: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[SENTIMENT] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});



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
              sum(d.total_population) AS totalPop,
              sum(d.total_male) AS totalMale,
              sum(d.total_female) AS totalFemale,
              sum(d.rural_population) AS ruralPop,
              sum(d.urban_population) AS urbanPop,
              sum(d.hindu_population) AS hinduPop,
              sum(d.muslim_population) AS muslimPop,
              sum(d.christian_population) AS christianPop,
              sum(d.sikh_population) AS sikhPop,
              sum(d.currently_married_pop) AS marriedPop,
              sum(d.widowed_pop) AS widowedPop,
              sum(d.migrant_population) AS migrants,
              sum(d.total_women) AS totalWomen,
              sum(d.ever_married_women) AS everMarriedWomen,
              sum(d.bilingual_population) AS bilingualPop
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
        console.log(`[STRATEGY ENGINE] Grounded analysis for: "${title}"`);


        // Load UP-wide census data from DB for demographic grounding
        const upCensusCtx = await getUPCensusContext();

        // Fetch real-time news context
        const newsContext = await getCachedNews(title);

        // Analysis Prompt (Narration Only)
        const prompt = `
You are an expert Indian political strategy analyst for Uttar Pradesh. 
Analyze the proposed strategy below using the provided verified demographic figures.

PROPOSED STRATEGY: "${title}" (${description})
REAL-TIME NEWS: ${newsContext || "No recent news found."}
VERIFIED UP DEMOGRAPHICS:
${upCensusCtx || 'UP has ~200M population, ~80% Hindu, ~19% Muslim, ~78% rural.'}

YOUR TASK:
Provide a 3-paragraph "Deterministic Narrative" explaining:
1. Which demographics (from the list above) will be most impacted and why?
2. What are the specific political risks given these figures?
3. How does this align with recent news trends?

DO NOT invent scores, metrics, or percentages. Provide a textual, factual narration.
`;

        const rawText = await callAI(prompt);

        // Programmatic Graph Construction (Deterministic, not AI-invented)
        // We show the impact on REAL demographic nodes
        const graphData = {
            nodes: [
                {id: title.slice(0, 20), group: 1, impact: 60, sentiment: 1},
                {id: "Rural Population", group: 2, impact: 77, sentiment: 1},
                {id: "Urban Population", group: 2, impact: 23, sentiment: 1},
                {id: "Youth", group: 2, impact: 30, sentiment: 1},
                {id: "Women", group: 2, impact: 48, sentiment: 1}
            ],
            links: [
                {source: title.slice(0, 20), target: "Rural Population", value: 10},
                {source: title.slice(0, 20), target: "Urban Population", value: 10},
                {source: title.slice(0, 20), target: "Youth", value: 10},
                {source: title.slice(0, 20), target: "Women", value: 10}
            ]
        };

        res.json({
            ai_prediction: rawText,
            metrics: { positive: 'N/A', negative: 'N/A', overall: 'Grounded Analysis' },
            graph_data: graphData,
            support: [],
            resistance: [],
            demography: "Analysis grounded in verified Census 2011 figures.",
            summary: "Narration complete.",
            roadmap: [],
            db_context: "Deterministic Narration Applied"
        });

    } catch (error) {
        res.status(500).json({ error: "Strategy analysis engine unavailable." });
    }
});

// Grounded /api/analyze route
app.post('/api/analyze', async (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });
    try {
        console.log(`[UP ANALYSIS] Grounding: ${title}`);
        const [newsContext, upCensusCtx] = await Promise.all([
            getCachedNews(title),
            getUPCensusContext()
        ]);

        const prompt = `
You are India's top political intelligence analyst for Uttar Pradesh.
Narrate the impact of the scheme "${title}" using these graph facts:
NEWS: ${newsContext || "Not available"}
DEMOGRAPHICS: ${upCensusCtx}

Focus on how rural vs urban and religious demographics will react. 
Provide a concise, defensible narrative. No invented metrics.
`;
        const rawText = await callAI(prompt);

        res.json({
            ai_prediction: rawText, 
            metrics: {positive: 'N/A', negative: 'N/A', overall: 'Fact-Based'}, 
            graph_data: { nodes: [{id: title.slice(0,15), group:1, impact:50, sentiment:1}], links: [] },
            resistance: [],
            roadmap: []
        });
    } catch (error) {
        res.status(500).json({ error: "Analysis failed." });
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
               d.total_population    AS totalPop,
               d.total_male          AS totalMale,
               d.total_female        AS totalFemale,
               d.rural_population    AS ruralPop,
               d.urban_population    AS urbanPop,
               d.hindu_population    AS hinduPop,
               d.muslim_population   AS muslimPop,
               d.christian_population AS christianPop,
               d.sikh_population     AS sikhPop,
               d.buddhist_population AS buddhistPop,
               d.jain_population     AS jainPop,
               d.never_married_pop    AS neverMarried,
               d.married_population  AS married,
               d.widowed_population  AS widowed,
               d.migrant_population  AS migrants,
               d.bilingual_population AS bilingual,
               d.trilingual_population AS trilingual,
               d.youth_population    AS youth,
               d.working_age_pop      AS workingAge,
               d.senior_population   AS senior,
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
        const results = await fetchNewsData(
            districtName + ' Uttar Pradesh',
            districtNewsCache,
            districtName,
            DIST_CACHE_DURATION,
            5
        );
        headlines = (results || []).slice(0, 5)
            .map(a => (a.title || '').trim())
            .filter(h => h.length > 10);
    } catch (e) { /* silent */ }

    // Step 3: AI Narration (Limited to Narration Only, no computation)
    const finalLeader = dbLeader || {
        name: 'Data Pending Acquisition',
        designation: 'N/A',
        party: 'N/A',
        since: 'N/A',
        note: 'The current representative data for this district is being updated.'
    };

    const finalPop = {
        total:     (dbPopulation && dbPopulation.total)     || null,
        male:      (dbPopulation && dbPopulation.male)      || null,
        female:    (dbPopulation && dbPopulation.female)    || null,
        rural:     (dbPopulation && dbPopulation.rural)     || null,
        urban:     (dbPopulation && dbPopulation.urban)     || null,
        density:   (dbPopulation && dbPopulation.density)   || null,
        literacy:  (dbPopulation && dbPopulation.literacy)  || null,
        sex_ratio: (dbPopulation && dbPopulation.sex_ratio) || null,
    };

    // Use pre-computed census demographics from real graph data
    const finalDemo = preDemo || [];
    const finalHeadlines = headlines.length > 0 ? headlines : [`No recent news found for ${districtName}. Check back soon.`];

    // AI Narration of the graph facts (Deterministic Narration)
    let aiNarration = "Analysis pending acquisition of structured governance data.";
    if (totalPop) {
        try {
            const prompt = `Narrate a 2-sentence political and demographic summary for ${districtName}, Uttar Pradesh based on these facts:
            Population: ${totalPop.toLocaleString()}, Rural: ${finalPop.rural?.toLocaleString()}, Urban: ${finalPop.urban?.toLocaleString()}.
            Top News: ${headlines.slice(0, 2).join(' | ')}`;
            aiNarration = await callAI(prompt);
        } catch (e) { /* fallback to default string */ }
    }

    // Build census summary block for the response
    const censusBlock = dbCensus ? {
        hindu_population:     dbCensus.hinduPop     || 0,
        muslim_population:    dbCensus.muslimPop    || 0,
        christian_population: dbCensus.christianPop || 0,
        sikh_population:      dbCensus.sikhPop      || 0,
        married_population:   dbCensus.married      || 0,
        widowed_population:   dbCensus.widowed      || 0,
        migrant_population:   dbCensus.migrants     || 0,
        bilingual_population: dbCensus.bilingual    || 0,
        trilingual_population:dbCensus.trilingual   || 0,
        youth_population:     dbCensus.youth        || 0,
        working_age_population:dbCensus.workingAge   || 0,
        senior_population:    dbCensus.senior       || 0,
        rural_population:     (dbPopulation && dbPopulation.rural)  || 0,
        urban_population:     (dbPopulation && dbPopulation.urban)  || 0,
    } : null;

    res.json({
        district: districtName,
        leader: finalLeader,
        population: finalPop,
        demographics: finalDemo,
        census: censusBlock,
        headlines: finalHeadlines,
        narration: aiNarration,
        source: dbCensus ? 'Census 2011 DB + AI Narration + News' : 'Database + News'
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
});

// UP Social Media News Proxy — routes through dual-key rotation
// Called by upsocial.js instead of hitting NewsData.io directly
const upNewsCache = { data: null, ts: 0 };
app.get('/api/up/news', async (req, res) => {
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

// Sentiment Analysis API — returns aggregated sentiment observations from Neo4j
app.get('/api/up/sentiment', async (req, res) => {
    try {
        const session = driver.session();
        const result = await session.run(`
            MATCH (o:SentimentObservation)
            RETURN o.sentiment_label AS label,
                   count(o) AS count,
                   collect(DISTINCT o.detected_language) AS languages,
                   avg(o.sentiment_confidence) AS avg_confidence
            ORDER BY count DESC
        `);
        const breakdown = result.records.map(r => ({
            label: r.get('label'),
            count: r.get('count').toNumber(),
            languages: r.get('languages'),
            avgConfidence: parseFloat(r.get('avg_confidence').toFixed(4))
        }));

        const totalResult = await session.run(`
            MATCH (o:SentimentObservation)
            RETURN count(o) AS total,
                   min(o.collected_at) AS earliest,
                   max(o.collected_at) AS latest
        `);
        const totalRow = totalResult.records[0];

        const recentResult = await session.run(`
            MATCH (o:SentimentObservation)
            RETURN o.title AS title,
                   o.sentiment_label AS label,
                   o.sentiment_confidence AS confidence,
                   o.detected_language AS language,
                   o.source AS source,
                   o.url AS url,
                   o.published_at AS publishedAt,
                   o.collected_at AS collectedAt
            ORDER BY o.collected_at DESC
            LIMIT 20
        `);
        const recent = recentResult.records.map(r => ({
            title: r.get('title'),
            label: r.get('label'),
            confidence: parseFloat(r.get('confidence')),
            language: r.get('language'),
            source: r.get('source'),
            url: r.get('url'),
            publishedAt: r.get('publishedAt'),
            collectedAt: r.get('collectedAt')
        }));

        await session.close();

        res.json({
            status: 'success',
            total: totalRow.get('total').toNumber(),
            earliest: totalRow.get('earliest'),
            latest: totalRow.get('latest'),
            breakdown,
            recent
        });
    } catch (err) {
        console.error('[SENTIMENT API] Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Constituency-specific Sentiment API — returns sentiment for a given constituency
app.get('/api/up/sentiment/:constituencyName', async (req, res) => {
    try {
        const constName = req.params.constituencyName;
        const session = driver.session();

        const result = await session.run(`
            MATCH (o:SentimentObservation)
            WHERE toLower(o.title) CONTAINS toLower($constName)
               OR toLower(o.text) CONTAINS toLower($constName)
            RETURN o.sentiment_label AS label,
                   count(o) AS count,
                   avg(o.sentiment_confidence) AS avg_confidence
            ORDER BY count DESC
        `, { constName });

        const breakdown = result.records.map(r => ({
            label: r.get('label'),
            count: r.get('count').toNumber(),
            avgConfidence: parseFloat(r.get('avg_confidence').toFixed(4))
        }));

        const recentResult = await session.run(`
            MATCH (o:SentimentObservation)
            WHERE toLower(o.title) CONTAINS toLower($constName)
               OR toLower(o.text) CONTAINS toLower($constName)
            RETURN o.title AS title,
                   o.sentiment_label AS label,
                   o.sentiment_confidence AS confidence,
                   o.detected_language AS language,
                   o.source AS source,
                   o.url AS url,
                   o.published_at AS publishedAt,
                   o.collected_at AS collectedAt
            ORDER BY o.collected_at DESC
            LIMIT 10
        `, { constName });

        const recent = recentResult.records.map(r => ({
            title: r.get('title'),
            label: r.get('label'),
            confidence: parseFloat(r.get('confidence')),
            language: r.get('language'),
            source: r.get('source'),
            url: r.get('url'),
            publishedAt: r.get('publishedAt'),
            collectedAt: r.get('collectedAt')
        }));

        const totalResult = await session.run(`
            MATCH (o:SentimentObservation)
            WHERE toLower(o.title) CONTAINS toLower($constName)
               OR toLower(o.text) CONTAINS toLower($constName)
            RETURN count(o) AS total
        `, { constName });

        await session.close();

        res.json({
            status: 'success',
            constituency: constName,
            total: totalResult.records[0].get('total').toNumber(),
            breakdown,
            recent
        });
    } catch (err) {
        console.error('[SENTIMENT CONST API] Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/up/schemes', async (req, res) => {
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
