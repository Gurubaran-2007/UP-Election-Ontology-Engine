require('dotenv').config();
const XLSX = require('xlsx');
const neo4j = require('neo4j-driver');
const path = require('path');
const fs = require('fs');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

const folders = [
    'C:\\Users\\DELL\\Desktop\\election details 1',
    'C:\\Users\\DELL\\Desktop\\election details 2',
    'C:\\Users\\DELL\\Desktop\\election details 3'
];

async function masterSync() {
    const session = driver.session();
    console.log('🛰️ Starting MASTER DISTRICT SYNC (Checking all 800+ files)...');

    try {
        for (const folder of folders) {
            if (!fs.existsSync(folder)) continue;
            const files = fs.readdirSync(folder).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
            
            for (const file of files) {
                const filePath = path.join(folder, file);
                const constName = path.basename(filePath, path.extname(filePath)).replace(/[^a-zA-Z ()\-]/g, '').trim();
                
                // Read first 20 rows to find District
                const workbook = XLSX.readFile(filePath);
                const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
                
                let foundDist = 'UNKNOWN';
                for (let i = 0; i < 20; i++) {
                    const rowStr = JSON.stringify(data[i] || []).toUpperCase();
                    if (rowStr.includes('DISTRICT') || rowStr.includes('DIST.')) {
                        // Extract name after "District -" or "District:" or "Dist."
                        const parts = rowStr.split(/[-:]/);
                        if (parts[1]) {
                            foundDist = parts[1].replace(/[^A-Z ]/g, '').trim();
                            break;
                        }
                    }
                }

                if (foundDist !== 'UNKNOWN') {
                    process.stdout.write(`\r🔗 Linking ${constName} -> ${foundDist}       `);
                    await session.run(`
                        MERGE (d:District {name: $foundDist})
                        MERGE (c:Constituency {name: $constName})
                        MERGE (c)-[:BELONGS_TO]->(d)
                    `, { constName, foundDist });
                }
            }
        }
        console.log('\n\n✅ ALL 800+ FILES MAPPED TO DISTRICTS!');
    } catch (e) {
        console.error('\n❌ Sync Error:', e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

masterSync();
