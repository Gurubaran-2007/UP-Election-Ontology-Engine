const express = require('express');
const router = express.Router();
const driver = require('../config/db');

// /api/up/sentiment/heatmap
router.get('/heatmap', async (req, res) => {
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

// /api/up/sentiment/alerts
router.get('/alerts', async (req, res) => {
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

// /api/up/sentiment/booth/:boothId
router.get('/booth/:boothId', async (req, res) => {
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

// /api/up/sentiment/entity/:entityId
router.get('/entity/:entityId', async (req, res) => {
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

// /api/up/sentiment
router.get('/', async (req, res) => {
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

// /api/up/sentiment/:constituencyId
// Note: This overshadows the next route in original server.js, kept in original order
router.get('/:constituencyId', async (req, res) => {
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

// /api/up/sentiment/:constituencyName
// Included for fidelity with original server.js
router.get('/name/:constituencyName', async (req, res) => {
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

module.exports = router;
