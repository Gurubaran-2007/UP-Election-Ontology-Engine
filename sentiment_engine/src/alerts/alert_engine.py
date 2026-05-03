"""Alert engine per PRD 5.4.2"""
from neo4j import GraphDatabase
from datetime import datetime
from sentiment_engine.config.settings import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, ALERT_RULES

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def check_alerts(constituency_id=None, time_window_days=7):
    """Check all alert rules per PRD 5.4.2"""
    alerts = []

    with driver.session() as session:
        query = """
            MATCH (obs:SentimentObservation)
            WHERE obs.source_date >= date() - duration({days: $days})
        """
        params = {"days": time_window_days}

        if constituency_id:
            query += " AND obs.constituency_id = $cid"
            params["cid"] = constituency_id

        query += """
            WITH obs.constituency_id AS cid, obs.entity_id AS eid,
                 COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS pos,
                 COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS neg,
                 COUNT(obs) AS total
            RETURN cid, eid, pos, neg, total
        """

        result = session.run(query, params)

        for record in result:
            cid = record["cid"]
            eid = record["eid"]
            total = record["total"]
            if total == 0:
                continue

            pos_pct = 100.0 * record["pos"] / total
            neg_pct = 100.0 * record["neg"] / total

            trending = _get_trending(session, cid, eid)
            seat_status = _get_seat_status(session, cid)

            agg = {
                "constituency_id": cid,
                "constituency_name": cid,
                "entity_id": eid,
                "positive_pct": pos_pct,
                "negative_pct": neg_pct,
                "trending": trending,
                "seat_status": seat_status,
            }

            for rule in ALERT_RULES:
                try:
                    if rule["condition"](agg):
                        alerts.append({
                            "alert_id": rule["id"],
                            "severity": rule["severity"],
                            "message": rule["message"].format(
                                constituency_name=cid,
                                entity_name=eid,
                            ),
                            "constituency_id": cid,
                            "entity_id": eid,
                            "triggered_at": datetime.utcnow().isoformat(),
                        })
                except Exception as e:
                    print(f"[ALERT] Error checking rule {rule['id']}: {e}")

    return alerts


def _get_trending(session, constituency_id, entity_id):
    """Get trending direction"""
    result = session.run(
        """
        WITH $cid AS cid, $eid AS eid
        MATCH (obs:SentimentObservation)
        WHERE obs.constituency_id = cid AND obs.entity_id = eid
        WITH
          COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= date() - duration({days: 7}) THEN 1 END) AS recent_pos,
          COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= date() - duration({days: 14}) AND obs.source_date < date() - duration({days: 7}) THEN 1 END) AS prev_pos,
          COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= date() - duration({days: 7}) THEN 1 END) AS recent_neg,
          COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= date() - duration({days: 14}) AND obs.source_date < date() - duration({days: 7}) THEN 1 END) AS prev_neg
        RETURN recent_pos, prev_pos, recent_neg, prev_neg
        """,
        cid=constituency_id, eid=entity_id
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


def _get_seat_status(session, constituency_id):
    """Get seat status from SeatClassification"""
    result = session.run(
        "MATCH (sc:SeatClassification {constituency_id: $cid}) RETURN sc.seat_status AS status",
        cid=constituency_id
    )
    record = result.single()
    return record["status"] if record else "unknown"


def get_high_alerts():
    """Get high severity alerts for immediate attention"""
    alerts = check_alerts()
    return [a for a in alerts if a["severity"] == "HIGH"]


def close():
    driver.close()
