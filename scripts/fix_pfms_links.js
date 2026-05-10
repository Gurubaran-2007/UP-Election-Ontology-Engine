#!/usr/bin/env node
/**
 * Fix PFMS district linking
 */

const neo4j = require('neo4j-driver');
const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guru@9114'));

async function fixPFMSLinks() {
    const session = driver.session();
    
    console.log('Fixing PFMS district links...');
    
    // Get all districts with PFMS data
    const result = await session.run(`
        MATCH (d:District)
        WHERE d.pfms_sanctioned_lakhs IS NOT NULL
        RETURN d.name AS name, d.pfms_sanctioned_lakhs AS sanctioned, d.pfms_expenditure_lakhs AS expenditure
    `);
    
    let fixed = 0;
    for (const r of result.records) {
        const name = r.get('name');
        const sanctioned = r.get('sanctioned');
        const expenditure = r.get('expenditure');
        
        // Create SchemeDelivery nodes for each district with PFMS data
        await session.run(`
            MATCH (d:District {name: $name})
            MERGE (d)-[:HAS_SCHEME_DELIVERY]->(sd:SchemeDelivery {year: '2024-2025'})
            SET sd.scheme = 'PMGSY',
                sd.sanctioned_lakhs = $sanctioned,
                sd.expenditure_lakhs = $expenditure,
                sd.utilization_pct = CASE WHEN $sanctioned > 0 THEN ($expenditure / $sanctioned) * 100 ELSE 0 END,
                sd.source = 'PFMS'
        `, { name: name, sanctioned: sanctioned, expenditure: expenditure });
        
        fixed++;
    }
    
    console.log(`Fixed ${fixed} PFMS links`);
    
    // Verify
    const verify = await session.run(`
        MATCH (sd:SchemeDelivery)
        RETURN count(sd) AS count
    `);
    console.log(`Total SchemeDelivery nodes: ${verify.records[0].get('count')}`);
    
    await session.close();
    await driver.close();
}

fixPFMSLinks().catch(console.error);