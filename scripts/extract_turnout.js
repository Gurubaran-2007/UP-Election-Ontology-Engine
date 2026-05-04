// extract_turnout.js
// Extracts turnout data from LS 2019/2024 results to JSON for Neo4j import
// Handles both State_Name based and direct constituency data

const fs = require('fs');
const path = require('path');

// Input files
const LS2019_CSV = path.join(__dirname, '..', 'data', 'states', 'UP', 'ls2019_results.csv');
const LS2024_CSV = path.join(__dirname, '..', 'data', 'states', 'UP', 'ls2024_results.csv');

// Output files
const LS2019_TURNOUT_JSON = path.join(__dirname, '..', 'data', 'states', 'UP', 'ls2019_turnout.json');
const LS2024_TURNOUT_JSON = path.join(__dirname, '..', 'data', 'states', 'UP', 'ls2024_turnout.json');

function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    console.log(`Headers: ${headers.join(' | ')}`);
    
    return lines.slice(1).map(line => {
        // Simple CSV parse - handle commas within quoted strings
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] || '';
        });
        return obj;
    });
}

function extractTurnout(rows, electionId) {
    // Group by constituency - get first row per constituency (position 1 = winner)
    const byConstituency = new Map();
    
    for (const row of rows) {
        const name = row['Constituency_Name'] || row['Constituency'];
        const pcNo = row['Constituency_No'] || row['pc_code'];
        const electors = parseInt(row['Electors'] || row['electors'] || row['registered_voters'] || 0);
        const validVotes = parseInt(row['Valid_Votes'] || row['valid_votes'] || row['total_valid_votes'] || 0);
        const votesCast = parseInt(row['Votes'] || row['votes_cast'] || 0);
        const turnoutPct = parseFloat(row['Turnout_Percentage'] || row['turnout_pct'] || 0);
        
        if (!name || !pcNo) continue;
        
        // Get unique constituency row (first occurrence has all info)
        if (!byConstituency.has(name)) {
            byConstituency.set(name, {
                ls_id: `UP-${pcNo}`,
                constituency: name,
                pc_code: parseInt(pcNo),
                election_id: electionId,
                registered_voters: electors || 0,
                total_valid_votes: validVotes || 0,
                votes_cast: votesCast || 0,
                turnout_pct: turnoutPct || 0,
                source: 'ECI',
                source_date: electionId === 'LS2019' ? '2019-05-23' : '2024-06-04',
                source_url: `https://eci.gov.in/result/${electionId.toLowerCase()}`
            });
        }
    }
    
    return Array.from(byConstituency.values()).sort((a, b) => a.pc_code - b.pc_code);
}

function main() {
    console.log('=== Extracting Turnout Data ===\n');
    
    // LS 2019
    const ls2019Rows = parseCSV(LS2019_CSV);
    const ls2019Turnout = extractTurnout(ls2019Rows, 'LS2019');
    fs.writeFileSync(LS2019_TURNOUT_JSON, JSON.stringify(ls2019Turnout, null, 2));
    console.log(`LS 2019: ${ls2019Turnout.length} constituencies`);
    console.log(`  Sample: ${ls2019Turnout[0]?.constituency} - Electors: ${ls2019Turnout[0]?.registered_voters}, Turnout: ${ls2019Turnout[0]?.turnout_pct}%`);
    
    // LS 2024
    const ls2024Rows = parseCSV(LS2024_CSV);
    const ls2024Turnout = extractTurnout(ls2024Rows, 'LS2024');
    fs.writeFileSync(LS2024_TURNOUT_JSON, JSON.stringify(ls2024Turnout, null, 2));
    console.log(`LS 2024: ${ls2024Turnout.length} constituencies`);
    console.log(`  Sample: ${ls2024Turnout[0]?.constituency} - Electors: ${ls2024Turnout[0]?.registered_voters}, Turnout: ${ls2024Turnout[0]?.turnout_pct}%`);
    
    console.log('\nDone!');
}

main();