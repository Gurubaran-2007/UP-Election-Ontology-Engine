// fix_district_names.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

const fixes = {
    'AMROHA': 'Amroha', 'AZAMGARH': 'Azamgarh', 'BAGHPAT': 'Baghpat', 'BAREILLY': 'Bareilly',
    'BIJNOR': 'Bijnor', 'BULANDSHAHR': 'Bulandshahr', 'DEORIA': 'Deoria', 'ETAH': 'Etah',
    'ETAWAH': 'Etawah', 'FATEHPUR': 'Fatehpur', 'HAMIRPUR': 'Hamirpur', 'JAUNPUR': 'Jaunpur',
    'KANNAUJ': 'Kannauj', 'KANPUR NAGAR': 'Kanpur Nagar', 'KAUSHAMBI': 'Kaushambi', 'KUSHI NAGAR': 'Kushinagar',
    'LUCKNOW': 'Lucknow', 'MAINPURI': 'Mainpuri', 'MATHURA': 'Mathura', 'MIRZAPUR': 'Mirzapur',
    'MORADABAD': 'Moradabad', 'PRATAPGARH': 'Pratapgarh', 'PRAYAGRAJ': 'Prayagraj',
    'RAE BARELI': 'Rae Bareli', 'RAMPUR': 'Rampur', 'SAHARANPUR': 'Saharanpur', 'SAMBHAL': 'Sambhal',
    'VARANASI': 'Varanasi',
};

async function main() {
    const s = driver.session();
    let count = 0;
    
    for (const [wrong, correct] of Object.entries(fixes)) {
        await s.run('MATCH (d:District) WHERE d.name = $wrong SET d.name = $correct', { wrong, correct });
        console.log(`  ${wrong} -> ${correct}`);
        count++;
    }
    
    console.log(`\n✓ Fixed ${count} district names`);
    
    // Verify
    const r = await s.run(`MATCH (d:District)-[:HAS_LOK_SABHA_SEAT]->(ls) RETURN d.name, count(ls) ORDER BY d.name`);
    console.log(`\n=== ${r.records.length} Districts with seats ===`);
    r.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)}`));
    
    await s.close();
    await driver.close();
}

main();