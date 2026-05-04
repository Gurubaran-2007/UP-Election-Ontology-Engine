const express = require('express');
const router = express.Router({ mergeParams: true });
const driver = require('../config/db');
const { resolveState, listStates } = require('../utils/state');

// GET /api/states — list all configured states
router.get('/', (req, res) => {
    res.json({ states: listStates() });
});

// All routes below are mounted at /api/state/:stateCode
// mergeParams: true lets them read req.params.stateCode

function stateFilter(stateCode) {
    // Cypher WHERE clause fragment for state filtering
    // Nodes carry state_code property set during import
    return `n.state_code = $stateCode`;
}

// GET /api/state/:stateCode — state summary
router.get('/:stateCode', async (req, res) => {
    const { stateCode } = req.params;
    const config = resolveState(stateCode);
    if (!config) {
        return res.status(404).json({ error: `State "${stateCode}" not configured` });
    }

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (s:State {state_code: $stateCode})
             RETURN s`,
            { stateCode: stateCode.toUpperCase() }
        );
        await session.close();

        const stateNode = result.records.length > 0 ? result.records[0].get('s').properties : null;
        res.json({
            state_code: config.state_code,
            state_name: config.state_name,
            ls_seat_count: config.ls_seat_count,
            vs_seat_count: config.vs_seat_count,
            regions: config.regions,
            graph_node: stateNode,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/state/:stateCode/constituencies
router.get('/:stateCode/constituencies', async (req, res) => {
    const { stateCode } = req.params;
    const config = resolveState(stateCode);
    if (!config) return res.status(404).json({ error: `State "${stateCode}" not configured` });

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE ls.state_code = $stateCode
             RETURN ls.ls_id AS ls_id, ls.name AS name, ls.region AS region,
                    ls.reservation AS reservation
             ORDER BY ls.ls_no`,
            { stateCode: stateCode.toUpperCase() }
        );
        await session.close();

        const constituencies = result.records.map(r => ({
            ls_id: r.get('ls_id'),
            name: r.get('name'),
            region: r.get('region'),
            reservation: r.get('reservation'),
        }));
        res.json({ state_code: stateCode.toUpperCase(), count: constituencies.length, constituencies });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/state/:stateCode/constituency/:name/results
router.get('/:stateCode/constituency/:name/results', async (req, res) => {
    const { stateCode, name } = req.params;
    if (!resolveState(stateCode)) return res.status(404).json({ error: `State "${stateCode}" not configured` });

    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)
             WHERE (toLower(ls.name) = toLower($name) OR ls.ls_id = $name)
             OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult)
             RETURN ls, er ORDER BY er.election_id DESC`,
            { name }
        );
        await session.close();

        if (result.records.length === 0) {
            return res.status(404).json({ error: `Constituency "${name}" not found` });
        }

        const ls = result.records[0].get('ls').properties;
        const results = result.records
            .map(r => { const e = r.get('er'); return e ? e.properties : null; })
            .filter(Boolean);
        res.json({ state_code: stateCode.toUpperCase(), constituency: ls, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/state/:stateCode/constituency/:name/candidates
router.get('/:stateCode/constituency/:name/candidates', async (req, res) => {
    const { stateCode, name } = req.params;
    const electionId = req.query.election || 'LS2024';
    if (!resolveState(stateCode)) return res.status(404).json({ error: `State "${stateCode}" not configured` });

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
        res.json({ state_code: stateCode.toUpperCase(), constituency: name, election_id: electionId, candidates });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/state/:stateCode/constituency/:name/classification
router.get('/:stateCode/constituency/:name/classification', async (req, res) => {
    const { stateCode, name } = req.params;
    if (!resolveState(stateCode)) return res.status(404).json({ error: `State "${stateCode}" not configured` });

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
            return res.status(404).json({ error: `Constituency "${name}" not found` });
        }

        const r = result.records[0];
        const ls = r.get('ls').properties;
        const scNode = r.get('sc');
        const saNode = r.get('sa');
        res.json({
            state_code: stateCode.toUpperCase(),
            constituency: { ls_id: ls.ls_id, name: ls.name, region: ls.region },
            classification: scNode ? scNode.properties : null,
            sentiment_aggregation: saNode ? saNode.properties : null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/state/:stateCode/seats/competitive
router.get('/:stateCode/seats/competitive', async (req, res) => {
    const { stateCode } = req.params;
    const threshold = parseFloat(req.query.margin_pct || '5');
    if (!resolveState(stateCode)) return res.status(404).json({ error: `State "${stateCode}" not configured` });

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
        res.json({ state_code: stateCode.toUpperCase(), threshold_pct: threshold, count: seats.length, seats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
