#!/usr/bin/env python
"""
Phase 1 Sentiment Pipeline:
  NewsData API -> Language Detection -> Sentiment Classification -> Entity Resolution -> Neo4j
"""
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
# Add the project root (one level up from scripts/) to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sentiment_engine.src.collectors.newsdata import poll_all_queries
from sentiment_engine.src.processors.sentiment import classify_sentiment
from sentiment_engine.src.processors.entity_resolution import resolve_entities
from sentiment_engine.src.database.neo4j_ingest import (
    upsert_sentiment_observation,
    upsert_issue_observation,
    compute_constituency_aggregation,
    close,
)
from sentiment_engine.src.alerts.alert_engine import check_alerts

MAX_NEWS_ARTICLES = 20

def run_pipeline():
    print("[PIPELINE] Starting Phase 1 sentiment pipeline...")

    print("[PIPELINE] Fetching news articles...")
    articles = poll_all_queries(max_results=3)
    articles = articles[:MAX_NEWS_ARTICLES]
    print(f"[PIPELINE] Fetched {len(articles)} articles")

    if not articles:
        print("[PIPELINE] No articles found. Exiting.")
        return

    count = 0
    aggregation_pairs = set()  # (constituency_id, entity_id) for post-loop aggregation

    for i, article in enumerate(articles):
        text = f"{article.get('title', '')}. {article.get('description', '')}"
        if not text.strip():
            continue

        print(f"[SENTIMENT] Analyzing article {i+1}/{len(articles)}: {article.get('title', '')[:60]}...")
        sentiment = classify_sentiment(text)
        entities = resolve_entities(text)

        obs = {
            "text": text[:5000],
            "url": article.get('url', ''),
            "published_at": article.get('published_at', ''),
            "source_type": "news",
            "language": sentiment.get('language', 'en'),
            "entities": entities,
            "sentiment": sentiment.get('sentiment', 'neutral'),
            "confidence": sentiment.get('confidence', 0.5),
            "topic": sentiment.get('topic', 'general'),
            "geographic_scope": "booth" if article.get('booth_id') else "constituency",
            "constituency_id": article.get('constituency', ''),
            "booth_id": article.get('booth_id', None),
            "model_version": sentiment.get('model', 'distilbert-multilingual-v2.0'),
            "vader_score": sentiment.get('vader_score'),
            "vader_label": sentiment.get('vader_label')
        }

        try:
            upsert_sentiment_observation(obs)
            count += 1
            print(f"  -> {obs['sentiment']} ({obs['confidence']:.2%}) [{obs['language']}]")

            # Queue aggregation for each constituency × entity pair
            cid = obs.get("constituency_id")
            for ent in entities:
                eid = ent.get("entity_id")
                if cid and eid:
                    aggregation_pairs.add((cid, eid))

            # Create IssueObservation if topic is recognisable
            upsert_issue_observation(obs)

        except Exception as e:
            print(f"  -> Error ingesting: {e}")

    print(f"[NEO4J] Successfully ingested {count} observations")

    # Aggregate sentiment per constituency × entity
    print(f"[NEO4J] Computing SentimentAggregation for {len(aggregation_pairs)} pairs...")
    agg_count = 0
    for cid, eid in aggregation_pairs:
        try:
            result = compute_constituency_aggregation(cid, eid)
            if result:
                agg_count += 1
        except Exception as e:
            print(f"  -> Aggregation error ({cid}, {eid}): {e}")
    print(f"[NEO4J] Computed {agg_count} SentimentAggregation nodes")

    print("[ALERTS] Checking alert rules...")
    try:
        alerts = check_alerts()
        high = [a for a in alerts if a["severity"] == "HIGH"]
        print(f"[ALERTS] {len(alerts)} alerts triggered ({len(high)} HIGH severity)")
        for a in high:
            print(f"  [HIGH] {a['alert_id']}: {a['message']}")
    except Exception as e:
        print(f"[ALERTS] Error running alert engine: {e}")

    close()
    print("[PIPELINE] Done.")

if __name__ == "__main__":
    run_pipeline()
