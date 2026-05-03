"""Flask API service for Sentiment Analysis Engine per PRD Phase 1-2"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sentiment import classify_sentiment, classify_batch
from entity_resolver import resolve_entities, get_all_entities
from news_collector import fetch_news, poll_all_queries, poll_constituency_news
from neo4j_ingest import upsert_sentiment_observation, compute_constituency_aggregation
import json

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "sentiment-engine"})


@app.route('/api/sentiment/classify', methods=['POST'])
def classify():
    """Classify sentiment of a single text per PRD 2.3"""
    data = request.json
    text = data.get('text', '')
    if not text:
        return jsonify({"error": "text required"}), 400

    result = classify_sentiment(text)
    return jsonify(result)


@app.route('/api/sentiment/classify/batch', methods=['POST'])
def classify_batch_endpoint():
    """Batch classify sentiment per PRD 2.3"""
    data = request.json
    texts = data.get('texts', [])
    if not texts:
        return jsonify({"error": "texts array required"}), 400

    results = classify_batch(texts)
    return jsonify({"results": results})


@app.route('/api/entities/resolve', methods=['POST'])
def resolve():
    """Resolve entities in text per PRD 2.3.4"""
    data = request.json
    text = data.get('text', '')
    if not text:
        return jsonify({"error": "text required"}), 400

    entities = resolve_entities(text)
    return jsonify({"entities": entities})


@app.route('/api/entities', methods=['GET'])
def get_entities():
    """Get all entities for Neo4j loading per PRD 4.5"""
    entities = get_all_entities()
    return jsonify({"entities": entities})


@app.route('/api/news/fetch', methods=['POST'])
def fetch_news_endpoint():
    """Fetch news and classify sentiment per PRD 2.2.1"""
    data = request.json
    query = data.get('query', '')
    max_results = data.get('max_results', 10)
    constituency = data.get('constituency', None)

    articles = fetch_news(query, max_results, constituency)

    # Classify sentiment for each article
    for article in articles:
        text = article.get('title', '') + ' ' + article.get('description', '')
        entities = resolve_entities(text)
        sentiment = classify_sentiment(text)

        article['entities'] = entities
        article['sentiment'] = sentiment.get('sentiment')
        article['confidence'] = sentiment.get('confidence')
        article['language'] = sentiment.get('language')
        article['topic'] = sentiment.get('topic')
        article['model_version'] = sentiment.get('model')
        article['vader_score'] = sentiment.get('vader_score')
        article['vader_label'] = sentiment.get('vader_label')

    return jsonify({"articles": articles, "count": len(articles)})


@app.route('/api/pipeline/run', methods=['POST'])
def run_pipeline():
    """Run full pipeline: collect news, classify, ingest to Neo4j per PRD Phase 1"""
    data = request.json
    constituency = data.get('constituency', None)
    max_results = data.get('max_results', 10)

    # Collect news
    if constituency:
        articles = poll_constituency_news(constituency, max_results)
    else:
        articles = poll_all_queries(max_results)

    ingested = 0
    for article in articles:
        text = article.get('title', '') + ' ' + article.get('description', '')
        if not text.strip():
            continue

        entities = resolve_entities(text)
        sentiment = classify_sentiment(text)

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
            "constituency_id": article.get('constituency', constituency or ''),
            "booth_id": article.get('booth_id', None),
            "model_version": sentiment.get('model', 'distilbert-multilingual-v2.0'),
            "vader_score": sentiment.get('vader_score'),
            "vader_label": sentiment.get('vader_label')
        }

        try:
            upsert_sentiment_observation(obs)
            ingested += 1
        except Exception as e:
            print(f"[PIPELINE] Error ingesting: {e}")

    return jsonify({"message": "Pipeline completed", "collected": len(articles), "ingested": ingested})


@app.route('/api/aggregation/compute', methods=['POST'])
def compute_aggregation():
    """Compute constituency aggregation per PRD Part 3 schema"""
    data = request.json
    constituency_id = data.get('constituency_id')
    entity_id = data.get('entity_id')
    time_window_days = data.get('time_window_days', 7)

    if not constituency_id or not entity_id:
        return jsonify({"error": "constituency_id and entity_id required"}), 400

    result = compute_constituency_aggregation(constituency_id, entity_id, time_window_days)
    if result:
        return jsonify(result)
    else:
        return jsonify({"error": "No data found"}), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
