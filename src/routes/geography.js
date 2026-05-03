const express = require('express');
const router = express.Router();
const driver = require('../config/db');

// /api/up/region/:regionId/districts
router.get('/region/:regionId/districts', async (req, res) => {
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

// /api/up/district/:district/constituencies
router.get('/district/:district/constituencies', async (req, res) => {
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

// /api/up/constituency/:constName/analysis
router.get('/constituency/:constName/analysis', async (req, res) => {
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

let _upGeoCache = null;
// /api/up/geo
router.get('/geo', async (req, res) => {
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

module.exports = router;
