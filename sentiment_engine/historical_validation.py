"""Historical validation and backtesting per PRD Phase 5"""
from neo4j import GraphDatabase
from datetime import datetime, timedelta
import json
from sentiment_engine.config.settings import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def backtest_election(year, election_id):
    """
    Backtest sentiment pipeline against historical election results per PRD 5.5
    Compares sentiment predictions with actual election outcomes
    """
    print(f"\n{'='*60}")
    print(f"Backtesting {year} Election ({election_id})")
    print(f"{'='*60}")

    results = {
        "election_id": election_id,
        "year": year,
        "constituencies": [],
        "accuracy_metrics": {}
    }

    with driver.session() as session:
        result = session.run(
            """
            MATCH (er:ElectionResult {election_id: $eid})
            RETURN er.constituency_id AS cid, er.winner AS winner,
                   er.winner_party_id AS party, er.margin_pct AS margin
            """,
            eid=election_id
        )

        total_constituencies = 0
        correct_predictions = 0
        sentiment_vs_actual = []

        for record in result:
            cid = record["cid"]
            actual_winner_party = record["party"]
            margin = record["margin"]

            sentiment_result = session.run(
                """
                MATCH (obs:SentimentObservation)
                WHERE obs.constituency_id = $cid
                  AND obs.source_date < date($election_date)
                  AND obs.source_date >= date($election_date) - duration({days: 90})
                WITH obs.entity_id AS eid, obs.sentiment AS sent, COUNT(obs) AS cnt
                RETURN eid, sent, cnt
                ORDER BY eid, sent
                """,
                cid=cid,
                election_date=f"{year}-03-01"
            )

            party_sentiment = {}
            for s_record in sentiment_result:
                eid = s_record["eid"]
                sent = s_record["sent"]
                cnt = s_record["cnt"]

                party = _entity_to_party(eid)
                if party not in party_sentiment:
                    party_sentiment[party] = {"positive": 0, "negative": 0, "neutral": 0, "total": 0}

                party_sentiment[party][sent] += cnt
                party_sentiment[party]["total"] += cnt

            predicted_winner = None
            max_sentiment = -1

            for party, data in party_sentiment.items():
                if data["total"] == 0:
                    continue
                pos_pct = data["positive"] / data["total"]
                if pos_pct > max_sentiment:
                    max_sentiment = pos_pct
                    predicted_winner = party

            correct = predicted_winner == actual_winner_party
            if predicted_winner:
                total_constituencies += 1
                if correct:
                    correct_predictions += 1

            sentiment_vs_actual.append({
                "constituency_id": cid,
                "actual_winner": actual_winner_party,
                "predicted_winner": predicted_winner,
                "margin_pct": margin,
                "correct": correct,
                "party_sentiment": party_sentiment
            })

        accuracy = (correct_predictions / total_constituencies * 100) if total_constituencies > 0 else 0

        results["constituencies"] = sentiment_vs_actual
        results["accuracy_metrics"] = {
            "total_constituencies": total_constituencies,
            "correct_predictions": correct_predictions,
            "accuracy_pct": round(accuracy, 2)
        }

        print(f"\nResults:")
        print(f"  Total constituencies: {total_constituencies}")
        print(f"  Correct predictions: {correct_predictions}")
        print(f"  Accuracy: {accuracy:.2f}%")

        return results


def _entity_to_party(entity_id):
    mapping = {
        "party-bjp": "BJP",
        "leader-narendra-modi": "BJP",
        "leader-yogi-adityanath": "BJP",
        "party-sp": "SP",
        "leader-akhilesh-yadav": "SP",
        "party-bsp": "BSP",
        "leader-mayawati": "BSP",
        "party-inc": "INC",
        "leader-rahul-gandhi": "INC",
    }
    return mapping.get(entity_id, "OTHER")


def calculate_correlation(election_id, entity_id):
    """Calculate correlation between sentiment and actual vote share per PRD 5.5.2"""
    print(f"\nCalculating correlation for {entity_id} in {election_id}...")

    with driver.session() as session:
        sentiment_result = session.run(
            """
            MATCH (obs:SentimentObservation {entity_id: $eid})
            WHERE obs.source_date >= date() - duration({days: 365})
            RETURN obs.constituency_id AS cid,
                   COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS pos,
                   COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS neg,
                   COUNT(obs) AS total
            """,
            eid=entity_id
        )

        sentiment_data = {}
        for record in sentiment_result:
            cid = record["cid"]
            total = record["total"]
            if total > 0:
                sentiment_data[cid] = record["pos"] / total * 100

        vote_result = session.run(
            """
            MATCH (er:ElectionResult {election_id: $eid})
            RETURN er.constituency_id AS cid,
                   er.winner_party_id AS party,
                   er.winner_vote_share AS share
            """,
            eid=election_id
        )

        pairs = []
        for record in vote_result:
            cid = record["cid"]
            party = record["party"]
            share = record["share"]

            entity_party = _entity_to_party(entity_id)
            if party == entity_party and cid in sentiment_data:
                pairs.append((sentiment_data[cid], share))

        if len(pairs) < 2:
            print("  Insufficient data for correlation")
            return None

        n = len(pairs)
        sum_x = sum(p[0] for p in pairs)
        sum_y = sum(p[1] for p in pairs)
        sum_xy = sum(p[0] * p[1] for p in pairs)
        sum_x2 = sum(p[0] ** 2 for p in pairs)
        sum_y2 = sum(p[1] ** 2 for p in pairs)

        numerator = n * sum_xy - sum_x * sum_y
        denominator = ((n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2)) ** 0.5

        correlation = 0 if denominator == 0 else numerator / denominator

        print(f"  Correlation coefficient: {correlation:.4f}")
        print(f"  Based on {n} constituencies")

        return {
            "entity_id": entity_id,
            "election_id": election_id,
            "correlation": round(correlation, 4),
            "sample_size": n
        }


def generate_report(output_path="sentiment_validation_report.json"):
    """Generate full validation report per PRD 5.5.3"""
    print("\nGenerating validation report...")

    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "backtests": [],
        "correlations": []
    }

    try:
        backtest_2024 = backtest_election(2024, "LS2024")
        report["backtests"].append(backtest_2024)
    except Exception as e:
        print(f"Error in 2024 backtest: {e}")

    try:
        backtest_2022 = backtest_election(2022, "VS2022")
        report["backtests"].append(backtest_2022)
    except Exception as e:
        print(f"Error in 2022 backtest: {e}")

    for entity_id in ["party-bjp", "party-sp", "party-bsp"]:
        try:
            corr = calculate_correlation("LS2024", entity_id)
            if corr:
                report["correlations"].append(corr)
        except Exception as e:
            print(f"Error calculating correlation for {entity_id}: {e}")

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: {output_path}")
    return report


def close():
    driver.close()


if __name__ == "__main__":
    generate_report()
    close()
