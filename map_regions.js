require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'guru@9114')
);

const regionMap = {
    'Paschim Pradesh (Western UP)': ['Agra', 'Aligarh', 'Baghpat', 'Bareilly', 'Bijnor', 'Bulandshahr', 'Etah', 'Firozabad', 'Gautam Buddh Nagar', 'Ghaziabad', 'Hapur', 'Hathras', 'Jyotiba Phule Nagar', 'Mainpuri', 'Mathura', 'Meerut', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Rampur', 'Saharanpur', 'Sambhal', 'Shamli', 'Shahjahanpur'],
    'Purvanchal (Eastern UP)': ['Azamgarh', 'Ballia', 'Basti', 'Chandauli', 'Deoria', 'Ghazipur', 'Gorakhpur', 'Jaunpur', 'Kushinagar', 'Maharajganj', 'Mau', 'Mirzapur', 'Sant Kabir Nagar', 'Sant Ravidas Nagar', 'Siddharthnagar', 'Sonbhadra', 'Varanasi'],
    'Bundelkhand': ['Banda', 'Chitrakoot', 'Hamirpur', 'Jalaun', 'Jhansi', 'Lalitpur', 'Mahoba'],
    'Awadh (Central UP)': ['Ambedkar Nagar', 'Amethi', 'Ayodhya', 'Bahraich', 'Balrampur', 'Barabanki', 'Farrukhabad', 'Fatehpur', 'Gonda', 'Hardoi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kheri', 'Lucknow', 'Pratapgarh', 'Prayagraj', 'Rae Bareli', 'Shravasti', 'Sitapur', 'Sultanpur', 'Unnao']
};

async function mapRegions() {
    const session = driver.session();
    console.log('🌍 Categorizing districts into regions...');

    try {
        for (const [region, districts] of Object.entries(regionMap)) {
            console.log(`   📂 Processing ${region}...`);
            await session.run(`
                MERGE (r:Region {name: $region})
                WITH r
                UNWIND $districts AS dName
                MATCH (d:District) WHERE d.name =~ ("(?i)" + dName)
                MERGE (d)-[:PART_OF]->(r)
            `, { region, districts });
        }
        console.log('✅ All districts categorized!');
    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}

mapRegions();
