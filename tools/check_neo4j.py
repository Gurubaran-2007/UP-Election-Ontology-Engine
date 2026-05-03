from neo4j import GraphDatabase

driver = GraphDatabase.driver("neo4j://localhost:7687", auth=("neo4j", "guru@9114"))
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
