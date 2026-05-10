require('dotenv').config({path: '.env.local'});
const neo4j = require('neo4j-driver');

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'guru@9114'));

const session = driver.session();

async function checkData() {
    // Check all node types
    const result = await session.run(`
        MATCH (n) 
        RETURN labels(n)[0] AS label, count(n) AS count 
        ORDER BY count DESC
    `);
    
    console.log('Node types in graph:');
    result.records.forEach(r => {
        console.log(`  ${r.get('label')}: ${r.get('count')}`);
    });
    
    // Check districts
    console.log('\nSample District nodes:');
    const dResult = await session.run(`MATCH (d:District) RETURN d.name LIMIT 5`);
    dResult.records.forEach(r => console.log(`  ${r.get('d.name')}`));
    
    // Check if egs properties exist
    console.log('\nChecking egs properties on any nodes:');
    const propResult = await session.run(`
        MATCH (n) 
        WHERE n.egs_zp_payments_cr IS NOT NULL 
        RETURN count(n) AS count
    `);
    console.log(`  Nodes with egs data: ${propResult.records[0].get('count')}`);
    
    await session.close();
    await driver.close();
}

checkData().catch(console.error);