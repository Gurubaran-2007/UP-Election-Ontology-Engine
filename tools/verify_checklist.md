# Sentiment Pipeline — 10‑Minute Verification Checklist

**Prereqs:** Neo4j running, Python venv active, Node server running on :3000

---

## 1. Python Engine (2 min)

```bash
# cd E:\UP-Election-Ontology-Engine

# 1a. Test language detection
python -c "
from sentiment_engine.lang_detect import detect_language
print('Hindi:', detect_language('योगी आदित्यनाथ उत्तर प्रदेश'))
print('English:', detect_language('BJP wins Uttar Pradesh'))
print('Mixed:', detect_language('योगी जी BJP government is great'))
"

# 1b. Test sentiment
python -c "
from sentiment_engine.sentiment import classify_sentiment
r1 = classify_sentiment('BJP is doing great work in UP')
r2 = classify_sentiment('योगी जी ने बहुत अच्छा काम किया है')
print('English pos:', r1['sentiment'], r1['confidence'])
print('Hindi pos:', r2['sentiment'], r2['confidence'])
"

# 1c. Test entity resolution
python -c "
from sentiment_engine.entity_resolver import resolve_entities
entities = resolve_entities('योगी आदित्यनाथ और मोदी जी UP आए')
print('Found:', [e['entity_id'] for e in entities])
"
```

**✓ Expect:** `hi`/`en`/`hi-en-mixed` labels; `positive`/`negative` sentiment; correct `entity_id` values.

---

## 2. Neo4j Ingestion (3 min)

```bash
# 2a. Load entity aliases
python scripts/load_entities_to_neo4j.py

# 2b. Test news fetch + ingestion (dry run, 3 articles)
python -c "
from sentiment_engine.news_collector import fetch_news
from sentiment_engine.sentiment import classify_sentiment
from sentiment_engine.entity_resolver import resolve_entities
from sentiment_engine.neo4j_ingest import upsert_sentiment_observation

articles = fetch_news('UP BJP Yogi', max_results=3)
print(f'Fetched {len(articles)} articles')

for a in articles[:2]:
    text = a.get('title','') + ' ' + a.get('description','')
    sent = classify_sentiment(text)
    ents = resolve_entities(text)
    obs = {
        'text': text[:500],
        'url': a.get('url',''),
        'published_at': a.get('published_at','2026-05-03'),
        'source_type': 'news',
        'language': sent['language'],
        'entities': ents,
        'sentiment': sent['sentiment'],
        'confidence': sent['confidence'],
        'topic': sent['topic'],
        'constituency_id': 'UP-01',
        'model_version': sent['model'],
    }
    try:
        obs_id = upsert_sentiment_observation(obs)
        print(f'✓ Ingested: {obs_id} → {sent[\"sentiment\"]}')
    except Exception as e:
        print(f'✗ Error: {e}')
"
```

**✓ Expect:** "Loaded 15 entities", then "✓ Ingested: OBS-xxx → positive/negative".

---

## 3. API Endpoints (3 min)

Open **3 terminals** or use Postman:

```bash
# Terminal 1: Start Node server (if not running)
node server.js

# Terminal 2: Test Node endpoints
curl "http://localhost:3000/api/up/sentiment/UP-01?time_window=last_7d"
curl "http://localhost:3000/api/up/sentiment/entity/party-bjp"
curl "http://localhost:3000/api/up/sentiment/alerts"
curl "http://localhost:3000/api/up/sentiment/heatmap?entity_id=party-bjp"
```

**✓ Expect:** JSON with `aggregations` array, `alerts` array, `constituencies` array (may be empty if no data yet).

---

## 4. Frontend Smoke Test (2 min)

1. Open `http://localhost:3000`
2. Click **Sentiment Analysis** tab
3. **Expected:**
   - Sentiment dashboard shows "Select a constituency..." (no crash)
   - Heatmap controls visible
   - Click "Load Heatmap" → should show grid (may be empty)
   - Alerts panel shows "No alerts yet"

**✓ If you see the tab and no JS errors in browser console → frontend works.**

---

## 5. Quick Sanity Check (1 min)

```bash
# Check Neo4j has data
python -c "
from neo4j import GraphDatabase
driver = GraphDatabase.driver('neo4j://localhost:7687', auth=('neo4j','guru@9114'))
with driver.session() as s:
    r = s.run('MATCH (o:SentimentObservation) RETURN count(o) AS c')
    print('SentimentObservation nodes:', r.single()['c'])
    r2 = s.run('MATCH (e:LeaderEntity) RETURN count(e) AS c')
    print('LeaderEntity nodes:', r2.single()['c'])
driver.close()
"
```

---

## Done?

| Check | Status |
|------|--------|
| ✓ Python modules import & run | ☐ |
| ✓ Neo4j entities loaded | ☐ |
| ✓ News → Sentiment → Ingestion works | ☐ |
| ✓ Node API returns JSON (not error) | ☐ |
| ✓ Frontend tab loads, no JS errors | ☐ |
| ✓ Neo4j has SentimentObservation nodes | ☐ |

**If all checked: Pipeline is verified & ready for production use.**
