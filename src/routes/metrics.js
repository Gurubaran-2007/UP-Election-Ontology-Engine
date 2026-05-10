const express = require('express');
const router = express.Router();
const driver = require('../config/db');
const fs = require('fs');
const path = require('path');

const PARTY_ID_MAP = {
  'Bharatiya Janata Party': 'bjp',
  'Indian National Congress': 'inc',
  'Samajwadi Party': 'sp',
  'All India Trinamool Congress': 'tmc',
  'Dravida Munnetra Kazhagam': 'dmk',
  'Telugu Desam': 'tdp',
  'Janata Dal  (United)': 'jdu',
  'Janata Dal (United)': 'jdu',
  'Shiv Sena (Uddhav Balasaheb Thackrey)': 'ss_ub',
  'Shiv Sena': 'ss',
  'Bahujan Samaj Party': 'bsp',
  'Rashtriya Lok Dal': 'rld',
  'Apna Dal (Soneylal)': 'adal',
  'Yuvajana Sramika Rythu Congress Party': 'ysrcp',
  'Biju Janata Dal': 'bjd',
  'Aam Aadmi Party': 'aap',
  'Nationalist Congress Party – Sharadchandra Pawar': 'ncp_sp',
  'Nationalist Congress Party': 'ncp',
  'AJSU Party': 'ajsu',
  'Jharkhand Mukti Morcha': 'jmm',
  'Indian Union Muslim League': 'iuml',
  'Communist Party of India  (Marxist)': 'cpim',
  'Communist Party of India': 'cpi',
};

const PARTY_COLORS = {
  bjp: '#f97316', sp: '#e11d48', inc: '#2563eb', bsp: '#7c3aed',
  rld: '#10b981', tmc: '#0ea5e9', dmk: '#f43f5e', tdp: '#eab308',
  jdu: '#22c55e', adal: '#fb923c', ss: '#f59e0b', ss_ub: '#a78bfa',
  ysrcp: '#06b6d4', bjd: '#84cc16', aap: '#818cf8', ncp: '#92400e',
  ncp_sp: '#b45309', jmm: '#34d399', cpim: '#dc2626', cpi: '#ef4444',
  other: '#475569',
};

// ── GET /api/metrics/up/ls2024/by-district ─────────────────────────────────
// Returns district → [LS constituency result] for LS2024
let _upCache = null;
let _upCacheTs = 0;

