const express = require('express');
const router = express.Router();
const driver = require('../config/db');

// /api/up/booth/:boothId/analysis
router.get('/:boothId/analysis', async (req, res) => {
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

// /api/up/booth/:boothId/leaders
router.get('/:boothId/leaders', async (req, res) => {
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

module.exports = router;
