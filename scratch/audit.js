require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function audit() {
    const session = driver.session();
    console.log('--- 📊 DATABASE GROUND-TRUTH AUDIT ---');

    // 1. Total Counts
    const counts = await session.run(`
        MATCH (d:District) WITH count(d) as dists
        MATCH (c:Constituency) WITH dists, count(c) as consts
        MATCH (b:Booth) WITH dists, consts, count(b) as booths
        MATCH (can:Candidate) WITH dists, consts, booths, count(can) as cans
        RETURN dists, consts, booths, cans
    `);
    const c = counts.records[0];
    console.log(`✅ Districts: ${c.get('dists')}`);
    console.log(`✅ Constituencies: ${c.get('consts')}`);
    console.log(`✅ Polling Stations (Booths): ${c.get('booths')}`);
    console.log(`✅ Candidates: ${c.get('cans')}`);

    // 2. Check a specific one: Bakshi Kaa Talab
    console.log('\n--- 🎯 TARGET CHECK: Bakshi Kaa Talab ---');
    const bkt = await session.run(`
        MATCH (c:Constituency) WHERE toLower(c.name) CONTAINS "bakshi"
        OPTIONAL MATCH (b:Booth)-[:PART_OF]->(c)
        OPTIONAL MATCH (can:Candidate)-[:CONTESTED_IN]->(c)
        RETURN c.name as name, count(DISTINCT b) as booths, count(DISTINCT can) as cans
    `);
    if (bkt.records.length > 0) {
        const r = bkt.records[0];
        console.log(`📍 Name: ${r.get('name')}`);
        console.log(`📍 Booths found: ${r.get('booths')}`);
        console.log(`📍 Candidates found: ${r.get('cans')}`);
    } else {
        console.log('❌ Bakshi Kaa Talab not found in DB!');
    }

    await session.close();
    await driver.close();
}

audit();
