"""Load entity aliases into Neo4j per PRD 4.5"""
from neo4j import GraphDatabase
import json
import os

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "guru@9114")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def load_entities(json_path: str):
    """Load entities from JSON and create LeaderEntity nodes per PRD 3.1.3"""
    with open(json_path, 'r', encoding='utf-8') as f:
        entities = json.load(f)

    with driver.session() as session:
        # Create constraint if not exists
        try:
            session.run("CREATE CONSTRAINT leader_entity_unique_id IF NOT EXISTS FOR (l:LeaderEntity) REQUIRE l.entity_id IS UNIQUE")
            session.run("CREATE INDEX leader_entity_search IF NOT EXISTS FOR (l:LeaderEntity) ON EACH [l.name, l.aliases]")
        except Exception as e:
            print(f"Constraint/index may already exist: {e}")

        # Load entities
        for entity in entities:
            session.run(
                """
                MERGE (e:LeaderEntity {entity_id: $entity_id})
                SET e.name = $name,
                    e.aliases = $aliases,
                    e.entity_type = $entity_type,
                    e.level = $level,
                    e.party = $party
                """,
                entity_id=entity['entity_id'],
                name=entity['name'],
                aliases=entity.get('aliases', []),
                entity_type=entity['entity_type'],
                level=entity.get('level', 'unknown'),
                party=entity.get('party', ''),
            )
            print(f"Loaded entity: {entity['name']} ({entity['entity_id']})")

    print(f"\nLoaded {len(entities)} entities into Neo4j")


def create_sentiment_constraints():
    """Create Neo4j constraints and indexes per PRD 3.1"""
    with driver.session() as session:
        constraints = [
            "CREATE CONSTRAINT sentiment_observation_unique_id IF NOT EXISTS FOR (s:SentimentObservation) REQUIRE s.obs_id IS UNIQUE",
            "CREATE INDEX sentiment_observation_source_type IF NOT EXISTS FOR (s:SentimentObservation) ON (s.source_type)",
            "CREATE INDEX sentiment_observation_constituency IF NOT EXISTS FOR (s:SentimentObservation) ON (s.constituency_id)",
            "CREATE INDEX sentiment_observation_entity IF NOT EXISTS FOR (s:SentimentObservation) ON (s.entity_id)",
            "CREATE INDEX sentiment_observation_date IF NOT EXISTS FOR (s:SentimentObservation) ON (s.source_date)",
            "CREATE CONSTRAINT sentiment_aggregation_unique_id IF NOT EXISTS FOR (a:SentimentAggregation) REQUIRE a.agg_id IS UNIQUE",
            "CREATE INDEX sentiment_aggregation_constituency IF NOT EXISTS FOR (a:SentimentAggregation) ON (a.constituency_id)",
            "CREATE INDEX sentiment_aggregation_entity IF NOT EXISTS FOR (a:SentimentAggregation) ON (a.entity_id)",
            "CREATE INDEX sentiment_aggregation_time_window IF NOT EXISTS FOR (a:SentimentAggregation) ON (a.time_window)",
        ]

        for constraint in constraints:
            try:
                session.run(constraint)
                print(f"Created: {constraint[:50]}...")
            except Exception as e:
                print(f"Skipped (may exist): {constraint[:50]}... Error: {e}")

        print("\nAll constraints and indexes created")


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
    else:
        json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'aliases', 'up_entities.json')

    print("Creating Neo4j constraints and indexes...")
    create_sentiment_constraints()

    print(f"\nLoading entities from {json_path}...")
    load_entities(json_path)

    driver.close()
    print("\nDone!")
