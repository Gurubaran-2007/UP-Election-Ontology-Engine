const express = require('express');
const router = express.Router();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guru@9114'));

// Get all schemes in UP
router.get('/', async (req, res) => {
    const session = driver.session();
    try {
        const schemes = await session.run(`
            MATCH (s:Scheme)
            RETURN s.name AS name, s.type AS type, s.description AS description
            ORDER BY type, name
        `);
        
        const schemeList = schemes.records.map(r => ({
            name: r.get('name'),
            type: r.get('type'),
            description: r.get('description')
        }));
        
        res.json({ schemes: schemeList, count: schemeList.length });
    } catch (error) {
        console.error('[SCHEMES] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// Get scheme progress at all levels (State, District, Block, Panchayat)
router.get('/progress', async (req, res) => {
    const session = driver.session();
    try {
        // District level progress
        const districtProgress = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            WHERE sd.expenditure_lakhs IS NOT NULL
            RETURN d.name AS district, 
                   sd.scheme AS scheme,
                   sd.sanctioned_lakhs AS sanctioned,
                   sd.expenditure_lakhs AS expenditure,
                   round(sd.utilization_pct, 2) AS utilization_pct,
                   sd.year AS year
            ORDER BY expenditure DESC
            LIMIT 100
        `);
        
        // Summary stats
        const summary = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            WHERE sd.expenditure_lakhs IS NOT NULL
            RETURN sum(sd.sanctioned_lakhs) AS total_sanctioned,
                   sum(sd.expenditure_lakhs) AS total_expenditure,
                   count(DISTINCT d.name) AS districts_covered,
                   count(sd) AS scheme_count,
                   avg(sd.utilization_pct) AS avg_utilization
        `);
        
        const districtData = districtProgress.records.map(r => ({
            district: r.get('district'),
            scheme: r.get('scheme'),
            sanctioned_cr: Math.round(Number(r.get('sanctioned') || 0)) / 100,
            expenditure_cr: Math.round(Number(r.get('expenditure') || 0)) / 100,
            utilization_pct: Number(r.get('utilization_pct') || 0),
            year: r.get('year')
        }));
        
        res.json({
            summary: {
                total_sanctioned_cr: Math.round(Number(summary.records[0].get('total_sanctioned') || 0)) / 100,
                total_expenditure_cr: Math.round(Number(summary.records[0].get('total_expenditure') || 0)) / 100,
                districts_covered: summary.records[0].get('districts_covered'),
                scheme_count: summary.records[0].get('scheme_count'),
                avg_utilization_pct: Math.round(Number(summary.records[0].get('avg_utilization') || 0))
            },
            district_level: districtData
        });
    } catch (error) {
        console.error('[SCHEMES/PROGRESS] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// Get beneficiary information
router.get('/benefits', async (req, res) => {
    const session = driver.session();
    try {
        // Get economic data that indicates benefits at all PRI levels
        const benefits = await session.run(`
            MATCH (d:District)
            WHERE d.egs_gp_payments_cr IS NOT NULL
            RETURN d.name AS district,
                   d.egs_gp_payments_cr AS gp_expenditure_cr,
                   d.egs_bp_payments_cr AS bp_expenditure_cr,
                   d.egs_zp_payments_cr AS zp_expenditure_cr,
                   d.egs_fin_year AS year
            ORDER BY gp_expenditure_cr DESC
            LIMIT 75
        `);
        
        const benefitData = benefits.records.map(r => ({
            district: r.get('district'),
            gram_panchayat: {
                expenditure_cr: Number(r.get('gp_expenditure_cr') || 0),
                estimated_beneficiaries: Math.round(Number(r.get('gp_expenditure_cr') || 0) * 10000),
                houses_constructed: Math.round(Number(r.get('gp_expenditure_cr') || 0) * 50)
            },
            block_panchayat: {
                expenditure_cr: Number(r.get('bp_expenditure_cr') || 0),
                estimated_beneficiaries: Math.round(Number(r.get('bp_expenditure_cr') || 0) * 2000)
            },
            zilla_panchayat: {
                expenditure_cr: Number(r.get('zp_expenditure_cr') || 0),
                estimated_beneficiaries: Math.round(Number(r.get('zp_expenditure_cr') || 0) * 1000)
            },
            year: r.get('year')
        }));
        
        // Calculate total benefits
        const totals = await session.run(`
            MATCH (d:District)
            WHERE d.egs_gp_payments_cr IS NOT NULL
            RETURN sum(d.egs_gp_payments_cr) AS total_gp,
                   sum(d.egs_bp_payments_cr) AS total_bp,
                   sum(d.egs_zp_payments_cr) AS total_zp
        `);
        
        const totalGP = Number(totals.records[0].get('total_gp') || 0);
        const totalBP = Number(totals.records[0].get('total_bp') || 0);
        const totalZP = Number(totals.records[0].get('total_zp') || 0);
        
        res.json({
            summary: {
                total_expenditure_cr: Math.round((totalGP + totalBP + totalZP) * 100) / 100,
                gram_panchayat_cr: Math.round(totalGP * 100) / 100,
                block_panchayat_cr: Math.round(totalBP * 100) / 100,
                zilla_panchayat_cr: Math.round(totalZP * 100) / 100,
                estimated_total_beneficiaries: Math.round(totalGP * 10000),
                estimated_houses_built: Math.round(totalGP * 50)
            },
            by_district: benefitData
        });
    } catch (error) {
        console.error('[SCHEMES/BENEFITS] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// Get all levels (State -> District -> Block -> Panchayat)
router.get('/levels', async (req, res) => {
    const session = driver.session();
    try {
        // State level
        const stateLevel = await session.run(`
            MATCH (s:State)
            RETURN s.name AS entity
        `);
        
        // District level
        const districtLevel = await session.run(`
            MATCH (d:District)
            WHERE d.egs_zp_payments_cr IS NOT NULL
            RETURN d.name AS entity, 
                   'District' AS level,
                   d.egs_zp_payments_cr AS zp_cr,
                   d.egs_bp_payments_cr AS bp_cr,
                   d.egs_gp_payments_cr AS gp_cr,
                   d.pfms_expenditure_lakhs AS pfms
            ORDER BY zp_cr DESC
        `);
        
        // Aggregate by level
        const levelSummary = await session.run(`
            MATCH (d:District)
            WHERE d.egs_zp_payments_cr IS NOT NULL
            RETURN 'Zilla Panchayat' AS level, sum(d.egs_zp_payments_cr) AS total_cr
            UNION ALL
            MATCH (d:District)
            WHERE d.egs_bp_payments_cr IS NOT NULL
            RETURN 'Block Panchayat' AS level, sum(d.egs_bp_payments_cr) AS total_cr
            UNION ALL
            MATCH (d:District)
            WHERE d.egs_gp_payments_cr IS NOT NULL
            RETURN 'Gram Panchayat' AS level, sum(d.egs_gp_payments_cr) AS total_cr
        `);
        
        res.json({
            state: stateLevel.records.map(r => ({ entity: r.get('entity'), level: 'State' })),
            districts: districtLevel.records.map(r => ({
                name: r.get('entity'),
                level: r.get('level'),
                zp_expenditure_cr: Number(r.get('zp_cr') || 0),
                bp_expenditure_cr: Number(r.get('bp_cr') || 0),
                gp_expenditure_cr: Number(r.get('gp_cr') || 0),
                pfms_lakhs: Number(r.get('pfms') || 0)
            })),
            level_summary: levelSummary.records.map(r => ({
                level: r.get('level'),
                total_expenditure_cr: Number(r.get('total_cr') || 0)
            }))
        });
    } catch (error) {
        console.error('[SCHEMES/LEVELS] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// Complete scheme dashboard
router.get('/dashboard', async (req, res) => {
    const session = driver.session();
    try {
        // All schemes
        const schemes = await session.run(`
            MATCH (s:Scheme)
            RETURN s.name AS name, s.type AS type
            ORDER BY type, name
        `);
        
        // Summary
        const summary = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            RETURN count(DISTINCT d.name) AS districts,
                   count(sd) AS delivery_records,
                   sum(sd.sanctioned_lakhs) AS total_sanctioned_lakhs,
                   sum(sd.expenditure_lakhs) AS total_expended_lakhs
        `);
        
        // Expenditure by level
        const byLevel = await session.run(`
            MATCH (d:District)
            RETURN sum(d.egs_zp_payments_cr) AS zp_cr,
                   sum(d.egs_bp_payments_cr) AS bp_cr,
                   sum(d.egs_gp_payments_cr) AS gp_cr
        `);
        
        // Top performing districts
        const topDistricts = await session.run(`
            MATCH (d:District)
            WHERE d.egs_zp_payments_cr IS NOT NULL
            RETURN d.name AS district, d.egs_zp_payments_cr AS expenditure_cr,
                   d.egs_gp_payments_cr AS gp_cr
            ORDER BY expenditure_cr DESC
            LIMIT 15
        `);
        
        // Low performing districts
        const lowDistricts = await session.run(`
            MATCH (d:District)
            WHERE d.egs_zp_payments_cr IS NOT NULL
            RETURN d.name AS district, d.egs_zp_payments_cr AS expenditure_cr
            ORDER BY expenditure_cr ASC
            LIMIT 10
        `);
        
        // Scheme-wise breakdown
        const byScheme = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            RETURN sd.scheme AS scheme,
                   sum(sd.sanctioned_lakhs) AS sanctioned,
                   sum(sd.expenditure_lakhs) AS expended,
                   count(DISTINCT d.name) AS districts
            ORDER BY expended DESC
        `);
        
        res.json({
            schemes: schemes.records.map(r => ({ name: r.get('name'), type: r.get('type') })),
            summary: {
                districts_covered: summary.records[0].get('districts'),
                delivery_records: summary.records[0].get('delivery_records'),
                total_sanctioned_cr: Math.round(summary.records[0].get('total_sanctioned_lakhs') || 0) / 100,
                total_expended_cr: Math.round(summary.records[0].get('total_expended_lakhs') || 0) / 100,
                utilization_pct: Math.round((summary.records[0].get('total_expended_lakhs') / summary.records[0].get('total_sanctioned_lakhs')) * 100) || 0
            },
            by_level: {
                zilla_panchayat_cr: Math.round(Number(byLevel.records[0].get('zp_cr') || 0) * 100) / 100,
                block_panchayat_cr: Math.round(Number(byLevel.records[0].get('bp_cr') || 0) * 100) / 100,
                gram_panchayat_cr: Math.round(Number(byLevel.records[0].get('gp_cr') || 0) * 100) / 100
            },
            by_scheme: byScheme.records.map(r => ({
                scheme: r.get('scheme'),
                sanctioned_cr: Math.round(r.get('sanctioned') || 0) / 100,
                expended_cr: Math.round(r.get('expended') || 0) / 100,
                districts: r.get('districts')
            })),
            top_districts: topDistricts.records.map(r => ({
                name: r.get('district'),
                zp_expenditure_cr: Number(r.get('expenditure_cr') || 0),
                gp_expenditure_cr: Number(r.get('gp_cr') || 0)
            })),
            low_districts: lowDistricts.records.map(r => ({
                name: r.get('district'),
                zp_expenditure_cr: Number(r.get('expenditure_cr') || 0)
            }))
        });
    } catch (error) {
        console.error('[SCHEMES/DASHBOARD] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// Get specific scheme details (MGNREGA, PMGSY, PMAY, etc.)
router.get('/:schemeName', async (req, res) => {
    const session = driver.session();
    try {
        const schemeName = req.params.schemeName.toUpperCase();
        
        // Get scheme details
        const schemeInfo = await session.run(`
            MATCH (s:Scheme {name: $scheme})
            RETURN s.name AS name, s.type AS type, s.description AS description
        `);
        
        // Get delivery data for this scheme
        const deliveryData = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            WHERE sd.scheme = $scheme
            RETURN d.name AS district,
                   sd.sanctioned_lakhs AS sanctioned,
                   sd.expenditure_lakhs AS expenditure,
                   sd.utilization_pct AS utilization,
                   sd.year AS year
            ORDER BY expenditure DESC
            LIMIT 50
        `);
        
        // Summary for this scheme
        const summary = await session.run(`
            MATCH (d:District)-[r:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery)
            WHERE sd.scheme = $scheme
            RETURN sum(sd.sanctioned_lakhs) AS total_sanctioned,
                   sum(sd.expenditure_lakhs) AS total_expended,
                   count(d) AS districts,
                   avg(sd.utilization_pct) AS avg_utilization
        `);
        
        if (schemeInfo.records.length === 0) {
            return res.status(404).json({ error: 'Scheme not found' });
        }
        
        res.json({
            scheme: {
                name: schemeInfo.records[0].get('name'),
                type: schemeInfo.records[0].get('type'),
                description: schemeInfo.records[0].get('description')
            },
            summary: {
                total_sanctioned_cr: Math.round(summary.records[0].get('total_sanctioned') || 0) / 100,
                total_expended_cr: Math.round(summary.records[0].get('total_expended') || 0) / 100,
                districts_covered: summary.records[0].get('districts'),
                avg_utilization_pct: Math.round(summary.records[0].get('avg_utilization') || 0)
            },
            by_district: deliveryData.records.map(r => ({
                district: r.get('district'),
                sanctioned_cr: Math.round(r.get('sanctioned') || 0) / 100,
                expenditure_cr: Math.round(r.get('expenditure') || 0) / 100,
                utilization_pct: Math.round(r.get('utilization') || 0),
                year: r.get('year')
            }))
        });
    } catch (error) {
        console.error('[SCHEMES/:SCHEME] Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;