router.get('/up/ls2024/by-district', async (req, res) => {
  if (_upCache && Date.now() - _upCacheTs < 3_600_000) return res.json(_upCache);
  try {
    const session = driver.session();
    const result = await session.run(`
      MATCH (d:District)-[:CONTAINS|HAS_LS]->(ls:LokSabhaConstituency)
            -[:HAS_RESULT]->(er:ElectionResult)
      WHERE er.election_id IN ['LS2024', 'LS2019']
      WITH d, ls, er ORDER BY er.election_id DESC
      WITH d, ls, head(collect(er)) AS er
      RETURN d.name               AS district,
             ls.ls_id             AS ls_id,
             ls.name              AS ls_name,
             er.election_id       AS election_id,
             er.winner            AS winner,
             er.winner_party_id   AS party_id,
             er.winner_vote_share AS vote_share,
             er.margin_pct        AS margin_pct
      ORDER BY d.name, ls.ls_id
    `);
    await session.close();

    const data = {};
    result.records.forEach(r => {
      const d = r.get('district');
      if (!data[d]) data[d] = [];
      data[d].push({
        ls_id:      r.get('ls_id'),
        ls_name:    r.get('ls_name'),
        winner:     r.get('winner'),
        party_id:   r.get('party_id'),
        vote_share: r.get('vote_share'),
        margin_pct: r.get('margin_pct'),
      });
    });

    // Count distinct LS seats per party (deduplicate across districts)
    const seen = new Set();
    const seats = {};
    Object.values(data).forEach(segs => {
      segs.forEach(s => {
        if (!seen.has(s.ls_id)) {
          seen.add(s.ls_id);
          seats[s.party_id] = (seats[s.party_id] || 0) + 1;
        }
      });
    });

    _upCache = { data, seats, party_colors: PARTY_COLORS };
    _upCacheTs = Date.now();
    res.json(_upCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/metrics/up/ls2024/classifications ────────────────────────────
// All 80 UP LS seats with SeatClassification fields for choropleth rendering.
// seat_status: tossup (<2%) | competitive (2-5%) | safe (>5%)
// turnout_trend / vote_share_trend: populated after compute_trends.js runs (null until then).
let _classCache = null;
let _classCacheTs = 0;

router.get('/up/ls2024/classifications', async (req, res) => {
  if (_classCache && Date.now() - _classCacheTs < 3_600_000) return res.json(_classCache);
  try {
    const session = driver.session();
    const result = await session.run(`
      MATCH (ls:LokSabhaConstituency)
      OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult {election_id: 'LS2024'})
      OPTIONAL MATCH (ls)-[:HAS_CLASSIFICATION]->(sc:SeatClassification {election_id: 'LS2024'})
      RETURN ls.ls_id             AS ls_id,
             ls.name              AS name,
             ls.region            AS region,
             er.winner            AS winner,
             er.winner_party_id   AS party_id,
             er.margin_pct        AS margin_pct,
             er.winner_vote_share AS vote_share,
             er.runner_up         AS runner_up,
             er.runner_up_party_id AS runner_up_party_id,
             sc.seat_status       AS seat_status,
             sc.turnout_trend     AS turnout_trend,
             sc.vote_share_trend  AS vote_share_trend
      ORDER BY ls.ls_id
    `);
    await session.close();

    const seats = result.records.map(r => ({
      ls_id:              r.get('ls_id'),
      name:               r.get('name'),
      region:             r.get('region'),
      winner:             r.get('winner'),
      party_id:           r.get('party_id'),
      margin_pct:         r.get('margin_pct'),
      vote_share:         r.get('vote_share'),
      runner_up:          r.get('runner_up'),
      runner_up_party_id: r.get('runner_up_party_id'),
      seat_status:        r.get('seat_status'),
      turnout_trend:      r.get('turnout_trend'),
      vote_share_trend:   r.get('vote_share_trend'),
    }));

    _classCache = { seats, party_colors: PARTY_COLORS };
    _classCacheTs = Date.now();
    res.json(_classCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/metrics/india/ls2024-summary ──────────────────────────────────
// Reads india_ls2024_winners.csv → per-state dominant party + national totals
let _indiaCache = null;

router.get('/india/ls2024-summary', (req, res) => {
  if (_indiaCache) return res.json(_indiaCache);

  const csvPath = path.join(__dirname, '..', '..', 'data', 'eci', 'india_ls2024_winners.csv');
  if (!fs.existsSync(csvPath)) return res.status(503).json({ error: 'india_ls2024_winners.csv not found' });

  const text = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  // Columns: State, PC No, PC Name, Winning Candidate, Winning Party, ...

  const stateSummary = {};
  const national = {};

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',');
    const state = cols[0]?.trim();
    const partyName = cols[4]?.trim();
    if (!state || !partyName) continue;
    const pid = PARTY_ID_MAP[partyName] || 'other';

    if (!stateSummary[state]) stateSummary[state] = { total: 0, parties: {}, dominant_party_id: '' };
    stateSummary[state].total++;
    stateSummary[state].parties[pid] = (stateSummary[state].parties[pid] || 0) + 1;
    national[pid] = (national[pid] || 0) + 1;
  }

  Object.values(stateSummary).forEach(info => {
    const sorted = Object.entries(info.parties).sort((a, b) => b[1] - a[1]);
    info.dominant_party_id = sorted[0]?.[0] || 'other';
  });

  _indiaCache = { data: stateSummary, national, party_colors: PARTY_COLORS };
  res.json(_indiaCache);
});

module.exports = router;
