// district_summary.js - Shows district-level summary for UI
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function getDistrictSummary() {
    const s = driver.session();
    
    const results = await s.run(`
        MATCH (d:District)-[:HAS_LOK_SABHA_SEAT]->(ls:LokSabhaConstituency)
        OPTIONAL MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er2024)
        OPTIONAL MATCH (ls)-[:HAS_RESULT {election_id: 'LS2019'}]->(er2019)
        OPTIONAL MATCH (ls)-[:HAS_TURNOUT {election_id: 'LS2024'}]->(t2024)
        OPTIONAL MATCH (ls)-[:HAS_TURNOUT {election_id: 'LS2019'}]->(t2019)
        RETURN d.name AS district,
               count(ls) AS seats,
               // LS2024
               collect(er2024.winner_party_id)[0] AS winner2024,
               avg(er2024.winner_vote_share) AS avg_share2024,
               // Margin
               avg(er2024.margin_pct) AS avg_margin,
               // Turnout
               avg(t2024.turnout_pct) AS turnout2024,
               // Compare vs 2019
               avg(t2024.turnout_pct) - avg(t2019.turnout_pct) AS turnout_change
        ORDER BY d.name
    `);
    
    console.log('District Summary (LS2024):');
    console.log('Name | Seats | Winner | Avg% | Margin% | Turnout% | ΔTurnout');
    console.log('-'.repeat(75));
    
    results.records.forEach(rec => {
        const name = rec.get(0);
        const seats = rec.get(1);
        const winner = rec.get(2) || 'N/A';
        const avg = rec.get(3)?.toFixed(1) || 'N/A';
        const margin = rec.get(4)?.toFixed(1) || 'N/A';
        const turnout = rec.get(5)?.toFixed(1) || 'N/A';
        const delta = rec.get(6)?.toFixed(1) || 'N/A';
        
        console.log(`${name} | ${seats} | ${winner} | ${avg}% | ${margin}% | ${turnout}% | ${delta}%`);
    });
    
    // Summary by party
    console.log('\n=== Party-wise Seat Count ===');
    const partySummary = await s.run(`
        MATCH (d:District)-[:HAS_LOK_SABHA_SEAT]->(ls:LokSabhaConstituency)
        MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        RETURN er.winner_party_id AS party, count(*) AS seats
        ORDER BY seats DESC
    `);
    partySummary.records.forEach(rec => {
        console.log(`  ${rec.get(0)}: ${rec.get(1)} seats`);
    });
    
    await s.close();
    await driver.close();
}

getDistrictSummary();