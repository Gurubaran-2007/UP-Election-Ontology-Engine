import time
import requests
from datetime import datetime
from sentiment_engine.config.settings import NEWSDATA_KEYS, NEWS_QUERIES, UP_LS_CONSTITUENCIES, UP_LEADERS

_key_index = 0
_key_exhausted = {}

for _k in NEWSDATA_KEYS:
    _key_exhausted[_k] = False


def _get_key():
    global _key_index
    if not NEWSDATA_KEYS:
        return None
    for i in range(len(NEWSDATA_KEYS)):
        idx = (_key_index + i) % len(NEWSDATA_KEYS)
        if not _key_exhausted[NEWSDATA_KEYS[idx]]:
            _key_index = idx
            return NEWSDATA_KEYS[idx]
    for k in _key_exhausted:
        _key_exhausted[k] = False
    _key_index = 0
    return NEWSDATA_KEYS[0]


def fetch_news(query, max_results=10, constituency=None):
    """Fetch news articles using NewsData API with key rotation per PRD 2.2.1"""
    key = _get_key()
    if not key:
        print("[NEWS] No NEWSDATA_API_KEYS configured — skipping fetch")
        return []
    url = "https://newsdata.io/api/1/news"
    params = {
        "apikey": key,
        "q": query,
        "country": "in",
        "language": "en,hi",
        "size": max_results,
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 429:
            _key_exhausted[key] = True
            key = _get_key()
            params["apikey"] = key
            res = requests.get(url, params=params, timeout=10)
        if res.status_code != 200:
            return []
        data = res.json()
        if data.get("status") == "error":
            if "limit" in data.get("message", "").lower():
                _key_exhausted[key] = True
            return []
        articles = data.get("results", [])
        return [_normalize(a, constituency) for a in articles]
    except Exception as e:
        print(f"[NEWS] Error fetching '{query}': {e}")
        return []


def _normalize(article, constituency=None):
    return {
        "source_id": article.get("source_id", "unknown"),
        "title": article.get("title", ""),
        "description": article.get("description", ""),
        "content": article.get("content", ""),
        "url": article.get("link", ""),
        "published_at": article.get("pubDate", ""),
        "language": article.get("language", "unknown"),
        "country": article.get("country", []),
        "category": article.get("category", []),
        "creator": article.get("creator", []),
        "collected_at": datetime.utcnow().isoformat(),
        "source_type": "news",
        "constituency": constituency,
    }


def poll_all_queries(max_results=10):
    """Poll all configured news queries per PRD 2.2.1"""
    all_articles = []
    for query in NEWS_QUERIES:
        articles = fetch_news(query, max_results)
        all_articles.extend(articles)
        time.sleep(1)
    return all_articles


def poll_constituency_news(constituency_name, max_results=10):
    """Poll news for a specific constituency per PRD 2.2.1"""
    articles = []
    queries = [
        f"UP {constituency_name} election",
        f"{constituency_name} UP news",
        f"यूपी {constituency_name} समाचार",
    ]
    for q in queries:
        articles.extend(fetch_news(q, max_results // len(queries), constituency_name))
        time.sleep(1)
    return articles


def poll_leader_news(leader_name, max_results=10):
    """Poll news for a specific leader per PRD 2.2.1"""
    articles = []
    queries = [
        f"{leader_name} UP",
        f"{leader_name} Uttar Pradesh",
        f"{leader_name} election",
    ]
    for q in queries:
        articles.extend(fetch_news(q, max_results // len(queries)))
        time.sleep(1)
    return articles
