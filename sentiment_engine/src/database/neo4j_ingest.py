import hashlib
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sentiment_engine.config.settings import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
from neo4j import GraphDatabase

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def _generate_observation_id(text, source_url, timestamp):
    raw = f"{text}|{source_url}|{timestamp}"
    return "OBS-" + hashlib.sha256(raw.encode()).hexdigest()[:12]


def upsert_sentiment_observation(obs):
    """Create or update SentimentObservation node per PRD Part 3 schema"""
    obs_id = _generate_observation_id(
        obs.get("text", ""), obs.get("url", ""), obs.get("published_at", "")
    )

    entities = obs.get("entities", [])
    entities_json = json.dumps(entities)

    entity_id = entities[0]["entity_id"] if entities else "unknown"
    entity_type = entities[0]["entity_type"] if entities else "unknown"

    with driver.session() as session:
        session.run(
            """
            MERGE (o:SentimentObservation {obs_id: $obs_id})
            SET o.source_type = $source_type,
                o.source_url = $source_url,
                o.source_date = date($source_date),
                o.text_excerpt = $text_excerpt,
                o.language = $language,
                o.entity_id = $entity_id,
                o.entity_type = $entity_type,
                o.sentiment = $sentiment,
                o.confidence = $confidence,
                o.topic = $topic,
                o.geographic_scope = $geographic_scope,
                o.constituency_id = $constituency_id,
                o.booth_id = $booth_id,
                o.model_version = $model_version,
                o.vader_score = $vader_score,
                o.vader_label = $vader_label,
                o.ingested_at = datetime()
            """,
            obs_id=obs_id,
            source_type=obs.get("source_type", "news"),
            source_url=obs.get("url", ""),
            source_date=obs.get("published_at", "2026-01-01")[:10],
            text_excerpt=str(obs.get("text", ""))[:5000],
            language=obs.get("language", "en"),
            entity_id=entity_id,
            entity_type=entity_type,
            sentiment=obs.get("sentiment", "neutral"),
            confidence=float(obs.get("confidence", 0.5)),
            topic=obs.get("topic", "general"),
            geographic_scope=obs.get("geographic_scope", "constituency"),
            constituency_id=obs.get("constituency_id", ""),
            booth_id=obs.get("booth_id", None),
            model_version=obs.get("model_version", "distilbert-multilingual-v2.0"),
            vader_score=obs.get("vader_score", None),
            vader_label=obs.get("vader_label", None),
        )

        if entities:
            for entity in entities:
                eid = entity.get("entity_id")
                if eid and eid != "unknown":
                    session.run(
                        """
                        MATCH (o:SentimentObservation {obs_id: $obs_id})
                        MATCH (e:LeaderEntity {entity_id: $eid})
                        MERGE (o)-[r:MENTIONS {
                            observation_id: $obs_id,
                            alias_matched: $alias,
                            mention_confidence: $conf
                        }]->(e)
                        """,
                        obs_id=obs_id,
                        eid=eid,
                        alias=entity.get("matched_alias", ""),
                        conf=float(obs.get("confidence", 0.5)),
                    )

        const_id = obs.get("constituency_id")
        if const_id:
            session.run(
                """
                MATCH (o:SentimentObservation {obs_id: $obs_id})
                MATCH (c:LokSabhaConstituency {ls_id: $const_id})
                MERGE (o)-[:ABOUT_CONSTITUENCY]->(c)
                """,
                obs_id=obs_id,
                const_id=const_id,
            )

        booth_id = obs.get("booth_id")
        if booth_id:
            session.run(
                """
                MATCH (o:SentimentObservation {obs_id: $obs_id})
                MATCH (b:Booth {booth_id: $booth_id})
                MERGE (o)-[:ABOUT_BOOTH]->(b)
                """,
                obs_id=obs_id,
                booth_id=booth_id,
            )

    return obs_id


