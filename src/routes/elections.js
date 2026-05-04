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

// /api/up/constituency/:name/affidavit
// Returns winning candidate profile + affidavit facts + derived candidate_risk label.
// Falls back gracefully when LS2024 Candidate nodes or Affidavit nodes are not yet seeded.
router.get('/constituency/:name/affidavit', async (req, res) => {
    const name = req.params.name;
    const electionId = req.query.election || 'LS2024';
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult {election_id: $electionId})
             OPTIONAL MATCH (c:Candidate)-[cr:CONTESTS_IN]->(ls)
             WHERE cr.election_id = $electionId AND toInteger(cr.rank) = 1
             OPTIONAL MATCH (c)-[:HAS_AFFIDAVIT]->(aff:Affidavit)
             RETURN ls.ls_id          AS ls_id,
                    er.winner         AS winner,
                    er.winner_party_id AS party_id,
                    c.education       AS education,
                    c.gender          AS gender,
                    aff.criminal_cases   AS criminal_cases,
                    aff.serious_cases    AS serious_cases,
                    aff.total_assets_cr  AS total_assets_cr,
                    aff.liabilities_cr   AS liabilities_cr,
                    aff.source           AS aff_source,
                    aff.source_url       AS source_url
             LIMIT 1`,
            { name, electionId }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `No constituency "${name}" found` });
        }
        const r = result.records[0];
        const criminal = r.get('criminal_cases');
        const serious  = r.get('serious_cases');
        const toN = v => (v === null || v === undefined) ? null
                       : (typeof v === 'object' && v.toNumber) ? v.toNumber()
                       : Number(v);

        let candidate_risk = 'pending';
        if (criminal !== null) {
            const c = toN(criminal), s = toN(serious) || 0;
            if (c > 3 && s > 0)  candidate_risk = 'multiple_cases';
            else if (s > 0)      candidate_risk = 'serious_cases_flagged';
            else if (c > 0)      candidate_risk = 'cases_declared';
            else                 candidate_risk = 'clean';
        }

        res.json({
            ls_id:          r.get('ls_id'),
            election_id:    electionId,
            winner:         r.get('winner'),
            party_id:       r.get('party_id'),
            education:      r.get('education'),
            gender:         r.get('gender'),
            candidate_risk,
            affidavit: {
                criminal_cases:  toN(criminal),
                serious_cases:   toN(serious),
                total_assets_cr: toN(r.get('total_assets_cr')),
                liabilities_cr:  toN(r.get('liabilities_cr')),
                source:          r.get('aff_source'),
                source_url:      r.get('source_url'),
            },
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/constituency/:name/issues
// Returns all Issue nodes with observation counts for this constituency.
// When IssueObservation nodes are not yet seeded, all counts are 0 (issue taxonomy still returned).
router.get('/constituency/:name/issues', async (req, res) => {
    const name = req.params.name;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             WITH ls
             MATCH (iss:Issue)
             OPTIONAL MATCH (io:IssueObservation)-[:ABOUT]->(iss)
             WHERE io.constituency_id = ls.ls_id
             RETURN iss.issue_id   AS issue_id,
                    iss.name       AS issue_name,
                    iss.category   AS category,
                    count(io)      AS observation_count,
                    collect(DISTINCT io.source_type)[..3] AS sample_sources
             ORDER BY observation_count DESC, iss.name ASC`,
            { name }
        );
        await session.close();
        const issues = result.records.map(r => ({
            issue_id:          r.get('issue_id'),
            issue_name:        r.get('issue_name'),
            category:          r.get('category'),
            observation_count: r.get('observation_count'),
            sample_sources:    r.get('sample_sources'),
        }));
        res.json({ constituency: name, issues, data_note: issues.every(i => i.observation_count === 0) ? 'IssueObservation ETL pending' : null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/constituency/:name/schemes
// Returns SchemeDelivery rows for this constituency across all 4 schemes.
// data_quality='estimated' means UP state average (NFHS-5) — not constituency-specific.
router.get('/constituency/:name/schemes', async (req, res) => {
    const name = req.params.name;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             OPTIONAL MATCH (ls)-[:HAS_DELIVERY]->(sd:SchemeDelivery)
             OPTIONAL MATCH (sc:Scheme {scheme_id: sd.scheme_id})
             RETURN sc.scheme_id    AS scheme_id,
                    sc.name         AS scheme_name,
                    sc.ministry     AS ministry,
                    sc.target_group AS target_group,
                    sd.coverage_pct    AS coverage_pct,
                    sd.delivery_status AS delivery_status,
                    sd.data_quality    AS data_quality,
                    toString(sd.source_date) AS source_date,
                    sd.source          AS source
             ORDER BY sc.name`,
            { name }
        );
        await session.close();
        const schemes = result.records
            .filter(r => r.get('scheme_id'))
            .map(r => ({
                scheme_id:       r.get('scheme_id'),
                scheme_name:     r.get('scheme_name'),
                ministry:        r.get('ministry'),
                target_group:    r.get('target_group'),
                coverage_pct:    r.get('coverage_pct'),
                delivery_status: r.get('delivery_status'),
                data_quality:    r.get('data_quality'),
                source_date:     r.get('source_date'),
                source:          r.get('source'),
            }));
        res.json({ constituency: name, schemes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/constituency/:name/recommendations
// Returns DecisionRecommendation nodes for this constituency, ordered by priority.
// Returns empty array when seed_recommendations.js has not yet been run.
router.get('/constituency/:name/recommendations', async (req, res) => {
    const name = req.params.name;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE toLower(ls.name) = toLower($name) OR ls.ls_id = $name
             OPTIONAL MATCH (rec:DecisionRecommendation)
             WHERE rec.constituency_id = ls.ls_id
             RETURN ls.ls_id AS ls_id, rec
             ORDER BY rec.priority DESC, rec.created_at DESC`,
            { name }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `No constituency "${name}" found` });
        }
        const ls_id = result.records[0].get('ls_id');
        const recommendations = result.records
            .map(r => { const n = r.get('rec'); return n ? n.properties : null; })
            .filter(Boolean);
        res.json({ constituency: name, ls_id, recommendations });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// /api/up/recommendation/:rec_id/evidence
// Returns the EvidenceBundle facts cited by a DecisionRecommendation.
router.get('/recommendation/:rec_id/evidence', async (req, res) => {
    const recId = req.params.rec_id;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (rec:DecisionRecommendation {rec_id: $rec_id})
             OPTIONAL MATCH (rec)-[:HAS_EVIDENCE]->(eb:EvidenceBundle)
             RETURN rec { .* } AS recommendation,
                    collect(eb { .* }) AS evidence_bundles`,
            { rec_id: recId }
        );
        await session.close();
        if (result.records.length === 0) {
            return res.status(404).json({ error: `Recommendation "${recId}" not found` });
        }
        const r = result.records[0];
        res.json({
            recommendation:   r.get('recommendation'),
            evidence_bundles: r.get('evidence_bundles'),
        });
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
