import json
import os


# Anchor path to project root (3 levels up: processors -> src -> sentiment_engine -> project root)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ALIAS_FILE = os.path.join(_PROJECT_ROOT, "data", "aliases", "up_entities.json")

with open(ALIAS_FILE, "r", encoding="utf-8") as f:
    ENTITY_DATA = json.load(f)

ALIASES = {}
ENTITY_TYPES = {}
ENTITY_IDS = {}
ENTITY_MAP = {}

for entity in ENTITY_DATA:
    eid = entity["entity_id"]
    etype = entity["entity_type"]
    ENTITY_MAP[eid] = entity
    for alias in entity.get("aliases", []):
        ALIASES[alias.lower()] = eid
        ENTITY_TYPES[alias.lower()] = etype
        ENTITY_IDS[alias.lower()] = eid


def resolve_entities(text):
    """Match text mentions to known entities via alias database per PRD 2.3.4"""
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
    return ENTITY_DATA
