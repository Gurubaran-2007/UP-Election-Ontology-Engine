// download_data.js
// Downloads all publicly available election data for the UP Election Ontology Engine.
// Run: node scripts/download_data.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ECI_DIR = path.join(DATA_DIR, 'eci');
const MAPPINGS_DIR = path.join(DATA_DIR, 'mappings');
const MANUAL_DIR = path.join(DATA_DIR, 'manual');

// Ensure directories exist
for (const dir of [ECI_DIR, MAPPINGS_DIR, MANUAL_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        console.log(`Downloading: ${url}`);
        console.log(`  → ${outputPath}`);

        const file = fs.createWriteStream(outputPath);
        client.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                // Follow redirect
                downloadFile(res.headers.location, outputPath).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const totalSize = parseInt(res.headers['content-length'], 10);
            let downloaded = 0;

            res.pipe(file);

            res.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalSize) {
                    const pct = ((downloaded / totalSize) * 100).toFixed(1);
                    process.stdout.write(`  Progress: ${pct}%\r`);
                }
            });

            file.on('finish', () => {
                file.close();
                process.stdout.write('\n');
                const size = fs.statSync(outputPath).size;
                console.log(`  ✓ Downloaded ${(size / 1024 / 1024).toFixed(2)} MB`);
                resolve(outputPath);
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log('=== UP Election Ontology — Data Download ===\n');

    const downloads = [];

    // 1. ECI 2019 LS constituency results (GitHub — constituency level, ~500KB)
    downloads.push({
        url: 'https://raw.githubusercontent.com/pratapvardhan/Elections-India-2019/master/eci-2019.csv',
        output: path.join(ECI_DIR, 'eci-2019.csv'),
        description: 'All-India 2019 LS constituency results (pratapvardhan/Elections-India-2019)'
    });

    // 2. LS constituency list CSV (Gist — mapping LS to assembly segments, ~30KB)
    downloads.push({
        url: 'https://gist.githubusercontent.com/anandpdoshi/9448203/raw/list_of_lok_sabha_constituencies.csv',
        output: path.join(MAPPINGS_DIR, 'list_of_lok_sabha_constituencies.csv'),
        description: 'Lok Sabha constituency extent mapping (anandpdoshi gist)'
    });

    // Execute downloads
    let success = 0;
    let failed = 0;

    for (const dl of downloads) {
        console.log(`\n[${downloads.indexOf(dl) + 1}/${downloads.length}] ${dl.description}`);
        try {
            await downloadFile(dl.url, dl.output);
            success++;
        } catch (err) {
            console.error(`  ✗ Failed: ${err.message}`);
            failed++;
        }
    }

    console.log('\n=== Download Summary ===');
    console.log(`✓ ${success} succeeded`);
    console.log(`✗ ${failed} failed`);

    // Manual download instructions
    console.log('\n=== MANUAL DOWNLOADS REQUIRED ===');
    console.log('\nThese datasets require browser download (login/registration needed):\n');

    console.log('1. UP 2019 BOOTH-LEVEL RESULTS (Harvard Dataverse — ~50MB CSV)');
    console.log('   URL: https://dataverse.harvard.edu/dataverse/KKOWNJ');
    console.log('   DOI: 10.7910/DVN/KKOWNJ');
    console.log('   Look for: UP_2019_ps.csv or UP_2019_merge.csv');
    console.log(`   Save to: ${path.join(MANUAL_DIR, 'UP_2019_booth_results.csv')}\n`);

    console.log('2. SHRUG SOCIOECONOMIC DATA (DataSchool — ~100MB ZIP)');
    console.log('   URL: https://shrug.dataschool.io');
    console.log('   Requires: Free registration');
    console.log('   Download: UP village-level socioeconomic indicators');
    console.log(`   Save to: ${path.join(MANUAL_DIR, 'shrug_up_data.csv')}\n`);

    console.log('3. CSDS-LOKNITI 2024 POST-POLL SURVEY (CSDS — ~20MB)');
    console.log('   URL: https://csds.in (contact Data Unit)');
    console.log('   Requires: Academic request');
    console.log(`   Save to: ${path.join(MANUAL_DIR, 'csds_2024_survey.csv')}\n`);

    console.log('4. CENSUS 2011 VILLAGE-LEVEL UP DATA (Census India — ~500MB)');
    console.log('   URL: https://censusindia.gov.in');
    console.log('   Download: D-series (Village/Town directory) for UP');
    console.log(`   Save to: ${path.join(MANUAL_DIR, 'census_2011_up_villages.csv')}\n`);

    // If ECI data was downloaded, extract UP portion
    const eciCsvPath = path.join(ECI_DIR, 'eci-2019.csv');
    if (fs.existsSync(eciCsvPath)) {
        console.log('\n=== Extracting UP Data ===');
        console.log('Running extract_up_data.js...');
        try {
            require('./extract_up_data.js');
            console.log('✓ UP constituency data extracted');
        } catch (err) {
            console.error(`✗ Extraction failed: ${err.message}`);
        }
    }

    console.log('\n=== Next Steps ===');
    console.log('1. Complete manual downloads above');
    console.log('2. Start local Neo4j: docker compose up -d');
    console.log('3. Run imports: node scripts/import_constituencies.js');
    console.log('4. Verify: node scripts/verify_neo4j.js');
}

main().catch(console.error);
