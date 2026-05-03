// normalize_ls2024.js
// Extracts UP LS2024 data from opencity.in bundle and writes
// data/eci/up_ls2024_results.csv in the same column schema as up_ls2019_results.csv
//
// Usage: node scripts/normalize_ls2024.js <path-to-zip>
// Example: node scripts/normalize_ls2024.js ../44aad2a3-ca1f-4e79-84c0-52f52290a754.zip

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Party name normalisation ─────────────────────────────────────────────────
// opencity.in uses full party names; map to TCPD-style abbreviations used in
// import_tcpd.js and the Party nodes already in Neo4j

const PARTY_NAME_MAP = {
    'bharatiya janata party':                    'BJP',
    'samajwadi party':                            'SP',
    'indian national congress':                   'INC',
    'bahujan samaj party':                        'BSP',
    'aam aadmi party':                            'AAP',
    'apna dal (soneylal)':                        'ADAL',
    'rashtriya lok dal':                          'RLD',
    'suheldev bharatiya samaj party':             'SBSP',
    'nishad party':                               'NP',
    'independent':                                'IND',
    'nota':                                       'NOTA',
};

function normalizeParty(raw) {
    if (!raw) return 'OTHER';
    const key = raw.trim().toLowerCase();
    return PARTY_NAME_MAP[key] || raw.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 20);
}

// ── Read all lines from a named file inside the zip ──────────────────────────
// Node has no built-in zip reader; we shell out to Python for extraction

function extractFromZip(zipPath, filename) {
    const { execSync } = require('child_process');
    const content = execSync(
        `python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); sys.stdout.buffer.write(z.read(sys.argv[2]))" ${zipPath} "${filename}"`,
        { maxBuffer: 50 * 1024 * 1024 }
    );
    return content.toString('utf-8');
}

