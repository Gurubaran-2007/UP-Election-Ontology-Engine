import json
import os

from neo4j import GraphDatabase

# Anchor path to project root (3 levels up: processors -> src -> sentiment_engine -> project root)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ALIAS_FILE = os.path.join(_PROJECT_ROOT, "data", "aliases", "up_entities.json")

with open(ALIAS_FILE, "r", encoding="utf-8") as f:
    ENTITY_DATA = json.load(f)

# ── Build in-memory alias map from JSON file (primary source) ────────────────
ALIASES = {}
ENTITY_TYPES = {}
ENTITY_MAP = {}

for entity in ENTITY_DATA:
    eid = entity["entity_id"]
    etype = entity["entity_type"]
    ENTITY_MAP[eid] = entity
    for alias in entity.get("aliases", []):
        ALIASES[alias.lower()] = eid
        ENTITY_TYPES[alias.lower()] = etype

# ── Load additional aliases from Neo4j at startup (enriches JSON base) ───────
def _load_neo4j_aliases():
    """Pull aliases stored on LeaderEntity and Party nodes in Neo4j and merge
    them into the in-memory alias map so the sentiment pipeline automatically
    picks up any entities added via the seed script or admin tools."""
    try:
        _driver = GraphDatabase.driver(
            os.getenv("NEO4J_URI", "neo4j://localhost:7687"),
            auth=(os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD"))
        )
        with _driver.session() as s:
            result = s.run(
                """
                MATCH (n)
                WHERE (n:LeaderEntity OR n:Party)
                  AND n.aliases IS NOT NULL
                RETURN n.entity_id AS eid,
                       n.name      AS name,
                       n.entity_type AS etype,
                       n.party     AS party,
                       n.aliases   AS aliases
                """
            )
            count = 0
            for rec in result:
                eid   = rec["eid"]
                name  = rec["name"] or ""
                etype = rec["etype"] or "leader"
                party = rec["party"] or ""
                neo4j_aliases = rec["aliases"] or []

                # Add node to ENTITY_MAP if not already from JSON
                if eid not in ENTITY_MAP:
                    ENTITY_MAP[eid] = {
                        "entity_id": eid,
                        "name": name,
                        "entity_type": etype,
                        "party": party,
                        "aliases": neo4j_aliases,
                    }

                # Merge aliases
                for alias in neo4j_aliases:
                    a = alias.lower()
                    if a not in ALIASES:
                        ALIASES[a] = eid
                        ENTITY_TYPES[a] = etype
                        count += 1

        _driver.close()
        if count:
            print(f"[EntityResolution] Loaded {count} extra aliases from Neo4j.")
    except Exception as e:
        print(f"[EntityResolution] Neo4j alias load skipped: {e}")

_load_neo4j_aliases()


def resolve_entities(text):
    """Match text mentions to known entities via alias database per PRD 2.3.4.
    Checks both JSON-file aliases and aliases pulled from Neo4j at startup."""
    found = []
    seen_ids = set()
    text_lower = text.lower()

    for alias, eid in ALIASES.items():
        if alias in text_lower and eid not in seen_ids:
            entity_data = ENTITY_MAP.get(eid, {})
            found.append({
                "entity_id": eid,
                "entity_type": entity_data.get("entity_type", ENTITY_TYPES.get(alias, "unknown")).lower(),
                "matched_alias": alias,
                "entity_name": entity_data.get("name", ""),
                "party": entity_data.get("party", ""),
            })
            seen_ids.add(eid)

    return found


def resolve_entity_by_id(entity_id):
    """Get entity details by ID"""
    return ENTITY_MAP.get(entity_id)


def get_all_entities():
    """Return all entities for Neo4j loading"""
    return list(ENTITY_MAP.values())
