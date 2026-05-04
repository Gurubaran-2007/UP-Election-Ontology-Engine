/**
 * seed_vs2022_results.js
 *
 * Loads UP VS 2022 election results into Neo4j from:
 *   data/eci/vs2022/detailed_results.csv   — all candidates per constituency
 *   data/eci/vs2022/successful_candidates.csv — winners
 *   data/eci/vs2022/party_performance.csv  — party-level stats
 *
 * Creates / enriches:
 *   VidhanSabhaConstituency  — adds winner, runner-up, margin, turnout%
 *   CandidateResult          — one node per candidate per constituency
 *   Party                    — adds contested/won/vote_share stats
 *   CONTESTED_IN             — CandidateResult → VidhanSabhaConstituency
 *   REPRESENTS               — winner CandidateResult → Party
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const neo4j = require("neo4j-driver");

const DATA_DIR = path.join(__dirname, "../data/eci/vs2022");

const driver = neo4j.driver(
  process.env.NEO4J_URI || "neo4j://localhost:7687",
  neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD)
);

function readCsv(filename) {
  const content = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function toInt(v) { return parseInt(v) || 0; }
function toFloat(v) { return parseFloat(v) || 0; }
function clean(v) { return (v || "").toString().trim(); }

async function seedResults(session) {
  const rows = readCsv("detailed_results.csv");
  console.log(`Loading ${rows.length} candidate result rows...`);

  // Group by constituency
  const byConstituency = {};
  for (const r of rows) {
    const acNo = toInt(r["Constituency No."]);
    if (!acNo) continue;
    if (!byConstituency[acNo]) byConstituency[acNo] = [];
    byConstituency[acNo].push(r);
  }

  let count = 0;
  for (const [acNo, candidates] of Object.entries(byConstituency)) {
    // Sort by votes descending
    candidates.sort((a, b) =>
      toInt(b["Total Valid Votes"]) - toInt(a["Total Valid Votes"])
    );

    const winner = candidates[0];
    const runnerUp = candidates[1];
    const margin = runnerUp
      ? toInt(winner["Total Valid Votes"]) - toInt(runnerUp["Total Valid Votes"])
      : 0;
    const totalElectors = toInt(winner["Total Electors"]);
    const totalVotesPlusNota = toInt(winner["Total valid votes polled +NOTA"]);
    const turnoutPct = totalElectors > 0
      ? Math.round((totalVotesPlusNota / totalElectors) * 10000) / 100
      : 0;

    // Upsert constituency enrichment
    await session.run(
      `MERGE (c:VidhanSabhaConstituency {ac_no: $acNo})
       ON CREATE SET c.name = $name, c.constituency_no = $acNo
       SET c.winner_name = $winnerName,
           c.winner_party = $winnerParty,
           c.winner_votes = $winnerVotes,
           c.runner_up_name = $runnerUpName,
           c.runner_up_party = $runnerUpParty,
           c.runner_up_votes = $runnerUpVotes,
           c.victory_margin = $margin,
           c.total_electors = $totalElectors,
           c.turnout_pct = $turnoutPct,
           c.election_year = 2022`,
      {
        acNo: neo4j.int(toInt(acNo)),
        name: clean(winner["Constituency Name"]),
        winnerName: clean(winner["Candidate Name"]),
        winnerParty: clean(winner[" Party Name"]),
        winnerVotes: neo4j.int(toInt(winner["Total Valid Votes"])),
        runnerUpName: runnerUp ? clean(runnerUp["Candidate Name"]) : "",
        runnerUpParty: runnerUp ? clean(runnerUp[" Party Name"]) : "",
        runnerUpVotes: neo4j.int(runnerUp ? toInt(runnerUp["Total Valid Votes"]) : 0),
        margin: neo4j.int(margin),
        totalElectors: neo4j.int(totalElectors),
        turnoutPct,
      }
    );

    // Upsert CandidateResult nodes for all candidates
    for (const c of candidates) {
      await session.run(
        `MERGE (cr:CandidateResult {
           ac_no: $acNo,
           candidate_name: $name
         })
         SET cr.party = $party,
             cr.sex = $sex,
             cr.age = $age,
             cr.category = $category,
             cr.votes = $votes,
             cr.vote_pct = $votePct,
             cr.election_year = 2022,
             cr.is_winner = $isWinner
         WITH cr
         MATCH (vs:VidhanSabhaConstituency {ac_no: $acNo})
         MERGE (cr)-[:CONTESTED_IN]->(vs)`,
        {
          acNo: neo4j.int(toInt(acNo)),
          name: clean(c["Candidate Name"]),
          party: clean(c[" Party Name"]),
          sex: clean(c["Candidate Sex"]),
          age: neo4j.int(toInt(c["Candidate Age"])),
          category: clean(c["Candidate Category"]),
          votes: neo4j.int(toInt(c["Total Valid Votes"])),
          votePct: toFloat(c["% votes polled"]),
          isWinner: c === winner,
        }
      );
    }
    count++;
    if (count % 50 === 0) process.stdout.write(`  ${count}/${Object.keys(byConstituency).length} constituencies...\r`);
  }
  console.log(`\n✓ ${count} constituencies enriched with results`);
}

async function seedPartyPerformance(session) {
  const rows = readCsv("party_performance.csv");
  console.log(`Loading ${rows.length} party performance rows...`);

  for (const r of rows) {
    const name = clean(r["Party Name"]);
    if (!name) continue;
    await session.run(
      `MERGE (p:Party {name: $name})
       SET p.contested = $contested,
           p.won = $won,
           p.vote_share_pct = $votePct,
           p.total_votes = $votes,
           p.election_year = 2022`,
      {
        name,
        contested: neo4j.int(toInt(r["Contested"])),
        won: neo4j.int(toInt(r["Won"])),
        votePct: toFloat(r["Votes in %"]),
        votes: neo4j.int(toInt(r["Votes"])),
      }
    );
  }
  console.log(`✓ ${rows.length} parties updated`);
}

async function createIndexes(session) {
  const indexes = [
    "CREATE INDEX vs_ac_no IF NOT EXISTS FOR (n:VidhanSabhaConstituency) ON (n.ac_no)",
    "CREATE INDEX cr_ac_no IF NOT EXISTS FOR (n:CandidateResult) ON (n.ac_no)",
    "CREATE INDEX party_name IF NOT EXISTS FOR (n:Party) ON (n.name)",
  ];
  for (const q of indexes) {
    await session.run(q).catch(() => {});
  }
  console.log("✓ Indexes ensured");
}

async function main() {
  const session = driver.session();
  try {
    await createIndexes(session);
    await seedResults(session);
    await seedPartyPerformance(session);
    console.log("\n✅ VS 2022 results loaded into Neo4j");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
