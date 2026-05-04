/**
 * load_all_data.js
 *
 * One-shot script to load ALL missing data into Neo4j:
 *   1. Apply schema (constraints + indexes)
 *   2. Merge duplicate VidhanSabhaConstituency nodes
 *   3. Load booth_master.csv  → Booth nodes
 *   4. Load women_candidates.csv → WomanCandidate nodes
 *   5. Load TCPD_AE (assembly elections historical) from .csv.gz
 *   6. Load TCPD_GE (general elections historical) from .csv.gz
 *
 * Safe to re-run — all operations use MERGE.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { parse } = require("csv-parse/sync");
const neo4j = require("neo4j-driver");

const ROOT = path.join(__dirname, "..");
const driver = neo4j.driver(
  process.env.NEO4J_URI || "neo4j://localhost:7687",
  neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD)
);

function readCsv(filePath, options = {}) {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true, skip_empty_lines: true, trim: true,
    relax_quotes: true, relax_column_count: true, ...options,
  });
}

function readCsvGz(filePath) {
  const compressed = fs.readFileSync(filePath);
  const content = zlib.gunzipSync(compressed).toString("utf-8");
  return parse(content, {
    columns: true, skip_empty_lines: true, trim: true,
    relax_quotes: true, relax_column_count: true,
  });
}

function toInt(v) { return parseInt(v) || 0; }
function toFloat(v) { return parseFloat(v) || 0; }
function clean(v) { return (v || "").toString().trim(); }

// ── 1. Apply Schema ──────────────────────────────────────────
async function applySchema(session) {
  console.log("\n[1/6] Applying schema...");
  const cypher = fs.readFileSync(path.join(__dirname, "schema.cypher"), "utf-8");
  const statements = cypher
    .split("\n")
    .filter(l => !l.startsWith("//") && l.trim())
    .join(" ")
    .split(";")
    .map(s => s.trim())
    .filter(s => s && !s.startsWith("//") && !s.startsWith("DROP"));

  for (const stmt of statements) {
    await session.run(stmt).catch(e => {
      if (!e.message.includes("already exists")) console.warn("  Schema warn:", e.message);
    });
  }
  console.log("  ✓ Schema applied");
}

// ── 2. Merge Duplicate VS Constituencies ────────────────────
async function mergeVSConstituencies(session) {
  console.log("\n[2/6] Merging duplicate VidhanSabhaConstituency nodes...");

  // Find old nodes (vs_id exists, ac_no is null) and new nodes (ac_no exists)
  // Extract ac_no from vs_id pattern "VS_<num>_2022"
  const result = await session.run(`
    MATCH (old:VidhanSabhaConstituency)
    WHERE old.vs_id IS NOT NULL AND old.ac_no IS NULL
    WITH old, toInteger(split(old.vs_id, '_')[1]) AS acNo
    MATCH (new:VidhanSabhaConstituency {ac_no: acNo})
    RETURN old.vs_id AS vsId, acNo, old.name AS oldName, new.name AS newName,
           id(old) AS oldId, id(new) AS newId
    LIMIT 5
  `);

  const count = await session.run(`
    MATCH (old:VidhanSabhaConstituency)
    WHERE old.vs_id IS NOT NULL AND old.ac_no IS NULL
    RETURN count(old) AS cnt
  `);
  const dupeCount = count.records[0].get("cnt").toNumber();
  console.log(`  Found ${dupeCount} old nodes to merge`);

  if (dupeCount === 0) {
    console.log("  ✓ No duplicates found");
    return;
  }

  // Copy properties from old → new, move relationships, delete old
  await session.run(`
    MATCH (old:VidhanSabhaConstituency)
    WHERE old.vs_id IS NOT NULL AND old.ac_no IS NULL
    WITH old, toInteger(split(old.vs_id, '_')[1]) AS acNo
    MATCH (new:VidhanSabhaConstituency {ac_no: acNo})
    SET new.vs_id        = old.vs_id,
        new.vs_name      = coalesce(new.vs_name, old.vs_name, old.name),
        new.constituency_type = coalesce(new.constituency_type, old.constituency_type),
        new.n_candidates = coalesce(new.n_candidates, old.n_candidates),
        new.name         = coalesce(new.name, old.name)
    WITH old, new
    CALL {
      WITH old, new
      MATCH (old)<-[r]-()
      WITH old, new, r, startNode(r) AS src, type(r) AS rtype, properties(r) AS rprops
      WHERE src <> new
      CALL apoc.create.relationship(src, rtype, rprops, new) YIELD rel
      RETURN count(rel) AS moved1
    }
    CALL {
      WITH old, new
      MATCH (old)-[r]->()
      WITH old, new, r, endNode(r) AS tgt, type(r) AS rtype, properties(r) AS rprops
      WHERE tgt <> new
      CALL apoc.create.relationship(new, rtype, rprops, tgt) YIELD rel
      RETURN count(rel) AS moved2
    }
    DETACH DELETE old
    RETURN count(old) AS deleted
  `).catch(async () => {
    // APOC not available — do simple property merge only
    await session.run(`
      MATCH (old:VidhanSabhaConstituency)
      WHERE old.vs_id IS NOT NULL AND old.ac_no IS NULL
      WITH old, toInteger(split(old.vs_id, '_')[1]) AS acNo
      MATCH (new:VidhanSabhaConstituency {ac_no: acNo})
      SET new.vs_id = old.vs_id,
          new.vs_name = coalesce(new.vs_name, old.vs_name, old.name),
          new.constituency_type = coalesce(new.constituency_type, old.constituency_type),
          new.n_candidates = coalesce(new.n_candidates, old.n_candidates),
          new.name = coalesce(new.name, old.name)
      DETACH DELETE old
    `);
  });

  const remaining = await session.run(
    "MATCH (n:VidhanSabhaConstituency) RETURN count(n) AS cnt"
  );
  console.log(`  ✓ Done. VidhanSabhaConstituency count: ${remaining.records[0].get("cnt").toNumber()}`);
}

// ── 3. Load Booths ───────────────────────────────────────────
async function loadBooths(session) {
  console.log("\n[3/6] Loading booth_master.csv...");
  const boothFile = path.join(ROOT, "data/booths/booth_master.csv");
  if (!fs.existsSync(boothFile)) {
    console.log("  SKIP: booth_master.csv not found");
    return;
  }

  const rows = readCsv(boothFile);
  console.log(`  ${rows.length} booth rows`);

  const BATCH = 500;
  let loaded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      ac_no: toInt(r.ac_no),
      booth_no: toInt(r.booth_no),
      booth_name: clean(r.booth_name),
      district: clean(r.district),
      constituency_name: clean(r.constituency_name),
      total_electors: toInt(r.total_electors),
      male_turnout: toInt(r.male_turnout),
      female_turnout: toInt(r.female_turnout),
      other_turnout: toInt(r.other_turnout),
      total_votes: toInt(r.total_votes_secured),
    })).filter(r => r.ac_no > 0 && r.booth_no > 0);

    await session.run(`
      UNWIND $batch AS b
      MERGE (booth:Booth {ac_no: b.ac_no, booth_no: b.booth_no})
      SET booth.name          = b.booth_name,
          booth.district      = b.district,
          booth.total_electors = b.total_electors,
          booth.male_turnout  = b.male_turnout,
          booth.female_turnout = b.female_turnout,
          booth.other_turnout = b.other_turnout,
          booth.total_votes   = b.total_votes,
          booth.election_year = 2022
      WITH booth, b
      MATCH (vs:VidhanSabhaConstituency {ac_no: b.ac_no})
      MERGE (booth)-[:IN_CONSTITUENCY]->(vs)
    `, { batch });

    loaded += batch.length;
    process.stdout.write(`  ${loaded}/${rows.length} booths...\r`);
  }
  console.log(`\n  ✓ ${loaded} booths loaded`);
}

// ── 4. Load Women Candidates ─────────────────────────────────
async function loadWomenCandidates(session) {
  console.log("\n[4/6] Loading women_candidates.csv...");
  const file = path.join(ROOT, "data/eci/vs2022/women_candidates.csv");
  if (!fs.existsSync(file)) { console.log("  SKIP: file not found"); return; }

  const rows = readCsv(file);
  console.log(`  ${rows.length} rows`);

  for (const r of rows) {
    const acNo = toInt(r["Constituency No."]);
    if (!acNo) continue;
    await session.run(`
      MERGE (cr:CandidateResult {ac_no: $acNo, candidate_name: $name})
      SET cr.party = $party,
          cr.sex = 'F',
          cr.votes = $votes,
          cr.vote_pct = $pct,
          cr.election_year = 2022
      WITH cr
      MATCH (vs:VidhanSabhaConstituency {ac_no: $acNo})
      MERGE (cr)-[:CONTESTED_IN]->(vs)
    `, {
      acNo: neo4j.int(acNo),
      name: clean(r["Candidate Name"]),
      party: clean(r["Party Name"] || r[" Party Name"] || ""),
      votes: neo4j.int(toInt(r["Total Valid Votes"] || r["Votes"] || 0)),
      pct: toFloat(r["% votes polled"] || 0),
    });
  }
  console.log(`  ✓ ${rows.length} women candidate records merged`);
}

// ── 5. Load TCPD Assembly Elections ──────────────────────────
async function loadTCPD_AE(session) {
  console.log("\n[5/6] Loading TCPD Assembly Elections (historical)...");
  const file = path.join(ROOT, "data/manual/TCPD_AE_Uttar_Pradesh_2026-5-3.csv.gz");
  if (!fs.existsSync(file)) { console.log("  SKIP: file not found"); return; }

  const rows = readCsvGz(file);
  console.log(`  ${rows.length} rows`);

  // Sample first row to see columns
  if (rows.length > 0) {
    console.log("  Columns:", Object.keys(rows[0]).join(", "));
  }

  const BATCH = 500;
  let loaded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      year: toInt(r.Year),
      ac_name: clean(r.Constituency_Name),
      ac_no: toInt(r.Constituency_No),
      candidate: clean(r.Candidate),
      party: clean(r.Party),
      votes: toInt(r.Votes),
      valid_votes: toInt(r.Valid_Votes),
      position: toInt(r.Position),
      is_winner: r.Position === "1",
      electors: toInt(r.Electors),
      turnout_pct: toFloat(r.Turnout_Percentage),
      vote_share_pct: toFloat(r.Vote_Share_Percentage),
      margin: toInt(r.Margin),
      sex: clean(r.Sex),
      age: toInt(r.Age),
      constituency_type: clean(r.Constituency_Type),
      district: clean(r.District_Name),
      incumbent: r.Incumbent === "TRUE",
      recontest: r.Recontest === "TRUE",
      pid: clean(r.pid),
    })).filter(r => r.year > 0 && r.ac_name);

    await session.run(`
      UNWIND $batch AS r
      MERGE (cr:HistoricalResult {pid: r.pid})
      SET cr.election_year   = r.year,
          cr.ac_no           = r.ac_no,
          cr.ac_name         = r.ac_name,
          cr.candidate_name  = r.candidate,
          cr.party           = r.party,
          cr.votes           = r.votes,
          cr.valid_votes     = r.valid_votes,
          cr.position        = r.position,
          cr.is_winner       = r.is_winner,
          cr.electors        = r.electors,
          cr.turnout_pct     = r.turnout_pct,
          cr.vote_share_pct  = r.vote_share_pct,
          cr.margin          = r.margin,
          cr.sex             = r.sex,
          cr.age             = r.age,
          cr.district        = r.district,
          cr.incumbent       = r.incumbent,
          cr.recontest       = r.recontest,
          cr.election_type   = 'AE'
      WITH cr, r
      WHERE r.ac_no > 0
      MATCH (vs:VidhanSabhaConstituency {ac_no: r.ac_no})
      MERGE (cr)-[:HISTORICAL_RESULT_IN]->(vs)
    `, { batch });

    loaded += batch.length;
    process.stdout.write(`  ${loaded}/${rows.length}...\r`);
  }
  console.log(`\n  ✓ ${loaded} assembly election historical records loaded`);
}

// ── 6. Load TCPD General Elections ───────────────────────────
async function loadTCPD_GE(session) {
  console.log("\n[6/6] Loading TCPD General Elections (historical)...");
  const file = path.join(ROOT, "data/manual/TCPD_GE_Uttar_Pradesh_2026-5-3.csv.gz");
  if (!fs.existsSync(file)) { console.log("  SKIP: file not found"); return; }

  const rows = readCsvGz(file);
  console.log(`  ${rows.length} rows`);

  if (rows.length > 0) {
    console.log("  Columns:", Object.keys(rows[0]).join(", "));
  }

  const BATCH = 500;
  let loaded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      year: toInt(r.Year),
      ls_name: clean(r.Constituency_Name),
      ls_no: toInt(r.Constituency_No),
      candidate: clean(r.Candidate),
      party: clean(r.Party),
      votes: toInt(r.Votes),
      valid_votes: toInt(r.Valid_Votes),
      position: toInt(r.Position),
      is_winner: r.Position === "1",
      electors: toInt(r.Electors),
      turnout_pct: toFloat(r.Turnout_Percentage),
      vote_share_pct: toFloat(r.Vote_Share_Percentage),
      margin: toInt(r.Margin),
      sex: clean(r.Sex),
      incumbent: r.Incumbent === "TRUE",
      pid: clean(r.pid),
    })).filter(r => r.year > 0 && r.ls_name);

    await session.run(`
      UNWIND $batch AS r
      MERGE (cr:HistoricalResult {pid: r.pid})
      SET cr.election_year  = r.year,
          cr.ls_no          = r.ls_no,
          cr.ls_name        = r.ls_name,
          cr.candidate_name = r.candidate,
          cr.party          = r.party,
          cr.votes          = r.votes,
          cr.valid_votes    = r.valid_votes,
          cr.position       = r.position,
          cr.is_winner      = r.is_winner,
          cr.electors       = r.electors,
          cr.turnout_pct    = r.turnout_pct,
          cr.vote_share_pct = r.vote_share_pct,
          cr.margin         = r.margin,
          cr.sex            = r.sex,
          cr.incumbent      = r.incumbent,
          cr.election_type  = 'GE'
      WITH cr, r
      WHERE r.ls_no > 0
      MATCH (ls:LokSabhaConstituency {constituency_no: r.ls_no})
      MERGE (cr)-[:HISTORICAL_RESULT_IN]->(ls)
    `, { batch });

    loaded += batch.length;
    process.stdout.write(`  ${loaded}/${rows.length}...\r`);
  }
  console.log(`\n  ✓ ${loaded} general election historical records loaded`);
}

// ── Summary ───────────────────────────────────────────────────
async function printSummary(session) {
  console.log("\n=== NEO4J GRAPH SUMMARY ===");
  const result = await session.run(`
    CALL {
      MATCH (n:VidhanSabhaConstituency) RETURN 'VidhanSabhaConstituency' AS label, count(n) AS cnt
      UNION ALL MATCH (n:Booth) RETURN 'Booth', count(n)
      UNION ALL MATCH (n:CandidateResult) RETURN 'CandidateResult', count(n)
      UNION ALL MATCH (n:HistoricalResult) RETURN 'HistoricalResult', count(n)
      UNION ALL MATCH (n:LokSabhaConstituency) RETURN 'LokSabhaConstituency', count(n)
      UNION ALL MATCH (n:District) RETURN 'District', count(n)
      UNION ALL MATCH (n:LeaderEntity) RETURN 'LeaderEntity', count(n)
      UNION ALL MATCH (n:Party) RETURN 'Party', count(n)
      UNION ALL MATCH (n:Strategy) RETURN 'Strategy', count(n)
      UNION ALL MATCH (n:SentimentObservation) RETURN 'SentimentObservation', count(n)
    }
    RETURN label, cnt ORDER BY cnt DESC
  `);
  result.records.forEach(r =>
    console.log(`  ${r.get("label").padEnd(28)} ${r.get("cnt").toNumber().toLocaleString()}`)
  );
  const rels = await session.run("MATCH ()-[r]->() RETURN count(r) AS cnt");
  console.log(`  ${"Relationships".padEnd(28)} ${rels.records[0].get("cnt").toNumber().toLocaleString()}`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const session = driver.session();
  try {
    await applySchema(session);
    await mergeVSConstituencies(session);
    await loadBooths(session);
    await loadWomenCandidates(session);
    await loadTCPD_AE(session);
    await loadTCPD_GE(session);
    await printSummary(session);
    console.log("\n✅ All data loaded successfully");
  } catch (e) {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
