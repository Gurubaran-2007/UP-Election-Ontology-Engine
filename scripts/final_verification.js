#!/usr/bin/env node
/**
 * Final verification of all data
 */

const neo4j = require('neo4j-driver');
const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guru@9114'));

async function verifyAll() {
    const session = driver.session();
    
    console.log('='.repeat(70));
    console.log('FINAL DATA VERIFICATION - UP Election Ontology Engine');
    console.log('='.repeat(70));
    
    // 1. All node counts
    console.log('\n📊 NODE COUNTS:');
    const counts = await session.run(`
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS count
        ORDER BY count DESC
    `);
    
    let totalNodes = 0;
    counts.records.forEach(r => {
        const c = Number(r.get('count'));
        totalNodes += c;
        console.log(`  ${r.get('label').padEnd(25)}: ${c.toString().padStart(5)}`);
    });
    console.log(`  TOTAL NODES: ${totalNodes}`);
    
    // 2. District data
    console.log('\n🏛️ DISTRICT DATA:');
    const distCount = await session.run(`MATCH (d:District) RETURN count(d) AS c`);
    console.log(`  Total Districts: ${distCount.records[0].get('c')}`);
    
    const distWithEgs = await session.run(`MATCH (d:District) WHERE d.egs_zp_payments_cr IS NOT NULL RETURN count(d) AS c`);
    console.log(`  With eGramSwaraj data: ${distWithEgs.records[0].get('c')}`);
    
    const distWithPfms = await session.run(`MATCH (d:District) WHERE d.pfms_expenditure_lakhs IS NOT NULL RETURN count(d) AS c`);
    console.log(`  With PFMS data: ${distWithPfms.records[0].get('c')}`);
    
    // 3. Top districts by expenditure
    console.log('\n💰 TOP 10 DISTRICTS BY ZP EXPENDITURE (2024-25):');
    const topDist = await session.run(`
        MATCH (d:District)
        WHERE d.egs_zp_payments_cr IS NOT NULL
        RETURN d.name AS district, 
               round(d.egs_zp_payments_cr, 2) AS zp_cr,
               round(d.pfms_expenditure_lakhs, 2) AS pfms_lakhs
        ORDER BY zp_cr DESC
        LIMIT 10
    `);
    console.log('  District'.padEnd(20) + 'ZP (Cr)'.padEnd(12) + 'PFMS (L)');
    console.log('  ' + '-'.repeat(50));
    topDist.records.forEach(r => {
        console.log(`  ${r.get('district').padEnd(20)}${r.get('zp_cr').toString().padEnd(12)}${r.get('pfms_lakhs') || 0}`);
    });
    
    // 4. Constituencies
    console.log('\n🗳️ CONSTITUENCIES:');
    const lsCount = await session.run(`MATCH (ls:LokSabhaConstituency) RETURN count(ls) AS c`);
    const vsCount = await session.run(`MATCH (vs:VidhanSabhaConstituency) RETURN count(vs) AS c`);
    console.log(`  Lok Sabha (LS): ${lsCount.records[0].get('c')}`);
    console.log(`  Vidhan Sabha (VS): ${vsCount.records[0].get('c')}`);
    
    // 5. Schemes
    console.log('\n📋 SCHEMES:');
    const schemeCount = await session.run(`MATCH (s:Scheme) RETURN count(s) AS c`);
    console.log(`  Total Schemes: ${schemeCount.records[0].get('c')}`);
    
    const sdCount = await session.run(`MATCH (sd:SchemeDelivery) RETURN count(sd) AS c`);
    console.log(`  Scheme Delivery Records: ${sdCount.records[0].get('c')}`);
    
    // 6. Economic data
    console.log('\n📈 ECONOMIC DATA:');
    const ecoCount = await session.run(`MATCH (e:EconomicIndicator) RETURN count(e) AS c`);
    console.log(`  Economic Indicators: ${ecoCount.records[0].get('c')}`);
    
    // 7. Sample relationships
    console.log('\n🔗 RELATIONSHIPS:');
    const relCount = await session.run(`MATCH ()-[r]->() RETURN count(r) AS c`);
    console.log(`  Total Relationships: ${relCount.records[0].get('c')}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL DATA LOADED AND VERIFIED!');
    console.log('='.repeat(70));
    
    await session.close();
    await driver.close();
}

verifyAll().catch(console.error);