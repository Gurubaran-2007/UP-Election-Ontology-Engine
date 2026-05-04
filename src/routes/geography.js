const express = require('express');
const router = express.Router();
const driver = require('../config/db');
const fs = require('fs');
const path = require('path');

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

// /api/up/district/:district — full district intelligence panel data
// Returns: { leader, population, demographics, headlines, census, constituencies }
router.get('/district/:district', async (req, res) => {
    const district = req.params.district;
    try {
        const session = driver.session();
        const result = await session.run(
            `MATCH (d:District)
             WHERE toLower(d.name) = toLower($district)
             OPTIONAL MATCH (d)-[:CONTAINS|HAS_LS]->(ls:LokSabhaConstituency)
             OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult)
             OPTIONAL MATCH (ls)-[:HAS_VS]->(vs:VidhanSabhaConstituency)
             WITH d, ls, er,
                  collect(DISTINCT vs { .vs_id, .name, .reservation }) AS vsSegs
             ORDER BY ls.ls_no
             RETURN d.name            AS district_name,
                    d.population      AS population,
                    d.rural_pop       AS rural_pop,
                    d.urban_pop       AS urban_pop,
                    d.literacy_rate   AS literacy_rate,
                    d.density         AS density,
                    d.sex_ratio       AS sex_ratio,
                    ls.ls_id          AS ls_id,
                    ls.name           AS ls_name,
                    er.election_id    AS election_id,
                    er.winner         AS winner,
                    er.winner_party_id AS party_id,
                    er.winner_vote_share AS vote_share,
                    er.margin_pct     AS margin_pct,
                    er.margin_votes   AS margin_votes,
                    er.total_valid_votes AS total_votes,
                    vsSegs`,
            { district }
        );
        await session.close();

        if (result.records.length === 0) {
            return res.status(404).json({ error: `No district named "${district}" found in the graph.` });
        }

        const first = result.records[0];
        const distName = first.get('district_name');

        // Build constituency list from records
        const constituencies = result.records
            .filter(r => r.get('ls_id'))
            .map(r => ({
                ls_id:   r.get('ls_id'),
                ls_name: r.get('ls_name'),
                election_id:  r.get('election_id'),
                winner:       r.get('winner'),
                party_id:     r.get('party_id'),
                vote_share:   r.get('vote_share') ? parseFloat(r.get('vote_share')) : null,
                margin_pct:   r.get('margin_pct') ? parseFloat(r.get('margin_pct')) : null,
                margin_votes: r.get('margin_votes') ? parseInt(r.get('margin_votes')) : null,
                total_votes:  r.get('total_votes')  ? parseInt(r.get('total_votes'))  : null,
                vidhan_sabha_segments: (r.get('vsSegs') || []).filter(v => v && v.vs_id && v.name),
            }));

        // Deduplicate by ls_id
        const seen = new Set();
        const uniqueConstituencies = constituencies.filter(c => {
            if (seen.has(c.ls_id)) return false;
            seen.add(c.ls_id);
            return true;
        });

        // Population from district node properties
        const pop = {
            total:     first.get('population')    ? parseInt(first.get('population'))    : null,
            rural:     first.get('rural_pop')      ? parseInt(first.get('rural_pop'))      : null,
            urban:     first.get('urban_pop')      ? parseInt(first.get('urban_pop'))      : null,
            literacy:  first.get('literacy_rate')  || null,
            density:   first.get('density')        || null,
            sex_ratio: first.get('sex_ratio')      || null,
        };

        res.json({
            district:        distName,
            leader:          { name: null, party: null, designation: 'MP', since: null, note: null },
            population:      pop,
            demographics:    [],
            headlines:       [],
            census:          {},
            constituencies:  uniqueConstituencies,
            source:          'Neo4j Graph (ECI data)',
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

// /api/geo/india — India states GeoJSON
const INDIA_STATES_PATH = path.join(__dirname, '..', '..', 'public', 'maps', 'india_states.geojson');
let _indiaGeoCache = null;

router.get('/geo/india', (req, res) => {
    if (_indiaGeoCache) return res.json(_indiaGeoCache);
    if (!fs.existsSync(INDIA_STATES_PATH)) {
        return res.status(503).json({ error: 'India GeoJSON not found. Run scripts/convert_shapefiles.py first.' });
    }
    _indiaGeoCache = JSON.parse(fs.readFileSync(INDIA_STATES_PATH, 'utf8'));
    res.json(_indiaGeoCache);
});

// /api/geo/districts/:stateCode — district GeoJSON for a given state
const _districtGeoCache = new Map();

router.get('/geo/districts/:stateCode', (req, res) => {
    const code = req.params.stateCode.toUpperCase();
    if (_districtGeoCache.has(code)) return res.json(_districtGeoCache.get(code));
    const filePath = path.join(__dirname, '..', '..', 'public', 'maps', `${code}_districts.geojson`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `District map for "${code}" not available yet.` });
    }
    const geo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    _districtGeoCache.set(code, geo);
    res.json(geo);
});

module.exports = router;
