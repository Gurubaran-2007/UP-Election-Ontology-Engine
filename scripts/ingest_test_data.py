#!/usr/bin/env python3
"""Quick script to ingest test sentiment data for UP-01 (Saharanpur)
Run: python scripts/ingest_test_data.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Add sentiment_engine to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sentiment_engine'))

print("Ingesting test sentiment data for UP-01 (Saharanpur)...")

# Sample articles with sentiment
test_articles = [
    {
        "text": "BJP government has done excellent work in Saharanpur with new roads and infrastructure development",
        "url": "http://test.com/article1",
        "published_at": "2026-05-01",
        "source_type": "news",
        "language": "en",
        "entities": [{"entity_id": "party-bjp", "entity_type": "party", "matched_alias": "BJP"}],
        "sentiment": "positive",
        "confidence": 0.85,
        "topic": "development",
        "geographic_scope": "constituency",
        "constituency_id": "UP-01",
        "model_version": "distilbert-multilingual-v2.0",
    },
    {
        "text": "Yogi Adityanath ji ne Saharanpur mein bahut achha kaam kiya hai, log khush hain",
        "url": "http://test.com/article2",
        "published_at": "2026-05-02",
        "source_type": "news",
        "language": "hi",
        "entities": [{"entity_id": "leader-yogi-adityanath", "entity_type": "leader", "matched_alias": "Yogi Adityanath"}],
        "sentiment": "positive",
        "confidence": 0.78,
        "topic": "development",
        "geographic_scope": "constituency",
        "constituency_id": "UP-01",
        "model_version": "distilbert-multilingual-v2.0",
    },
    {
        "text": "Unemployment is still a major issue in Saharanpur, youth are struggling for jobs",
        "url": "http://test.com/article3",
        "published_at": "2026-05-03",
        "source_type": "news",
        "language": "en",
        "entities": [{"entity_id": "party-bjp", "entity_type": "party", "matched_alias": "BJP"}],
        "sentiment": "negative",
        "confidence": 0.72,
        "topic": "unemployment",
        "geographic_scope": "constituency",
        "constituency_id": "UP-01",
        "model_version": "distilbert-multilingual-v2.0",
    },
    {
        "text": "SP chief Akhilesh Yadav says BJP failed to deliver on promises in Saharanpur",
        "url": "http://test.com/article4",
        "published_at": "2026-05-04",
        "source_type": "news",
        "language": "en",
        "entities": [
            {"entity_id": "leader-akhilesh-yadav", "entity_type": "leader", "matched_alias": "Akhilesh Yadav"},
            {"entity_id": "party-sp", "entity_type": "party", "matched_alias": "SP"}
        ],
        "sentiment": "negative",
        "confidence": 0.68,
        "topic": "development",
        "geographic_scope": "constituency",
        "constituency_id": "UP-01",
        "model_version": "distilbert-multilingual-v2.0",
    },
    {
        "text": "Mayawati visits Saharanpur, BSP gaining ground in western UP",
        "url": "http://test.com/article5",
        "published_at": "2026-05-05",
        "source_type": "news",
        "language": "en",
        "entities": [{"entity_id": "leader-mayawati", "entity_type": "leader", "matched_alias": "Mayawati"}],
        "sentiment": "positive",
        "confidence": 0.65,
        "topic": "development",
        "geographic_scope": "constituency",
        "constituency_id": "UP-01",
        "model_version": "distilbert-multilingual-v2.0",
    },
]

try:
    from sentiment_engine.neo4j_ingest import upsert_sentiment_observation, compute_constituency_aggregation

    ingested = 0
    for article in test_articles:
        try:
            obs_id = upsert_sentiment_observation(article)
            print(f"[OK] Ingested: {obs_id} -> {article['sentiment']} ({article['topic']})")
            ingested += 1
        except Exception as e:
            print(f"[ERR] Error ingesting: {e}")

    print(f"\nTotal ingested: {ingested}/{len(test_articles)}")

    # Compute aggregation
    print("\nComputing aggregation for UP-01...")
    result = compute_constituency_aggregation("UP-01", "party-bjp", 7)
    if result:
        print("[OK] Aggregation computed:")
        print(f"   positive_pct: {result['positive_pct']}%")
        print(f"   negative_pct: {result['negative_pct']}%")
        print(f"   dominant: {result['dominant_sentiment']}")
    else:
        print("[WARN] No aggregation data yet")

    print("\n[OK] Done! Now visit http://localhost:3000 and click Sentiment Analysis tab")

except Exception as e:
    print(f"[ERR] FAILED: {e}")
    print("Make sure Neo4j is running and sentiment_engine/ modules are correct")
