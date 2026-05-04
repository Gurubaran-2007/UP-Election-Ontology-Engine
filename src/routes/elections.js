const express = require('express');
const router = express.Router();
const driver = require('../config/db');

// Middleware: API Key Security (PRD §7.6)
const { apiKeyAuth } = require('../middleware/auth');

// /api/up/constituency/:name/results
router.get('/constituency/:name/results', async (req, res) => {
    const name = req.params.name;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult)
             RETURN ls, er ORDER BY er.election_id DESC`,
            { name }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `No constituency "${name}" found` });
        }
        const ls = result.records[0].get('ls').properties;
        const results = result.records
            .map(r => { const e = r.get('er'); return e ? e.properties : null; })
            .filter(Boolean);
        res.json({ constituency: ls, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/constituency/:name/candidates
router.get('/constituency/:name/candidates', async (req, res) => {
    const name = req.params.name;
    const electionId = req.query.election || 'LS2024';
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (c:Candidate)-[r:CONTESTS_IN]->(ls:LokSabhaConstituency)
             WHERE (toLower(ls.name) = toLower($name) OR ls.ls_id = $name)
               AND r.election_id = $electionId
             OPTIONAL MATCH (c)-[:BELONGS_TO]->(p:Party)
             RETURN c, r, p.name AS party_name ORDER BY r.rank`,
            { name, electionId }
        );
        await session.close();
        const candidates = result.records.map(r => ({
            ...r.get('c').properties,
            votes: r.get('r').properties.votes,
            rank: r.get('r').properties.rank,
            party_name: r.get('party_name'),
        }));
        res.json({ constituency: name, election_id: electionId, candidates });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/constituency/:name/classification
router.get('/constituency/:name/classification', async (req, res) => {
    const name = req.params.name;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             OPTIONAL MATCH (ls)-[:HAS_CLASSIFICATION]->(sc:SeatClassification)
             OPTIONAL MATCH (ls)-[:HAS_AGGREGATION]->(sa:SentimentAggregation)
             RETURN ls, sc, sa LIMIT 1`,
            { name }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `No constituency "${name}" found` });
        }
        const r = result.records[0];
        const ls = r.get('ls').properties;
        const scNode = r.get('sc');
        const saNode = r.get('sa');
        res.json({
            constituency: { ls_id: ls.ls_id, name: ls.name, region: ls.region },
            classification: scNode ? scNode.properties : null,
            sentiment_aggregation: saNode ? saNode.properties : null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/seats/competitive
router.get('/seats/competitive', async (req, res) => {
    const threshold = parseFloat(req.query.margin_pct || '5');
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)-[:HAS_RESULT]->(er:ElectionResult)
             WHERE er.election_id = 'LS2024' AND er.margin_pct IS NOT NULL
               AND toFloat(er.margin_pct) < $threshold
             RETURN ls.ls_id AS ls_id, ls.name AS name, ls.region AS region,
                    er.margin_pct AS margin_pct, er.winner AS winner,
                    er.winner_party_id AS party_id, er.winner_vote_share AS vote_share
             ORDER BY toFloat(er.margin_pct) ASC`,
            { threshold }
        );
        await session.close();
        const seats = result.records.map(r => ({
            ls_id: r.get('ls_id'),
            name: r.get('name'),
            region: r.get('region'),
            margin_pct: r.get('margin_pct'),
            winner: r.get('winner'),
            party_id: r.get('party_id'),
            vote_share: r.get('vote_share'),
        }));
        res.json({ threshold_pct: threshold, count: seats.length, seats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/recommendation/:rec_id/review
router.post('/recommendation/:rec_id/review', apiKeyAuth, async (req, res) => {
    const recId = req.params.rec_id;
    const { reviewed_by, status, notes } = req.body;
    if (!reviewed_by || !status) {
        return res.status(400).json({ error: 'reviewed_by and status are required' });
    }
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (rec:DecisionRecommendation {rec_id: $rec_id})
             SET rec.review_status = $status,
                 rec.reviewed_by = $reviewed_by,
                 rec.review_notes = $notes,
                 rec.reviewed_at = datetime()
             RETURN rec`,
            { rec_id: recId, status, reviewed_by, notes: notes || '' }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `Recommendation "${recId}" not found` });
        }
        res.json({ rec_id: recId, updated: true, status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
