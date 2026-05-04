#!/usr/bin/env node
/**
 * Load all scraped scheme data to Neo4j
 */

const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guru@9114'));

const SCRAPED_DIR = path.join(__dirname, '../data/scraped/schemes');
const EGRAM_DIR = path.join(__dirname, '../data/scraped/egramswaraj');

function parseJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function parseCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]?.trim() || '');
        return obj;
    });
}

async function loadSchemes(session) {
    console.log('Loading schemes...');
    
    const data = parseJson(path.join(SCRAPED_DIR, 'all_schemes.json'));
    if (!data || !data.schemes) return 0;
    
    let loaded = 0;
    for (const scheme of data.schemes) {
        await session.run(`
            MERGE (s:Scheme {name: $name})
            SET s.type = $type,
                s.description = $description,
                s.source = 'egramswaraj',
                s.fin_year = '2024-2025'
        `, { name: scheme.name, type: scheme.type, description: scheme.name });
        loaded++;
    }
    console.log(`  Loaded ${loaded} schemes`);
    return loaded;
}

async function loadPFMSData(session) {
    console.log('Loading PFMS data...');
    
    const data = parseCsv(path.join(SCRAPED_DIR, 'pfms_by_district.csv'));
    if (!data.length) return 0;
    
    let loaded = 0;
    for (const row of data) {
        if (!row.district || row.district === 'Grand Total') continue;
        
        await session.run(`
            MATCH (d:District)
            WHERE toLower(d.name) = toLower($district)
            MERGE (d)-[:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery {scheme: 'WDC-PMKSY', year: '2024-2025'})
            SET sd.sanctioned_lakhs = toFloat($sanctioned),
                sd.expenditure_lakhs = toFloat($expenditure),
                sd.utilization_pct = toFloat($utilization),
                sd.source = 'PFMS'
        `, { 
            district: row.district, 
            sanctioned: parseFloat(row.sanctioned_lakhs) || 0,
            expenditure: parseFloat(row.expenditure_lakhs) || 0,
            utilization: parseFloat(row.utilization_pct) || 0
        });
        loaded++;
    }
    console.log(`  Loaded ${loaded} PFMS records`);
    return loaded;
}

async function loadEgramData(session) {
    console.log('Loading eGramSwaraj data...');
    
    const data = parseCsv(path.join(EGRAM_DIR, 'district_expenditure.csv'));
    if (!data.length) return 0;
    
    let loaded = 0;
    for (const row of data) {
        if (!row.district) continue;
        
        await session.run(`
            MATCH (d:District)
            WHERE toLower(d.name) = toLower($district)
            SET d.egs_zp_receipts_cr = toFloat($zp_receipts),
                d.egs_zp_payments_cr = toFloat($zp_payments),
                d.egs_bp_payments_cr = toFloat($bp_payments),
                d.egs_gp_payments_cr = toFloat($gp_payments),
                d.egs_fin_year = '2024-2025'
        `, {
            district: row.district,
            zp_receipts: parseFloat(row.zp_ob_receipts_cr) || 0,
            zp_payments: parseFloat(row.zp_payments_cr) || 0,
            bp_payments: parseFloat(row.bp_payments_cr) || 0,
            gp_payments: parseFloat(row.gp_payments_cr) || 0
        });
        loaded++;
    }
    console.log(`  Updated ${loaded} districts with eGramSwaraj data`);
    return loaded;
}

async function verifySchemeData(session) {
    console.log('\nVerifying scheme data...');
    
    const schemeCount = await session.run(`MATCH (s:Scheme) RETURN count(s) AS c`);
    console.log(`  Schemes: ${schemeCount.records[0].get('c')}`);
    
    const sdCount = await session.run(`MATCH (sd:SchemeDelivery) RETURN count(sd) AS c`);
    console.log(`  Scheme Delivery records: ${sdCount.records[0].get('c')}`);
    
    const distCount = await session.run(`MATCH (d:District) WHERE d.egs_zp_payments_cr IS NOT NULL RETURN count(d) AS c`);
    console.log(`  Districts with expenditure: ${distCount.records[0].get('c')}`);
    
    // Top districts
    console.log('\n  Top 10 districts by expenditure:');
    const top = await session.run(`
        MATCH (d:District)
        WHERE d.egs_zp_payments_cr IS NOT NULL
        RETURN d.name AS name, d.egs_zp_payments_cr AS exp
        ORDER BY exp DESC
        LIMIT 10
    `);
    top.records.forEach(r => console.log(`    ${r.get('name')}: Rs.${Number(r.get('exp')).toFixed(2)}Cr`));
}

async function main() {
    const session = driver.session();
    
    console.log('='.repeat(50));
    console.log('Loading All Scheme Data to Neo4j');
    console.log('='.repeat(50));
    
    try {
        await loadSchemes(session);
        await loadPFMSData(session);
        await loadEgramData(session);
        await verifySchemeData(session);
        
        console.log('\n' + '='.repeat(50));
        console.log('All scheme data loaded!');
        console.log('='.repeat(50));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

main();