function parseCsv(text, skipRows = 0) {
    const lines = text.split('\n').filter(l => l.trim());
    const dataLines = lines.slice(skipRows);
    const headers = dataLines[0].split(',').map(h => h.trim());
    return dataLines.slice(1).map(line => {
        const vals = line.split(',');
        const row = {};
        headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
        return row;
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const zipPath = process.argv[2];
    if (!zipPath || !fs.existsSync(zipPath)) {
        console.error('Usage: node scripts/normalize_ls2024.js <path-to-zip>');
        process.exit(1);
    }

    console.log('Reading zip files...');

    // ── Load LS2019 winners for incumbent computation ─────────────────────────
    // Incumbent = candidate who won LS2019 in the same PC and is contesting 2024
    const ls2019Path = path.join(__dirname, '..', 'data', 'eci', 'up_ls2019_results.csv');
    const incumbentsByPC = {}; // pcNo → normalised winner name

    if (fs.existsSync(ls2019Path)) {
        const ls2019Lines = fs.readFileSync(ls2019Path, 'utf-8').split('\n').filter(l => l.trim());
        const headers2019 = ls2019Lines[0].split(',');
        const posIdx  = headers2019.indexOf('Position');
        const pcIdx   = headers2019.indexOf('Constituency_No');
        const nameIdx = headers2019.indexOf('Candidate');

        for (const line of ls2019Lines.slice(1)) {
            const vals = line.split(',');
            if (vals[posIdx]?.trim() === '1') {
                const pcNo = vals[pcIdx]?.trim();
                const name = vals[nameIdx]?.trim().toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ');
                if (pcNo && name) incumbentsByPC[pcNo] = name;
            }
        }
        console.log(`LS2019 winners loaded: ${Object.keys(incumbentsByPC).length} PCs`);
    } else {
        console.warn('⚠ up_ls2019_results.csv not found — Incumbent field will be empty');
    }

    function normaliseName(raw) {
        return (raw || '').toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    function isIncumbent(pcNo, candidateName) {
        const winner2019 = incumbentsByPC[pcNo];
        if (!winner2019) return 'FALSE';
        const norm = normaliseName(candidateName);
        // Exact match
        if (norm === winner2019) return 'TRUE';
        // Partial match: only for names with 3+ words to avoid common-name false positives
        // e.g. "SATISH KUMAR" should NOT match "SATISH KUMAR GAUTAM"
        const w1 = winner2019.split(' ');
        const w2 = norm.split(' ');
        const [shorter, longer] = w1.length <= w2.length ? [w1, w2] : [w2, w1];
        if (shorter.length >= 3 && shorter.every(w => longer.includes(w))) return 'TRUE';
        return 'FALSE';
    }

    // ── Load File 1: all candidates ──────────────────────────────────────────
    const f1Raw  = extractFromZip(zipPath, 'lok-sabha-elections-2024-results.csv');
    const f1All  = parseCsv(f1Raw);
    const f1UP   = f1All.filter(r => r['State'] === 'Uttar Pradesh');
    console.log(`File 1 (candidates): ${f1UP.length} UP rows`);

    // ── Load File 2: winners / runners-up ────────────────────────────────────
    const f2Raw  = extractFromZip(zipPath, 'lok-sabha-elections-winners-and-runners-up-2024.csv');
    const f2All  = parseCsv(f2Raw);
    const f2UP   = f2All.filter(r => r['State'] === 'Uttar Pradesh');
    // Index by PC No → { marginVotes }
    const marginByPC = {};
    for (const r of f2UP) {
        marginByPC[r['PC No']] = parseInt(r['Margin Votes']) || null;
    }
    console.log(`File 2 (winners/runners-up): ${f2UP.length} UP rows`);

    // ── Load File 3: assembly segment ────────────────────────────────────────
    // First row is a title row ("34 - Details Of Assembly Segment..."), skip it
    const f3Raw  = extractFromZip(zipPath, 'assembly-segment-level-voting-data-for-all-constituencies-2024.csv');
    const f3All  = parseCsv(f3Raw, 1); // skip title row
    const f3UP   = f3All.filter(r => r['State/UT Name'] === 'Uttar Pradesh');

    // Index by PC No → { electors, notaVotes (summed across ACs) }
    const pcMeta = {};
    for (const r of f3UP) {
        const pcNo = r['PC NO'];
        if (!pcMeta[pcNo]) {
            pcMeta[pcNo] = {
                electors:  parseInt(r['TOTAL ELECTORS IN PC']) || null,
                notaVotes: 0,
                pcName:    r['PC NAME'],
            };
        }
        pcMeta[pcNo].notaVotes += parseInt(r['NOTA VOTES EVM IN AC']) || 0;
    }
    console.log(`File 3 (assembly segment): ${f3UP.length} UP rows, ${Object.keys(pcMeta).length} unique PCs`);

    // ── Group File 1 by PC No ─────────────────────────────────────────────────
    const candidatesByPC = {};
    for (const r of f1UP) {
        const pcNo = r['PC No'];
        if (!candidatesByPC[pcNo]) candidatesByPC[pcNo] = [];
        candidatesByPC[pcNo].push(r);
    }

    // ── Validate coverage ─────────────────────────────────────────────────────
    const pcNos = Object.keys(candidatesByPC).sort((a, b) => +a - +b);
    console.log(`\nUnique UP PCs in File 1: ${pcNos.length}`);
    if (pcNos.length !== 80) {
        console.warn(`⚠ Expected 80 UP PCs, found ${pcNos.length}`);
        console.warn('Missing:', [...Array(80)].map((_,i)=>String(i+1)).filter(n => !candidatesByPC[n]));
    }

    // ── Build output rows ─────────────────────────────────────────────────────
    // Schema mirrors up_ls2019_results.csv (TCPD column names) for import_tcpd.js compatibility
    // Fields not available in opencity.in are left empty

    const COLS = [
        'State_Name','Assembly_No','Constituency_No','Year','month','Poll_No','DelimID',
        'Position','Candidate','Sex','Party','Votes','Candidate_Type','Valid_Votes',
        'Electors','Constituency_Name','Constituency_Type','Sub_Region','N_Cand',
        'Turnout_Percentage','Vote_Share_Percentage','Deposit_Lost','Margin',
        'Margin_Percentage','ENOP','pid','Party_Type_TCPD','Party_ID','last_poll',
        'Contested','Last_Party','Last_Party_ID','Last_Constituency_Name',
        'Same_Constituency','Same_Party','No_Terms','Turncoat','Incumbent','Recontest',
        'MyNeta_education','TCPD_Prof_Main','TCPD_Prof_Main_Desc','TCPD_Prof_Second',
        'TCPD_Prof_Second_Desc','Election_Type'
    ];

    const outputRows = [];

    for (const pcNo of pcNos) {
        const candidates = candidatesByPC[pcNo].sort((a, b) => +a['Sl no'] - +b['Sl no']);
        const meta       = pcMeta[pcNo] || {};
        const electors   = meta.electors || null;
        const notaVotes  = meta.notaVotes || 0;
        const margin     = marginByPC[pcNo] || null;
        const pcName     = candidates[0]['PC Name'];
        const nCand      = candidates.length + (notaVotes > 0 ? 1 : 0); // include NOTA

        // Valid votes = sum of all candidate votes + NOTA
        const validVotes = candidates.reduce((s, r) => s + (parseInt(r['Total Votes']) || 0), 0) + notaVotes;
        const turnoutPct = electors ? +((validVotes / electors) * 100).toFixed(2) : '';
        const marginPct  = (margin && validVotes) ? +((margin / validVotes) * 100).toFixed(2) : '';

        // One row per candidate
        for (const cand of candidates) {
            const position  = +cand['Sl no'];
            const totalVotes = parseInt(cand['Total Votes']) || 0;
            const voteShare = cand['Vote Share'] || '';

            // Margin only on winner row (Position=1), matches TCPD convention
            const rowMargin    = position === 1 ? (margin ?? '') : '';
            const rowMarginPct = position === 1 ? (marginPct ?? '') : '';

            outputRows.push({
                State_Name:             'Uttar_Pradesh',
                Assembly_No:            '',
                Constituency_No:        pcNo,
                Year:                   '2024',
                month:                  '6',
                Poll_No:                '',
                DelimID:                '',
                Position:               position,
                Candidate:              cand['Candidate'],
                Sex:                    '',
                Party:                  normalizeParty(cand['Party']),
                Votes:                  totalVotes,
                Candidate_Type:         '',
                Valid_Votes:            validVotes,
                Electors:               electors ?? '',
                Constituency_Name:      pcName,
                Constituency_Type:      '',
                Sub_Region:             '',
                N_Cand:                 nCand,
                Turnout_Percentage:     turnoutPct,
                Vote_Share_Percentage:  voteShare,
                Deposit_Lost:           '',
                Margin:                 rowMargin,
                Margin_Percentage:      rowMarginPct,
                ENOP:                   '',
                pid:                    '',
                Party_Type_TCPD:        '',
                Party_ID:               '',
                last_poll:              '',
                Contested:              '',
                Last_Party:             '',
                Last_Party_ID:          '',
                Last_Constituency_Name: '',
                Same_Constituency:      '',
                Same_Party:             '',
                No_Terms:               '',
                Turncoat:               '',
                Incumbent:              isIncumbent(pcNo, cand['Candidate']),
                Recontest:              '',
                MyNeta_education:       '',
                TCPD_Prof_Main:         '',
                TCPD_Prof_Main_Desc:    '',
                TCPD_Prof_Second:       '',
                TCPD_Prof_Second_Desc:  '',
                Election_Type:          'Lok Sabha Election (GE)',
            });
        }

        // NOTA row
        if (notaVotes > 0) {
            outputRows.push({
                State_Name:             'Uttar_Pradesh',
                Assembly_No:            '',
                Constituency_No:        pcNo,
                Year:                   '2024',
                month:                  '6',
                Poll_No:                '',
                DelimID:                '',
                Position:               candidates.length + 1,
                Candidate:              'NOTA',
                Sex:                    '',
                Party:                  'NOTA',
                Votes:                  notaVotes,
                Candidate_Type:         '',
                Valid_Votes:            validVotes,
                Electors:               electors ?? '',
                Constituency_Name:      pcName,
                Constituency_Type:      '',
                Sub_Region:             '',
                N_Cand:                 nCand,
                Turnout_Percentage:     turnoutPct,
                Vote_Share_Percentage:  notaVotes && validVotes ? +((notaVotes/validVotes)*100).toFixed(2) : '',
                Deposit_Lost:           '',
                Margin:                 '',
                Margin_Percentage:      '',
                ENOP: '', pid: '', Party_Type_TCPD: '', Party_ID: '', last_poll: '',
                Contested: '', Last_Party: '', Last_Party_ID: '', Last_Constituency_Name: '',
                Same_Constituency: '', Same_Party: '', No_Terms: '', Turncoat: '',
                Incumbent: '', Recontest: '', MyNeta_education: '', TCPD_Prof_Main: '',
                TCPD_Prof_Main_Desc: '', TCPD_Prof_Second: '', TCPD_Prof_Second_Desc: '',
                Election_Type: 'Lok Sabha Election (GE)',
            });
        }
    }

    // ── Write CSV ─────────────────────────────────────────────────────────────
    const outPath = path.join(__dirname, '..', 'data', 'eci', 'up_ls2024_results.csv');
    const header  = COLS.join(',');
    const body    = outputRows.map(row => COLS.map(c => row[c] ?? '').join(','));
    fs.writeFileSync(outPath, [header, ...body].join('\n'));

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n✓ Written ${outputRows.length} rows to data/eci/up_ls2024_results.csv`);
    console.log(`  PCs covered:      ${pcNos.length} / 80`);
    console.log(`  Candidate rows:   ${outputRows.filter(r => r.Party !== 'NOTA').length}`);
    console.log(`  NOTA rows:        ${outputRows.filter(r => r.Party === 'NOTA').length}`);

    // Spot-check Saharanpur (PC 1)
    const s = outputRows.filter(r => r.Constituency_No === '1');
    console.log(`\nSpot-check PC 1 (Saharanpur):`);
    console.log(`  Candidates: ${s.length}`);
    s.slice(0, 3).forEach(r => {
        console.log(`  [${r.Position}] ${r.Candidate} | ${r.Party} | votes: ${r.Votes} | margin: ${r.Margin || '-'}`);
    });
    console.log(`  Electors: ${s[0]?.Electors}  ValidVotes: ${s[0]?.Valid_Votes}  Turnout: ${s[0]?.Turnout_Percentage}%`);
}

main();
