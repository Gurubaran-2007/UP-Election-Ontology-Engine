#!/usr/bin/env node
/**
 * Load ALL data sources to Neo4j
 * Run: node scripts/load_all_data_to_neo4j.js
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const neo4j = require('neo4j-driver');

const SCRAPED_DIR = path.join(__dirname, '../data/scraped/egramswaraj');
const DATA_DIR = path.join(__dirname, '../data');

async function getDriver() {
    const uri = 'neo4j://localhost:7687';
    const user = 'neo4j';
    const password = 'guru@9114';
    
    return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

function parseCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
            let val = values[i]?.trim() || '';
            obj[h] = val;
        });
        return obj;
    });
}

async function loadEgramSwarajData(driver) {
    const session = driver.session();
    
    console.log('\n📊 Loading eGramSwaraj District Expenditure Data...');
    
    const data = parseCsv(path.join(SCRAPED_DIR, 'district_expenditure.csv'));
    
    if (data.length === 0) {
        console.log('  No eGramSwaraj data found');
        return;
    }
    
    let loaded = 0;
    for (const row of data) {
        if (!row.district) continue;
        
        await session.run(`
            MERGE (d:District {name: $district})
            SET d.egs_zp_receipts_cr = toFloat($zp_receipts),
                d.egs_zp_payments_cr = toFloat($zp_payments),
                d.egs_bp_receipts_cr = toFloat($bp_receipts),
                d.egs_bp_payments_cr = toFloat($bp_payments),
                d.egs_gp_receipts_cr = toFloat($gp_receipts),
                d.egs_gp_payments_cr = toFloat($gp_payments),
                d.egs_fin_year = '2024-2025',
                d.egs_updated = datetime()
        `, {
            district: row.district,
            zp_receipts: row.zp_ob_receipts_cr || 0,
            zp_payments: row.zp_payments_cr || 0,
            bp_receipts: row.bp_ob_receipts_cr || 0,
            bp_payments: row.bp_payments_cr || 0,
            gp_receipts: row.gp_ob_receipts_cr || 0,
            gp_payments: row.gp_payments_cr || 0,
        });
        loaded++;
    }
    
    console.log(`  ✓ Loaded ${loaded} district expenditure records`);
    await session.close();
}

async function loadPFMSEData(driver) {
    const session = driver.session();
    
    console.log('\n📊 Loading PFMS District Expenditure Data...');
    
    const data = parseCsv(path.join(SCRAPED_DIR, 'pfms_expenditure.csv'));
    
    if (data.length === 0) {
        console.log('  No PFMS data found');
        return;
    }
    
    let loaded = 0;
    for (const row of data) {
        if (!row.district || row.district === 'Grand Total') continue;
        
        // Try to match with existing district name (various formats)
        await session.run(`
            MERGE (d:District {name: $district})
            SET d.pfms_sanctioned_lakhs = toFloat($sanctioned),
                d.pfms_expenditure_lakhs = toFloat($expenditure),
                d.pfms_updated = datetime()
        `, {
            district: row.district, // Keep original case
            sanctioned: row.sanctioned_lakhs || 0,
            expenditure: row.expenditure_lakhs || 0,
        });
        loaded++;
    }
    
    console.log(`  ✓ Loaded ${loaded} PFMS records`);
    await session.close();
}

async function loadEconomicData(driver) {
    const session = driver.session();
    
    console.log('\n📊 Loading Economic (GVA) Data...');
    
    const csvPath = path.join(DATA_DIR, 'Merged_Annually_Quarterly.csv');
    const data = parseCsv(csvPath);
    
    if (data.length === 0) {
        console.log('  No economic data found');
        return;
    }
    
    // Get unique years and industries
    const years = [...new Set(data.map(d => d.year).filter(y => y))];
    const industries = [...new Set(data.map(d => d.industry).filter(i => i))];
    
    // Load as nodes attached to state
    let loaded = 0;
    for (const row of data) {
        if (!row.year || !row.industry) continue;
        
        await session.run(`
            MERGE (s:State {name: 'Uttar Pradesh'})
            SET s.economic_source = 'DES'
            WITH s
            MERGE (ei:EconomicIndicator {
                year: $year,
                industry: $industry,
                indicator: $indicator
            })
            SET ei.current_price_cr = toFloat($current_price),
                ei.constant_price_cr = toFloat($constant_price),
                ei.unit = $unit,
                ei.source = 'Merged_Annually_Quarterly'
            WITH s, ei
            MERGE (s)-[:HAS_ECONOMIC_DATA]->(ei)
        `, {
            year: row.year,
            industry: row.industry,
            indicator: row.indicator || 'GVA',
            current_price: parseFloat(row.current_price) || 0,
            constant_price: parseFloat(row.constant_price) || 0,
            unit: row.unit || '₹ Crore',
        });
        loaded++;
        
        if (loaded >= 500) break; // Limit for first run
    }
    
    console.log(`  ✓ Loaded ${loaded} economic records (limited to 500)`);
    await session.close();
}

async function loadECIData(driver) {
    const session = driver.session();
    
    console.log('\n📊 Loading ECI Election Data...');
    
    // Load LS2024 results
    const ls2024Path = path.join(DATA_DIR, 'eci/india_ls2024_results.csv');
    const ls2024Data = parseCsv(ls2024Path);
    
    let loaded = 0;
    for (const row of ls2024Data) {
        if (!row.state || row.state !== 'Uttar Pradesh') continue;
        
        await session.run(`
            MATCH (ls:LokSabhaConstituency {name: $constituency})
            SET ls.ls2024_winner = $winner,
                ls.ls2024_winner_party = $party,
                ls.ls2024_margin = toFloat($margin),
                ls.ls2024_updated = datetime()
        `, {
            constituency: row.pc_name,
            winner: row.winner_candidate,
            party: row.party,
            margin: row.margin || 0,
        });
        loaded++;
    }
    
    console.log(`  ✓ Loaded ${loaded} LS2024 results for UP`);
    await session.close();
}

async function verifyData(driver) {
    const session = driver.session();
    
    console.log('\n📊 Verifying Loaded Data...');
    
    // Check eGramSwaraj data
    const egsResult = await session.run(`
        MATCH (d:District)
        WHERE d.egs_zp_payments_cr IS NOT NULL
        RETURN count(d) AS count
    `);
    console.log(`  eGramSwaraj districts: ${egsResult.records[0].get('count')}`);
    
    // Check PFMS data
    const pfmsResult = await session.run(`
        MATCH (d:District)
        WHERE d.pfms_expenditure_lakhs IS NOT NULL
        RETURN count(d) AS count
    `);
    console.log(`  PFMS districts: ${pfmsResult.records[0].get('count')}`);
    
    // Check Economic data
    const ecoResult = await session.run(`
        MATCH (n:EconomicIndicator) RETURN count(n) AS count
    `);
    console.log(`  Economic records: ${ecoResult.records[0].get('count')}`);
    
    // Top districts by expenditure
    console.log('\n  Top 10 Districts by ZP Payments (2024-25):');
    const topResult = await session.run(`
        MATCH (d:District)
        WHERE d.egs_zp_payments_cr IS NOT NULL
        RETURN d.name AS district, d.egs_zp_payments_cr AS payments
        ORDER BY payments DESC
        LIMIT 10
    `);
    topResult.records.forEach(r => {
        console.log(`    ${r.get('district')}: ₹${r.get('payments').toFixed(2)} Cr`);
    });
    
    await session.close();
}

async function main() {
    console.log('=' .repeat(60));
    console.log('Loading ALL Data Sources to Neo4j');
    console.log('=' .repeat(60));
    
    let driver;
    try {
        driver = await getDriver();
        
        // Test connection
        await driver.verifyConnectivity();
        console.log('\n✓ Connected to Neo4j');
        
        // Load all data
        await loadEgramSwarajData(driver);
        await loadPFMSEData(driver);
        await loadEconomicData(driver);
        await loadECIData(driver);
        
        // Verify
        await verifyData(driver);
        
        console.log('\n' + '=' .repeat(60));
        console.log('✓ All data loaded successfully!');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('\n✗ Error:', error.message);
        console.log('\nMake sure Neo4j is running at localhost:7687');
    } finally {
        if (driver) await driver.close();
    }
}

if (require.main === module) {
    main();
}