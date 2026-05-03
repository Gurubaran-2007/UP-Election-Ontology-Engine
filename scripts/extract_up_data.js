// extract_up_data.js
// Extracts Uttar Pradesh constituency results from the all-India eci-2019.csv
// Source: https://github.com/pratapvardhan/Elections-India-2019/blob/master/eci-2019.csv

const fs = require('fs');
const path = require('path');

const INPUT_CSV = path.join(__dirname, '..', 'data', 'eci', 'eci-2019.csv');
const OUTPUT_UP_CSV = path.join(__dirname, '..', 'data', 'eci', 'up_ls2019_constituency_results.csv');
const OUTPUT_UP_JSON = path.join(__dirname, '..', 'data', 'eci', 'up_ls2019_constituency_results.json');

function extractUP() {
    if (!fs.existsSync(INPUT_CSV)) {
        console.error(`ERROR: ${INPUT_CSV} not found. Run download_data.js first.`);
        process.exit(1);
    }

    const raw = fs.readFileSync(INPUT_CSV, 'utf8');
    const lines = raw.split('\n');
    const header = lines[0].split(',');

    // Columns: OSN,Candidate,Party,EVM Votes,Postal Votes,Total Votes,%,State,Constituency,ST_CODE,PC_CODE
    const stateIdx = header.findIndex(h => h.trim() === 'State');
    const pcCodeIdx = header.findIndex(h => h.trim() === 'PC_CODE');
    const constituencyIdx = header.findIndex(h => h.trim() === 'Constituency');

    console.log(`Columns: ${header.join(' | ')}`);
    console.log(`State index: ${stateIdx}, PC_CODE: ${pcCodeIdx}, Constituency: ${constituencyIdx}`);

    // Filter UP rows and aggregate by constituency
    const upByPC = {}; // pc_code -> { constituency, results: [{candidate, party, votes}] }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parse (handles basic commas in values)
        const cols = line.split(',');
        const state = cols[stateIdx]?.trim();

        if (state !== 'Uttar Pradesh') continue;

        const pcCode = parseInt(cols[pcCodeIdx]);
        const constituency = cols[constituencyIdx]?.trim();
        const candidate = cols[1]?.trim();
        const party = cols[2]?.trim();
        const evmVotes = parseInt(cols[3]) || 0;
        const postalVotes = parseInt(cols[4]) || 0;
        const totalVotes = parseInt(cols[5]) || 0;

        if (!upByPC[pcCode]) {
            upByPC[pcCode] = {
                pc_code: pcCode,
                constituency: constituency,
                results: []
            };
        }

        upByPC[pcCode].results.push({
            candidate,
            party,
            evm_votes: evmVotes,
            postal_votes: postalVotes,
            total_votes: totalVotes
        });
    }

    const entries = Object.values(upByPC).sort((a, b) => a.pc_code - b.pc_code);
    console.log(`Found ${entries.length} UP Lok Sabha constituencies`);
    console.log(`Sample: ${entries[0]?.constituency} (PC ${entries[0]?.pc_code})`);
    console.log(`Sample: ${entries[79]?.constituency} (PC ${entries[79]?.pc_code})`);

    // Write CSV output
    let csvOut = 'pc_code,constituency,candidate,party,evm_votes,postal_votes,total_votes\n';
    for (const pc of entries) {
        for (const r of pc.results) {
            csvOut += `${pc.pc_code},"${pc.constituency}","${r.candidate}","${r.party}",${r.evm_votes},${r.postal_votes},${r.total_votes}\n`;
        }
    }
    fs.writeFileSync(OUTPUT_UP_CSV, csvOut);
    console.log(`Written CSV: ${OUTPUT_UP_CSV}`);

    // Write JSON output
    fs.writeFileSync(OUTPUT_UP_JSON, JSON.stringify(entries, null, 2));
    console.log(`Written JSON: ${OUTPUT_UP_JSON}`);

    // Summary
    for (const pc of entries) {
        const winner = pc.results.sort((a, b) => b.total_votes - a.total_votes)[0];
        console.log(`PC ${pc.pc_code}: ${pc.constituency} → ${winner.party} (${winner.total_votes.toLocaleString()} votes)`);
    }
}

extractUP();
