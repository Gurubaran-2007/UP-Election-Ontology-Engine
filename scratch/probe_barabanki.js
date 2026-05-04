require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function probe() {
    const session = driver.session();
    console.log('--- 🔍 DATA PROBE: Barabanki ---');

    // 1. Search for any constituency with "Barabanki" in the name
    const search = await session.run(`
        MATCH (c:Constituency)
        WHERE toLower(c.name) CONTAINS "barabanki"
        RETURN c.name as name
    `);
    
    if (search.records.length > 0) {
        console.log('✅ Found in Database:');
        for (let r of search.records) {
            const name = r.get('name');
            console.log(`📍 Name: "${name}"`);
            
            // 2. Check for candidates
            const cans = await session.run(`
                MATCH (can:Candidate)-[:CONTESTED_IN]->(c:Constituency {name: $name})
                RETURN count(can) as count
            `, { name });
            console.log(`👥 Candidates: ${cans.records[0].get('count')}`);

            // 3. Check for booths
            const booths = await session.run(`
                MATCH (b:Booth)-[:PART_OF]->(c:Constituency {name: $name})
                RETURN count(b) as count
            `, { name });
            console.log(`📍 Booths: ${booths.records[0].get('count')}`);
        }
    } else {
        console.log('❌ "Barabanki" NOT FOUND in the database at all.');
    }

    await session.close();
    await driver.close();
}

probe();
