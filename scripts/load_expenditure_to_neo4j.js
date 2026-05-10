#!/usr/bin/env node
/**
 * Load eGramSwaraj expenditure data into Neo4j
 * Creates: DistrictExpenditure nodes linked to Districts
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../data/scraped/egramswaraj');

function parseCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 7) {
            const row = {
                district: values[0].trim(),
                zp_ob_receipts_cr: parseFloat(values[1]) || 0,
                zp_payments_cr: parseFloat(values[2]) || 0,
                bp_ob_receipts_cr: parseFloat(values[3]) || 0,
                bp_payments_cr: parseFloat(values[4]) || 0,
                gp_ob_receipts_cr: parseFloat(values[5]) || 0,
                gp_payments_cr: parseFloat(values[6]) || 0,
            };
            if (row.district && row.district !== 'District' && row.district !== 'OB + Receipts (Cr)') {
                data.push(row);
            }
        }
    }
    return data;
}

async function loadExpenditureData() {
    const neo4j = require('neo4j-driver');
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
    
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;
    
    if (!password) {
        console.error('NEO4J_PASSWORD not set in .env');
        process.exit(1);
    }
    
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const session = driver.session();
    
    try {
        const csvPath = path.join(OUTPUT_DIR, 'district_expenditure.csv');
        
        if (!fs.existsSync(csvPath)) {
            console.error('CSV file not found. Run scrape_egramswaraj.py first.');
            process.exit(1);
        }
        
        const data = parseCsv(csvPath);
        console.log(`Loaded ${data.length} district records from CSV`);
        
        console.log('\nLoading data to Neo4j...');
        
        for (const row of data) {
            await session.run(`
                MATCH (d:District {name: $district})
                SET d.expenditure_zp_receipts_cr = $zp_receipts,
                    d.expenditure_zp_payments_cr = $zp_payments,
                    d.expenditure_bp_receipts_cr = $bp_receipts,
                    d.expenditure_bp_payments_cr = $bp_payments,
                    d.expenditure_gp_receipts_cr = $gp_receipts,
                    d.expenditure_gp_payments_cr = $gp_payments,
                    d.expenditure_fin_year = '2024-2025',
                    d.expenditure_source = 'egramswaraj.gov.in',
                    d.expenditure_updated = datetime()
            `, {
                district: row.district,
                zp_receipts: row.zp_ob_receipts_cr,
                zp_payments: row.zp_payments_cr,
                bp_receipts: row.bp_ob_receipts_cr,
                bp_payments: row.bp_payments_cr,
                gp_receipts: row.gp_ob_receipts_cr,
                gp_payments: row.gp_payments_cr,
            });
        }
        
        console.log('✓ Loaded expenditure data for all districts');
        
        const result = await session.run(`
            MATCH (d:District)
            WHERE d.expenditure_zp_payments_cr IS NOT NULL
            RETURN d.name AS district, d.expenditure_zp_payments_cr AS payments_cr
            ORDER BY payments_cr DESC
            LIMIT 10
        `);
        
        console.log('\nTop 10 districts by Zilla Panchayat payments (2024-25):');
        result.records.forEach(r => {
            console.log(`  ${r.get('district')}: ₹${r.get('payments_cr').toFixed(2)} Cr`);
        });
        
        const countResult = await session.run(`
            MATCH (d:District)
            WHERE d.expenditure_zp_payments_cr IS NOT NULL
            RETURN count(d) AS count
        `);
        
        console.log(`\nTotal districts with expenditure data: ${countResult.records[0].get('count')}`);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

if (require.main === module) {
    loadExpenditureData();
}

module.exports = { parseCsv };