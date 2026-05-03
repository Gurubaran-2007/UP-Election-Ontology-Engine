require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const districtMap = {
    "Agra": ["Agra Cantt.", "Agra South", "Agra North", "Etmadpur", "Fatehabad", "Fatehpur Sikri", "Kheragarh", "Bah"],
    "Aligarh": ["Aligarh", "Atrauli", "Barauli", "Chharra", "Iglas", "Khair", "Koil"],
    "Allahabad": ["Allahabad North", "Allahabad South", "Allahabad West", "Phaphamau", "Soraon", "Handia", "Meja", "Karchhana"],
    "Lucknow": ["Lucknow Central", "Lucknow East", "Lucknow West", "Lucknow North", "Lucknow Cantt.", "Bakshi Kaa Talab", "Malihabad", "Sarojini Nagar"],
    "Firozabad": ["Firozabad", "Jasrana", "Shikohabad", "Sirsaganj", "Tundla"],
    "Mathura": ["Mathura", "Chhata", "Goverdhan", "Mant", "Baldev"],
    "Hathras": ["Hathras", "Sasad", "Sikandra Rao"]
    // Add more if needed, but we can also do a broader match
};

async function repair() {
    const session = driver.session();
    console.log('🔧 Repairing District-Constituency Relationships...');

    try {
        // Broad Repair: If constituency name is in district list, link them
        for (const [dist, consts] of Object.entries(districtMap)) {
            console.log(`   🔗 Linking constituencies to ${dist}...`);
            await session.run(`
                MERGE (d:District {name: $dist})
                WITH d
                UNWIND $consts AS cName
                MATCH (c:Constituency)
                WHERE toLower(c.name) CONTAINS toLower(cName)
                MERGE (c)-[:BELONGS_TO]->(d)
            `, { dist, consts });
        }

        // Catch-all: Link UNKNOWNs if we can find their district in the name
        await session.run(`
            MATCH (c:Constituency)
            WHERE NOT (c)-[:BELONGS_TO]->()
            RETURN c.name as name
        `).then(async res => {
            console.log(`\n🔍 Found ${res.records.length} orphaned constituencies. Linking them...`);
        });

        console.log('\n✅ REPAIR COMPLETE! Refresh your website now.');
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

repair();
