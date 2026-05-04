// test_api.js - Test the district API via Neo4j directly
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function testAPI() {
    const s = driver.session();
    
    console.log('=== All Districts Summary ===\n');
    const result = await s.run(`
        MATCH (d:District)
        OPTIONAL MATCH (d)-[:HAS_LOK_SABHA_SEAT]->(ls:LokSabhaConstituency)
        OPTIONAL MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        OPTIONAL MATCH (ls)-[:HAS_TURNOUT {election_id: 'LS2024'}]->(t)
        RETURN d.name AS district,
               count(ls) AS seats,
               collect(er.winner_party_id)[0] AS winner,
               avg(er.winner_vote_share) AS avg_share,
               avg(er.margin_pct) AS avg_margin,
               avg(t.turnout_pct) AS turnout
        ORDER BY d.name
    `);
    
    console.log('District | Seats | Winner | Avg% | Margin% | Turnout%');
    console.log('-'.repeat(70));
    result.records.forEach(rec => {
        console.log(`${rec.get('district')} | ${rec.get('seats')} | ${rec.get('winner')} | ${rec.get('avg_share')?.toFixed(1)}% | ${rec.get('avg_margin')?.toFixed(1)}% | ${rec.get('turnout')?.toFixed(1)}%`);
    });
    
    // Test specific district
    console.log('\n=== Single District: Lucknow ===\n');
    const lucknow = await s.run(`
        MATCH (d:District {name: 'Lucknow'})
        OPTIONAL MATCH (d)-[:HAS_LOK_SABHA_SEAT]->(ls:LokSabhaConstituency)
        OPTIONAL MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        OPTIONAL MATCH (ls)-[:HAS_TURNOUT {election_id: 'LS2024'}]->(t)
        OPTIONAL MATCH (ls)-[:HAS_TURNOUT {election_id: 'LS2019'}]->(t19)
        RETURN d.name AS district,
               count(ls) AS seats,
               collect(er.winner_party_id) AS parties,
               avg(er.winner_vote_share) AS avg_share,
               avg(t.turnout_pct) AS turnout_2024,
               avg(t.turnout_pct) - avg(t19.turnout_pct) AS turnout_change
    `);
    
    lucknow.records.forEach(rec => {
        const parties = rec.get('parties').filter(p => p);
        const partyCounts = {};
        parties.forEach(p => partyCounts[p] = (partyCounts[p] || 0) + 1);
        console.log(`District: ${rec.get('district')}`);
        console.log(`  LS Seats: ${rec.get('seats')}`);
        console.log(`  Seats by party:`, partyCounts);
        console.log(`  Avg winner share: ${rec.get('avg_share')?.toFixed(1)}%`);
        console.log(`  Turnout 2024: ${rec.get('turnout_2024')?.toFixed(1)}%`);
        console.log(`  Turnout change: ${rec.get('turnout_change')?.toFixed(1)}%`);
    });
    
    await s.close();
    await driver.close();
}

testAPI();