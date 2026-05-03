"""Booth-level sentiment disaggregation per PRD Phase 3"""
from neo4j import GraphDatabase
from sentiment_engine.config.settings import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def load_shrug_booth_data(csv_path):
    """Load SHRUG booth data into Neo4j per PRD 3.3.3"""
    import csv
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        with driver.session() as session:
            for row in reader:
                session.run(
                    """
                    MERGE (b:Booth {booth_id: $booth_id})
                    SET b.booth_id = $booth_id,
                        b.constituency_id = $constituency_id,
                        b.village_name = $village_name,
                        b.village_code = $village_code,
                        b.district = $district,
                        b.population = toInteger($population),
                        b.literacy_rate = toFloat($literacy_rate),
                        b.urban_ratio = toFloat($urban_ratio),
                        b.socioeconomic_index = toFloat($socioeconomic_index),
                        b.total_voters = toInteger($total_voters)
                    """,
                    booth_id=row.get('booth_id', ''),
                    constituency_id=row.get('constituency_id', ''),
                    village_name=row.get('village_name', ''),
                    village_code=row.get('village_code', ''),
                    district=row.get('district', ''),
                    population=int(row.get('population', 0)),
                    literacy_rate=float(row.get('literacy_rate', 0.0)),
                    urban_ratio=float(row.get('urban_ratio', 0.0)),
                    socioeconomic_index=float(row.get('socioeconomic_index', 0.0)),
                    total_voters=int(row.get('total_voters', 0)),
                )


def compute_booth_sentiment(constituency_id, entity_id, time_window='last_7d'):
    """Disaggregate constituency sentiment to booth level per PRD 2.4"""
    days_map = {'last_7d': 7, 'last_30d': 30, 'last_90d': 90}
    days = days_map.get(time_window, 7)

    with driver.session() as session:
        # Get constituency-level sentiment
        const_result = session.run(
            """
            MATCH (obs:SentimentObservation)
            WHERE obs.constituency_id = $cid
              AND obs.entity_id = $eid
              AND obs.source_date >= date() - duration({days: $days})
            RETURN
              COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS positive_count,
              COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
              COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neutral_count,
              COUNT(obs) AS total_count
            """,
            cid=constituency_id, eid=entity_id, days=days
        )
        const_record = const_result.single()
        if not const_record or const_record['total_count'] == 0:
            return []

        const_total = const_record['total_count']
        const_pos_pct = 100.0 * const_record['positive_count'] / const_total
        const_neg_pct = 100.0 * const_record['negative_count'] / const_total
        const_neu_pct = 100.0 * const_record['neutral_count'] / const_total

        # Get constituency demographic averages
        demo_result = session.run(
            """
            MATCH (ls:LokSabhaConstituency {ls_id: $cid})
            OPTIONAL MATCH (vs:VidhanSabhaConstituency)-[:WITHIN_LS]->(ls)
            OPTIONAL MATCH (b:Booth)-[:WITHIN_VS]->(vs)
            WITH
                avg(b.literacy_rate) AS avg_literacy,
                avg(b.urban_ratio) AS avg_urban,
                avg(b.population) AS avg_population,
                avg(b.socioeconomic_index) AS avg_socioeconomic
            RETURN avg_literacy, avg_urban, avg_population, avg_socioeconomic
            """,
            cid=constituency_id
        )
        demo_record = demo_result.single()
        if not demo_record:
            return []

        avg_lit = demo_record['avg_literacy'] or 0.0
        avg_urb = demo_record['avg_urban'] or 0.0
        avg_pop = demo_record['avg_population'] or 1.0
        avg_soc = demo_record['avg_socioeconomic'] or 0.0

        # Get all booths and compute weighted sentiment
        booth_result = session.run(
            """
            MATCH (ls:LokSabhaConstituency {ls_id: $cid})
            MATCH (vs:VidhanSabhaConstituency)-[:WITHIN_LS]->(ls)
            MATCH (b:Booth)-[:WITHIN_VS]->(vs)
            RETURN b.booth_id AS booth_id, b.literacy_rate AS literacy,
                   b.urban_ratio AS urban, b.population AS population,
                   b.socioeconomic_index AS socioeconomic
            """,
            cid=constituency_id
        )

        booth_sentiments = []
        for record in booth_result:
            booth_id = record['booth_id']
            lit = record['literacy'] or 0.0
            urb = record['urban'] or 0.0
            pop = record['population'] or 1.0
            soc = record['socioeconomic'] or 0.0

            # Weighted distribution per PRD 2.4.1
            w_lit = 0.25 * (lit / avg_lit) if avg_lit > 0 else 0.25
            w_urb = 0.30 * (urb / avg_urb) if avg_urb > 0 else 0.30
            w_pop = 0.20 * (pop / avg_pop) if avg_pop > 0 else 0.20
            w_soc = 0.25 * (soc / avg_soc) if avg_soc > 0 else 0.25

            total_weight = w_lit + w_urb + w_pop + w_soc

            weighted_pos = const_pos_pct * total_weight
            weighted_neg = const_neg_pct * total_weight
            weighted_neu = const_neu_pct * total_weight

            # Store booth-level aggregation
            agg_id = f"BOOTH-{booth_id}-{entity_id}-{time_window}"
            session.run(
                """
                MERGE (agg:SentimentAggregation {agg_id: $agg_id})
                SET agg.booth_id = $booth_id,
                    agg.constituency_id = $constituency_id,
                    agg.entity_id = $entity_id,
                    agg.time_window = $time_window,
                    agg.positive_pct = $positive_pct,
                    agg.negative_pct = $negative_pct,
                    agg.neutral_pct = $neutral_pct,
                    agg.dominant_sentiment = $dominant,
                    agg.computed_at = datetime()
                """,
                agg_id=agg_id,
                booth_id=booth_id,
                constituency_id=constituency_id,
                entity_id=entity_id,
                time_window=time_window,
                positive_pct=round(weighted_pos, 2),
                negative_pct=round(weighted_neg, 2),
                neutral_pct=round(weighted_neu, 2),
                dominant='positive' if weighted_pos > weighted_neg and weighted_pos > weighted_neu else (
                    'negative' if weighted_neg > weighted_pos and weighted_neg > weighted_neu else 'neutral'
                ),
            )

            booth_sentiments.append({
                "booth_id": booth_id,
                "positive_pct": round(weighted_pos, 2),
                "negative_pct": round(weighted_neg, 2),
                "neutral_pct": round(weighted_neu, 2),
            })

        return booth_sentiments


def close():
    driver.close()
