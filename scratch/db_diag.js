require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function check() {
    const session = driver.session();
    console.log('--- DATABASE CHECK ---');
    
    // Check for Etah and Bah
    const result = await session.run(`
        MATCH (c:Constituency) 
        WHERE toLower(c.name) CONTAINS "etah" OR toLower(c.name) CONTAINS "bah"
        RETURN c.name AS name, size((c)<-[:PART_OF]-()) AS boothCount, size((c)-[:BELONGS_TO]->()) AS distCount
    `);

    result.records.forEach(r => {
        console.log(`Constituency: "${r.get('name')}" | Booths: ${r.get('boothCount')} | Linked to District: ${r.get('distCount') > 0 ? 'YES' : 'NO'}`);
    });

    // Check for Districts
    const dists = await session.run(`MATCH (d:District) RETURN d.name AS name`);
    console.log('\n--- DISTRICTS IN DB ---');
    dists.records.forEach(r => console.log(`District: "${r.get('name')}"`));

    await session.close();
    await driver.close();
}

check();