def compute_constituency_aggregation(constituency_id, entity_id, time_window_days=7):
    """Compute SentimentAggregation per PRD Part 3 schema"""
    with driver.session() as session:
        result = session.run(
            """
            MATCH (obs:SentimentObservation)
            WHERE obs.constituency_id = $constituency_id
              AND obs.entity_id = $entity_id
              AND obs.source_date >= date() - duration({days: $days})
            RETURN
              obs.constituency_id AS constituency_id,
              obs.entity_id AS entity_id,
              COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS positive_count,
              COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
              COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neutral_count,
              COUNT(obs) AS total_count
            """,
            constituency_id=constituency_id,
            entity_id=entity_id,
            days=time_window_days,
        )
        record = result.single()
        if not record:
            return None

        total = record["total_count"]
        if total == 0:
            return None

        positive_pct = round(100.0 * record["positive_count"] / total, 2)
        negative_pct = round(100.0 * record["negative_count"] / total, 2)
        neutral_pct = round(100.0 * record["neutral_count"] / total, 2)

        dominant = "positive" if positive_pct > negative_pct and positive_pct > neutral_pct else (
            "negative" if negative_pct > positive_pct and negative_pct > neutral_pct else "neutral"
        )

        trending = _compute_trending(session, constituency_id, entity_id)

        agg_id = f"AGG-{constituency_id}-{entity_id}-{time_window_days}d"

        session.run(
            """
            MERGE (a:SentimentAggregation {agg_id: $agg_id})
            SET a.constituency_id = $constituency_id,
                a.entity_id = $entity_id,
                a.time_window = $time_window,
                a.positive_count = $positive_count,
                a.negative_count = $negative_count,
                a.neutral_count = $neutral_count,
                a.total_count = $total_count,
                a.positive_pct = $positive_pct,
                a.negative_pct = $negative_pct,
                a.neutral_pct = $neutral_pct,
                a.dominant_sentiment = $dominant,
                a.trending = $trending,
                a.computed_at = datetime()
            """,
            agg_id=agg_id,
            constituency_id=constituency_id,
            entity_id=entity_id,
            time_window=_days_to_window(time_window_days),
            positive_count=record["positive_count"],
            negative_count=record["negative_count"],
            neutral_count=record["neutral_count"],
            total_count=total,
            positive_pct=positive_pct,
            negative_pct=negative_pct,
            neutral_pct=neutral_pct,
            dominant=dominant,
            trending=trending,
        )

        return {
            "agg_id": agg_id,
            "constituency_id": constituency_id,
            "entity_id": entity_id,
            "positive_pct": positive_pct,
            "negative_pct": negative_pct,
            "neutral_pct": neutral_pct,
            "total_count": total,
            "dominant_sentiment": dominant,
            "trending": trending,
        }


def _compute_trending(session, constituency_id, entity_id):
    """Compute trending direction per PRD 2.5"""
    result = session.run(
        """
        WITH $constituency_id AS cid, $entity_id AS eid
        MATCH (obs:SentimentObservation)
        WHERE obs.constituency_id = cid AND obs.entity_id = eid
        WITH
          COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= date() - duration({days: 7}) THEN 1 END) AS recent_pos,
          COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= date() - duration({days: 14}) AND obs.source_date < date() - duration({days: 7}) THEN 1 END) AS prev_pos,
          COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= date() - duration({days: 7}) THEN 1 END) AS recent_neg,
          COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= date() - duration({days: 14}) AND obs.source_date < date() - duration({days: 7}) THEN 1 END) AS prev_neg
        RETURN recent_pos, prev_pos, recent_neg, prev_neg
        """,
        constituency_id=constituency_id,
        entity_id=entity_id,
    )
    record = result.single()
    if not record:
        return "stable"

    recent_pos = record["recent_pos"]
    prev_pos = record["prev_pos"]
    recent_neg = record["recent_neg"]
    prev_neg = record["prev_neg"]

    if (recent_pos > prev_pos * 1.2) and (recent_neg < prev_neg):
        return "improving"
    elif (recent_pos < prev_pos * 0.8) and (recent_neg > prev_neg * 1.2):
        return "declining"
    elif abs(recent_pos - prev_pos) < 0.1 * max(prev_pos, 1):
        return "stable"
    else:
        return "volatile"


def _days_to_window(days):
    if days <= 1:
        return "last_24h"
    elif days <= 7:
        return "last_7d"
    elif days <= 30:
        return "last_30d"
    elif days <= 90:
        return "last_90d"
    else:
        return "all_time"


def close():
    driver.close()
