// ============================================================
// UP Election Ontology Engine — Neo4j Schema
// Run this ONCE on a fresh database before any seed scripts.
// All statements use IF NOT EXISTS so they are safe to re-run.
// ============================================================

// ── Drop legacy constraints replaced by ac_no ───────────────
// (Comment out if this is a fresh DB with no existing data)
// DROP CONSTRAINT constraint_782341be IF EXISTS;

// ── Uniqueness Constraints ───────────────────────────────────

CREATE CONSTRAINT vs_ac_no_unique IF NOT EXISTS
  FOR (n:VidhanSabhaConstituency) REQUIRE n.ac_no IS UNIQUE;

CREATE CONSTRAINT district_name_unique IF NOT EXISTS
  FOR (n:District) REQUIRE n.name IS UNIQUE;

CREATE CONSTRAINT ls_id_unique IF NOT EXISTS
  FOR (n:LokSabhaConstituency) REQUIRE n.ls_id IS UNIQUE;

CREATE CONSTRAINT leader_entity_id_unique IF NOT EXISTS
  FOR (n:LeaderEntity) REQUIRE n.entity_id IS UNIQUE;

CREATE CONSTRAINT party_name_unique IF NOT EXISTS
  FOR (n:Party) REQUIRE n.name IS UNIQUE;

CREATE CONSTRAINT strategy_id_unique IF NOT EXISTS
  FOR (n:Strategy) REQUIRE n.strategy_id IS UNIQUE;

CREATE CONSTRAINT sentiment_obs_id_unique IF NOT EXISTS
  FOR (n:SentimentObservation) REQUIRE n.obs_id IS UNIQUE;

// ── Indexes ──────────────────────────────────────────────────

CREATE INDEX vs_name_idx IF NOT EXISTS
  FOR (n:VidhanSabhaConstituency) ON (n.name);

CREATE INDEX vs_district_idx IF NOT EXISTS
  FOR (n:VidhanSabhaConstituency) ON (n.district);

CREATE INDEX vs_winner_party_idx IF NOT EXISTS
  FOR (n:VidhanSabhaConstituency) ON (n.winner_party);

CREATE INDEX booth_ac_no_idx IF NOT EXISTS
  FOR (n:Booth) ON (n.ac_no);

CREATE INDEX booth_no_idx IF NOT EXISTS
  FOR (n:Booth) ON (n.booth_no);

CREATE INDEX candidate_result_ac_idx IF NOT EXISTS
  FOR (n:CandidateResult) ON (n.ac_no);

CREATE INDEX candidate_result_party_idx IF NOT EXISTS
  FOR (n:CandidateResult) ON (n.party);

CREATE INDEX leader_party_idx IF NOT EXISTS
  FOR (n:LeaderEntity) ON (n.party);

CREATE INDEX sentiment_entity_idx IF NOT EXISTS
  FOR (n:SentimentObservation) ON (n.entity_id);

CREATE INDEX sentiment_date_idx IF NOT EXISTS
  FOR (n:SentimentObservation) ON (n.observed_at);
