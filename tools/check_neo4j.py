from neo4j import GraphDatabase

import os
driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI", "neo4j://localhost:7687"), 
    auth=(os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD"))
)
session = driver.session()

result = session.run("""
    MATCH (o:SentimentObservation)
    RETURN count(o) as count,
           collect(DISTINCT o.sentiment_label) as labels,
           collect(DISTINCT o.detected_language) as langs
""")
row = result.single()
print(f"Observations: {row['count']}")
print(f"Labels: {row['labels']}")
print(f"Languages: {row['langs']}")

session.close()
driver.close()
