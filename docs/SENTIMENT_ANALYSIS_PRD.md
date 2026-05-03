# Booth-Level Sentiment Analysis Engine — UP Election Ontology

> **Document Type:** Product Requirements Document
> **Version:** 1.0
> **Status:** Approved for Engineering
> **Date:** 2026-05-03
> **Owner:** UP Election Ontology Engine Team
> **Scope:** Uttar Pradesh — 80 Lok Sabha, 403 Vidhan Sabha, 162,000+ Polling Booths

---

## Table of Contents

1. [Part 0 — Research Foundation](#part-0--research-foundation)
2. [Part 1 — Product Vision](#part-1--product-vision)
3. [Part 2 — Architecture](#part-2--architecture)
4. [Part 3 — Neo4j Schema Extensions](#part-3--neo4j-schema-extensions)
5. [Part 4 — Entity Alias System](#part-4--entity-alias-system)
6. [Part 5 — Implementation Phases](#part-5--implementation-phases)
7. [Part 6 — API Endpoints](#part-6--api-endpoints)
8. [Part 7 — Data Lineage](#part-7--data-lineage)
9. [Part 8 — Known Limitations](#part-8--known-limitations)
10. [Part 9 — Success Metrics](#part-9--success-metrics)

---

## Part 0 — Research Foundation

This sentiment analysis engine is grounded in peer-reviewed research on election prediction, code-mixed NLP, and spatial sentiment disaggregation. The following studies validate our approach and provide methodological precedents.

### 0.1 — SHRUG Polling Station-to-Census Linkage

**Source:** Harvard Dataverse, Scientific Data 2025
**DOI:** [10.7910/DVN/KKOWNJ](https://doi.org/10.7910/DVN/KKOWNJ)
**Title:** "Linking Indian Polling Stations to Census Units"

**Key Findings:**
- 162,000+ polling stations in Uttar Pradesh mapped to census villages and towns
- Provides the geographic backbone for booth-level sentiment disaggregation
- SHRUG (South Asia Region at Harvard University Geospatial) dataset enables constituency → village → booth hierarchy traversal
- Census unit linkage allows demographic weighting (literacy rate, urban/rural split, population density)

**Relevance to This PRD:** Enables the spatial interpolation layer (Part 2, Tier 3) by providing the PS-to-census mapping required to distribute constituency-level sentiment down to booth level using demographic weights.

### 0.2 — LLM-Based Sentiment on X for UP 2022 and Punjab 2022

**Source:** arXiv 2024
**Paper ID:** [2405.07828](https://arxiv.org/abs/2405.07828)
**Title:** "Election Sentiment Analysis using Large Language Models"

**Key Findings:**
- Used Llama-2-13B and Zephyr-7B-beta to analyze X (Twitter) data for UP 2022 and Punjab 2022 assembly elections
- Pipeline: party mention detection → sentiment scoring → aggregation by constituency
- Demonstrated strong correlation between social media sentiment and actual election outcomes
- Handled code-mixed Hindi/English text effectively

**Relevance to This PRD:** Validates LLM-based sentiment analysis for Indian elections. Our use of Sarvam AI (a model trained specifically on Indian languages) follows the same paradigm with better language coverage.

### 0.3 — Hybrid Language Model for Code-Mixed Sentiment

**Source:** EMNLP 2025
**Title:** "Hybrid Language Models for Code-Mixed Sentiment Analysis in Indian Languages"

**Key Findings:**
- HLM architecture: mBERT/XLM-R encoder + Sarvam-1 decoder
- Achieved 74.54 F1 on ENG-HIN (English-Hindi code-mixed)
- Achieved 84.69 F1 on ENG-TEL (English-Telugu code-mixed)
- Proves that combining multilingual encoders with Indian language decoders outperforms monolingual approaches

**Relevance to This PRD:** Directly validates our Tier 2 architecture choice of combining mBERT/XLM-R with Sarvam AI for code-mixed Hindi-English political text sentiment classification.

### 0.4 — Location-Based Election Prediction Model (LEPM)

**Source:** CMC 2023
**Title:** "LEPM: Location-based Election Prediction Model Using Twitter Data"

**Key Findings:**
- Used Twitter geolocation data + VADER/BERT/ElecBERT sentiment scoring
- Achieved 84% state-level accuracy for US 2020 election prediction
- Demonstrated that location-aware sentiment mapping works at constituency level
- Spatial aggregation of geotagged sentiment outperformed non-geographic baselines

**Relevance to This PRD:** Validates the geographic sentiment aggregation approach. Our system extends this from US state-level to Indian booth-level granularity.

### 0.5 — Spatio-Temporal Sentiment Analysis (COMPASS)

**Source:** KDD 2017
**Title:** "COMPASS: Spatio-Temporal Sentiment Analysis of the 2016 US Presidential Election"

**Key Findings:**
- Geotagged tweet analysis at county and state levels
- Real-time sentiment heatmaps were feasible and actionable
- Temporal dynamics (sentiment shifts over time) were predictive of election outcomes
- Spatial clustering revealed swing regions missed by aggregate analysis

**Relevance to This PRD:** Informs our temporal aggregation windows (24h, 7d, 30d, 90d) and heatmap visualization requirements.

### 0.6 — IndicBERT for Karnataka 2023 Election

**Source:** IJCI 2023
**Title:** "Sentiment Analysis of Karnataka Assembly Election 2023 using IndicBERT"

**Key Findings:**
- Fine-tuned IndicBERT on election-specific Twitter data
- Successfully predicted INC victory in Karnataka 2023
- IndicBERT outperformed standard multilingual BERT for Indian language political text
- Hyperparameter tuning (learning rate, batch size, epochs) was critical for accuracy

**Relevance to This PRD:** Supports our use of Indian language models (Sarvam AI, IndicBERT) over generic multilingual models for Hindi political text.

### 0.7 — Sub-Spatial Vote Prediction via Spatial Interpolation

**Source:** Springer 2025
**Title:** "Sub-spatial Vote Prediction Using Machine Learning and Ordinary Kriging"

**Key Findings:**
- Applied ordinary kriging (spatial interpolation) to Mexican gubernatorial election data
- Disaggregated from constituency-level to sub-constituency level predictions
- Demographic covariates (population, literacy, income) improved interpolation accuracy
- Directly applicable to LS → VS → Booth disaggregation hierarchy

**Relevance to This PRD:** Provides the mathematical foundation for our booth-level sentiment disaggregation (Tier 3). We adapt kriging-like weighted distribution using the LS→VS→Booth hierarchy with SHRUG census demographic weights.

### 0.8 — Brexit Twitter Sentiment by Westminster Constituency

**Source:** UK 2022 Study
**Title:** "Twitter-Based Sentiment Analysis for Brexit Prediction by Westminster Constituency"

**Key Findings:**
- Location-based sentiment analysis per Westminster constituency
- Ensemble of Decision Tree + Neural Network + Naive Bayes
- 39-43% accuracy improvement over random baseline
- Demonstrated that constituency-level sentiment from social media is predictive

**Relevance to This PRD:** Validates constituency-level sentiment aggregation for electoral prediction. Our ensemble approach (Sarvam + mBERT) builds on this methodology.

---

## Part 1 — Product Vision

Build a **booth-level public sentiment tracking engine** for Uttar Pradesh that monitors, analyzes, and visualizes political discourse across the state's **162,000+ polling stations**, **403 Vidhan Sabha constituencies**, and **80 Lok Sabha constituencies**.

### 1.1 — Problem Statement

Political strategists, campaign managers, and analysts lack granular, real-time visibility into public sentiment at the booth level. Existing tools operate at state or national aggregate levels, masking constituency-level variations that decide elections. Ground surveys are expensive, slow, and statistically limited. Social media monitoring tools do not handle code-mixed Hindi-English text or Indian geographic hierarchies.

### 1.2 — Solution

A multi-source sentiment pipeline that:
- Aggregates discourse from news articles, social media (X/Twitter), YouTube comments, and ground survey forms
- Processes code-mixed Hindi-English text using Indian language models (Sarvam AI)
- Resolves entity mentions (leaders, parties, issues) through comprehensive alias matching
- Disaggregates constituency-level sentiment to booth level via spatial interpolation with census demographic weights
- Produces actionable signals: sentiment scores, trends, alerts, and heatmaps
- Maintains full source provenance for every observation

### 1.3 — Geographic Scope

| Level | Count | Identifier Format |
|---|---|---|
| State | 1 (Uttar Pradesh) | `UP` |
| Lok Sabha (LS) | 80 | `UP-01` to `UP-80` |
| Vidhan Sabha (VS) | 403 | `UP-VS-01-1` to `UP-VS-80-5` |
| Polling Booths | 162,000+ | `UP-BOOTH-XXXXXX` |

### 1.4 — Non-Goals

- Individual voter profiling (aggregate analysis only)
- Prediction of exact vote share or seat count
- Real-time (<1 min) sentiment updates
- Coverage of languages beyond Hindi, English, and Hindi-English code-mixed
- Analysis of elections outside Uttar Pradesh (architecture is extensible but out of scope)

---

## Part 2 — Architecture

### 2.1 — Three-Tier Pipeline Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    TIER 1: DATA COLLECTION                    │
├──────────────────────────────────────────────────────────────┤
│  NewsData API (13 keys)    YouTube Data API    Google Trends │
│  Hindi + English queries   10K quota/day      Trending data │
│  Ground survey forms       UP News Channels   Hashtag tracking
│                          National Channels    Reddit API     │
└──────────────────────┬───────────────────────────────────────┘
                       │ Raw documents (text + metadata)
                       ▼
```

### 2.2 — Tier 1: Data Collection

#### 2.2.1 — NewsData API

- **Keys Available:** 13 API keys (round-robin load balancing)
- **Query Strategy:** Constituency-specific keywords + party names + leader names in Hindi and English
- **Languages:** `hi` (Hindi), `en` (English)
- **Polling Frequency:** Every 15 minutes per key
- **Deduplication:** URL-based dedup within 24-hour window

```python
NEWS_QUERIES = [
    "UP election 2026",
    "योगी आदित्यनाथ",
    "BJP Uttar Pradesh",
    "समाजवादी पार्टी UP",
    "UP news {constituency_name}",
    "{leader_name} {constituency_name}",
    "UP development news",
    "UP farmer protest",
    "UP unemployment",
]
```

#### 2.2.2 — X/Twitter (snscrape — No API Key Required)

The official X/Twitter API is paid and rate-limited. For research-scale data collection, we use **`snscrape`**, a Python scraper that pulls public tweets without API keys.

**Architecture:**
```python
import snscrape.modules.twitter as sntwitter
import pandas as pd

# Search for tweets about UP elections in a date range
query = "(BJP OR भाजपा OR योगी) lang:hi OR lang:en since:2026-04-01 until:2026-05-01"
tweets = []

for tweet in sntwitter.TwitterSearchScraper(query).get_items():
    tweets.append({
        'id': tweet.id,
        'date': tweet.date,
        'text': tweet.content,
        'user': tweet.user.username,
        'location': tweet.user.location,
        'lang': tweet.lang,
        'retweets': tweet.retweetCount,
        'likes': tweet.likeCount,
    })
    if len(tweets) >= 10000:
        break

df = pd.DataFrame(tweets)
```

**Query Strategy for UP Elections:**
```python
UP_TWITTER_QUERIES = [
    # Party mentions
    "BJP Uttar Pradesh lang:hi OR lang:en",
    "भाजपा UP lang:hi",
    "सपा UP lang:hi",
    "Samajwadi Party UP lang:en",
    "BSP UP lang:hi OR lang:en",

    # Leader mentions (Hindi + English)
    "योगी आदित्यनाथ lang:hi",
    "Yogi Adityanath UP lang:en",
    "मोदी UP lang:hi",
    "PM Modi UP lang:en",
    "अखिलेश यादव lang:hi",
    "मायावती lang:hi",

    # Issue-based
    "UP बेरोजगारी lang:hi",
    "UP महंगाई lang:hi",
    "UP farmer lang:en",
    "UP unemployment lang:en",
    "UP election 2026 lang:hi OR lang:en",

    # Constituency-specific (per cycle)
    "{constituency_name} UP election lang:hi OR lang:en",
    "{constituency_name} BJP lang:hi OR lang:en",
    "{constituency_name} SP lang:hi OR lang:en",
]
```

**Geographic Inference (when geolocation unavailable):**
```python
def infer_constituency(tweet_text: str, user_location: str, alias_db: dict) -> str | None:
    """Infer constituency from tweet text or user profile location."""
    # Method 1: Match constituency names in tweet text
    for const_name, const_id in CONSTITUENCY_NAME_MAP.items():
        if const_name.lower() in tweet_text.lower():
            return const_id

    # Method 2: Match user profile location to district → constituency
    if user_location:
        for district_name in DISTRICT_NAMES:
            if district_name.lower() in user_location.lower():
                return get_primary_constituency_for_district(district_name)

    # Method 3: Fallback to state-level (UP) without constituency assignment
    return "UP-STATE"
```

**Warnings:**
- snscrape **violates X's Terms of Service** if done aggressively — use at your own risk
- It is **fragile**: X changes HTML/defenses frequently; scraper may break without warning
- Can **get your IP blocked** if rate is too high — use delays (1-2s between requests) and proxies
- Treat X as **one of several sentiment sources**, not the sole data stream
- Use for **research-scale collection** (thousands of tweets), not production-scale (millions)

**Best practice:** Combine snscrape with NewsData API, YouTube comments, and ground surveys for a multi-source approach. X data is volatile; news and ground data are more stable.

#### 2.2.3 — YouTube Comments

- **Target Channels:** UP-focused political news channels, party official channels
- **Processing:** Comment extraction, language detection, sentiment classification
- **Frequency:** Daily batch processing

#### 2.2.4 — Ground Survey Forms

- **Input:** POST /api/up/sentiment/ground-feedback
- **Format:** Structured JSON with booth_id, constituency_id, sentiment responses, surveyor metadata
- **Purpose:** Ground truth validation and supplementation of digital signals

### 2.3 — Tier 2: Sentiment Processing

#### 2.3.0 — Python Library Stack

The sentiment engine uses a **three-stage library strategy**, from fast baseline to production transformer to fine-tuned domain model.

| Stage | Library | Language | Accuracy | Speed | Use Case |
|---|---|---|---|---|---|
| **Baseline (fast)** | `vaderSentiment` | English only | ~60% on social media | Very fast (no GPU) | Quick prototyping, English-only news slices, sanity checks |
| **Baseline (fast)** | `TextBlob` | English only | ~30-33% | Very fast | Quick prototyping only; not production-grade |
| **Production** | `transformers` (DistilBERT multilingual: `tabularisai/multilingual-sentiment-analysis`) | 100+ languages incl. Hindi, English | >70% on code-mixed social media | Moderate (CPU OK, GPU recommended) | Main engine for Hindi/English code-mixed tweets, YouTube comments, news comments |
| **Production** | `flair` (Zalando) | English + some others | Good on English tweets; below transformers on code-mixed | Moderate | Rapid experiments, English social media backup |
| **Production** | `spaCy` + extensions | Many (en, hi, etc.) | Varies by model; good for NLP pipeline | Moderate | Full NLP pipeline (tokenization, POS, NER) to support entity resolution |
| **Fine-tuning** | `mBERT` / `XLM-R` (fine-tuned on Indian political text) | Hindi, English, code-mixed | 75-80% F1 (per EMNLP 2025) | Heavy (GPU required) | Future upgrade: domain-specific political sentiment, pro/anti-party classification |
| **Data access** | `snscrape` | N/A | N/A | Fast | X/Twitter scraping without official API; fragile, use cautiously |
| **Data access** | `tweepy` | N/A | N/A | Fast | Official X API wrapper (if keys available) |

**Recommendation for UP election monitoring:**

1. **Baseline layer (immediate):** `vaderSentiment` for English-only news articles; `TextBlob` for quick prototyping only.
2. **Production layer (primary engine):** `transformers` with `distilbert-base-multilingual-cased` (via `tabularisai/multilingual-sentiment-analysis`) as the **main sentiment classifier** for Hindi/English code-mixed text from news, tweets, YouTube comments.
3. **Fine-tuning layer (future):** Train `mBERT` or `XLM-RoBERTa` on a labeled corpus of Indian political posts (2024 LS, state elections) to distinguish positive/negative/neutral AND pro/anti-party AND emotion categories (anger, disappointment, fear).

**Integration pattern:**
```python
def classify_sentiment(text: str) -> dict:
    """Multi-model sentiment classification with fallback."""
    # Step 1: Detect language
    lang = detect_language(text)  # fastText lid.176

    if lang == 'en':
        # Use VADER for quick English classification
        vader_score = vader.polarity_scores(text)['compound']
        return {
            'sentiment': label_from_score(vader_score),
            'confidence': abs(vader_score),
            'model': 'vader-en-v1.0',
            'language': 'en'
        }

    # Step 2: Use multilingual transformer for Hindi/code-mixed
    transformer_result = transformer_pipeline(text)
    return {
        'sentiment': transformer_result['label'],  # POSITIVE/NEGATIVE/NEUTRAL
        'confidence': transformer_result['score'],
        'model': 'distilbert-multilingual-v2.0',
        'language': lang
    }

def label_from_score(score: float) -> str:
    if score > 0.05: return 'positive'
    if score < -0.05: return 'negative'
    return 'neutral'
```

#### 2.3.1 — Language Detection

```
Input: text (string)
Output: language ∈ {hi, en, hi-en-mixed}
Model: fastText language identification (lid.176.bin)
Threshold: hi-en-mixed if both hi and en confidence > 0.2
```

#### 2.3.2 — Translation Pipeline (Optional)

```
IF language == hi:
    OPTION A: Translate to en using Sarvam AI Translation API (if available)
    OPTION B: Process directly with multilingual transformer (no translation needed)
    Store original hi text + translated en text (if translated)
IF language == hi-en-mixed:
    Process directly with multilingual transformer (handles code-mixed natively)
IF language == en:
    No translation needed; use VADER or transformer
```

**Note:** The multilingual transformer (`distilbert-base-multilingual-cased`) handles Hindi and code-mixed text **without translation**, eliminating the translation latency and cost. Sarvam AI translation is optional for English-only downstream processing.

#### 2.3.3 — Sentiment Classification Ensemble

```
Sentiment Score = weighted ensemble of available models

Primary: distilbert-multilingual-sentiment (handles hi, en, hi-en-mixed)
Fallback (en only): vaderSentiment (fast, no GPU needed)
Future: fine-tuned mBERT/XLM-R on Indian political text

Classification:
  IF score > 0.65  → positive
  IF score < -0.35 → negative
  ELSE             → neutral

Confidence = |score| (normalized to 0.0-1.0)
```

**Model Specifications:**

| Model | Purpose | Version | API | Dependencies |
|---|---|---|---|---|
| DistilBERT multilingual | Hindi + English + code-mixed sentiment | v2.0 | Local inference (`transformers` + `torch`) | `pip install transformers torch` |
| VADER | English-only quick baseline | v1.0 | Local inference (`vaderSentiment`) | `pip install vaderSentiment` |
| Sarvam AI Sentiment | Hindi + code-mixed (if API key available) | v1.0 | `POST /v1/sentiment` | API key |
| fastText lid.176 | Language detection | lid.176.bin | Local inference | `pip install fasttext` |
| spaCy (hi/ en models) | Tokenization, NER for entity resolution | v3.x | Local pipeline | `pip install spacy` + models |

#### 2.3.4 — Entity Resolution

```python
def resolve_entity(text: str, alias_db: dict) -> list[Entity]:
    """Match text mentions to known entities via alias database."""
    matches = []
    normalized_text = text.lower().strip()
    for entity_id, entity_data in alias_db.items():
        for alias in entity_data["aliases"]:
            if alias.lower() in normalized_text:
                matches.append({
                    "entity_id": entity_id,
                    "alias_matched": alias,
                    "entity_type": entity_data["entity_type"],
                })
    return matches
```

#### 2.3.5 — Topic Classification

Predefined taxonomy mapped to keyword lists:

| Topic | Hindi Keywords | English Keywords |
|---|---|---|
| unemployment | बेरोजगारी, नौकरी, रोजगार | unemployment, jobs, employment |
| inflation | महंगाई, महँगाई, दाम | inflation, prices, cost |
| temple | मंदिर, मस्जिद, राम मंदिर | temple, mosque, ram mandir |
| farmer | किसान, खेती, MSP | farmer, agriculture, MSP |
| development | विकास, सड़क, बिजली | development, road, electricity |
| law_and_order | कानून, अपराध, सुरक्षा | law, crime, security |
| women | महिला, नारी, सुरक्षा | women, safety, reservation |
| caste | जाति, आरक्षण, OBC | caste, reservation, OBC |
| youth | युवा, छात्र, शिक्षा | youth, students, education |
| corruption | भ्रष्टाचार, घोटाला | corruption, scam, fraud |

### 2.4 — Tier 3: Geographic Disaggregation

#### 2.4.1 — Spatial Interpolation Algorithm

Constituency-level sentiment is disaggregated to booth level using a weighted distribution model:

```
Sentiment(booth_i) = Sentiment(constituency) * W_i

Where W_i = (w_lit * literacy_i + w_urb * urban_i + w_pop * population_i + w_soc * socioeconomic_i) / ΣW

Weights calibrated from SHRUG census data:
  w_lit = 0.25  (literacy rate differential)
  w_urb = 0.30  (urban/rural split)
  w_pop = 0.20  (population density)
  w_soc = 0.25  (socioeconomic index from SHRUG)
```

#### 2.4.2 — Disaggregation Hierarchy

```
Lok Sabha (UP-XX)
    └── Vidhan Sabha (UP-VS-XX-X)  [~5 VS per LS]
        └── Polling Booths (UP-BOOTH-XXXXXX)  [~400 booths per VS]
```

#### 2.4.3 — Adjustment Factors

- **Urban bias correction:** Urban booths have higher social media penetration; apply dampening factor of 0.85 to urban booth sentiment derived from digital sources
- **News deserts:** Booths in districts with low news coverage receive lower confidence scores (confidence *= coverage_ratio)
- **Ground truth override:** If ground survey data exists for a booth, it overrides interpolated sentiment with 60% weight

---

## Part 3 — Neo4j Schema Extensions

### 3.1 — Node Types

#### 3.1.1 — SentimentObservation

```cypher
CREATE CONSTRAINT sentiment_observation_unique_id
FOR (s:SentimentObservation) REQUIRE s.obs_id IS UNIQUE;

CREATE INDEX sentiment_observation_source_type
FOR (s:SentimentObservation) ON (s.source_type);

CREATE INDEX sentiment_observation_constituency
FOR (s:SentimentObservation) ON (s.constituency_id);

CREATE INDEX sentiment_observation_entity
FOR (s:SentimentObservation) ON (s.entity_id);

CREATE INDEX sentiment_observation_date
FOR (s:SentimentObservation) ON (s.source_date);
```

**Properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| obs_id | STRING | YES | Unique observation identifier (UUID) |
| source_type | ENUM | YES | `news`, `twitter`, `youtube`, `survey`, `ground_feedback` |
| source_url | STRING | YES | Original URL or source reference |
| source_date | DATE | YES | Publication/creation date |
| text_excerpt | STRING | YES | Original text (max 5000 chars) |
| language | ENUM | YES | `hi`, `en`, `hi-en-mixed` |
| entity_id | STRING | YES | Resolved entity (leader/party/issue) |
| entity_type | ENUM | YES | `party`, `leader`, `issue`, `scheme`, `candidate` |
| sentiment | ENUM | YES | `positive`, `negative`, `neutral` |
| confidence | FLOAT | YES | Model confidence 0.0-1.0 |
| topic | STRING | YES | Classified topic from taxonomy |
| geographic_scope | ENUM | YES | `state`, `district`, `constituency`, `booth` |
| constituency_id | STRING | YES | `UP-XX` or `UP-VS-XX-X` |
| booth_id | STRING | NO | `UP-BOOTH-XXXXXX` (if booth-level) |
| model_version | STRING | YES | e.g., `sarvam-sentiment-v1.0` |
| ingested_at | DATETIME | YES | System ingestion timestamp |

#### 3.1.2 — SentimentAggregation

```cypher
CREATE CONSTRAINT sentiment_aggregation_unique_id
FOR (a:SentimentAggregation) REQUIRE a.agg_id IS UNIQUE;

CREATE INDEX sentiment_aggregation_constituency
FOR (a:SentimentAggregation) ON (a.constituency_id);

CREATE INDEX sentiment_aggregation_entity
FOR (a:SentimentAggregation) ON (a.entity_id);

CREATE INDEX sentiment_aggregation_time_window
FOR (a:SentimentAggregation) ON (a.time_window);
```

**Properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| agg_id | STRING | YES | Unique aggregation identifier |
| constituency_id | STRING | YES | `UP-XX` or `UP-VS-XX-X` |
| booth_id | STRING | NO | `UP-BOOTH-XXXXXX` (if booth-level) |
| entity_id | STRING | YES | Entity being aggregated |
| time_window | ENUM | YES | `last_24h`, `last_7d`, `last_30d`, `last_90d`, `all_time` |
| positive_count | INT | YES | Count of positive observations |
| negative_count | INT | YES | Count of negative observations |
| neutral_count | INT | YES | Count of neutral observations |
| total_count | INT | YES | Total observations |
| positive_pct | FLOAT | YES | Percentage positive (0.0-100.0) |
| negative_pct | FLOAT | YES | Percentage negative (0.0-100.0) |
| neutral_pct | FLOAT | YES | Percentage neutral (0.0-100.0) |
| dominant_sentiment | ENUM | YES | `positive`, `negative`, `neutral` |
| trending | ENUM | YES | `improving`, `declining`, `stable`, `volatile` |
| computed_at | DATETIME | YES | Aggregation computation timestamp |

#### 3.1.3 — LeaderEntity

```cypher
CREATE CONSTRAINT leader_entity_unique_id
FOR (l:LeaderEntity) REQUIRE l.entity_id IS UNIQUE;

CREATE FULLTEXT INDEX leader_entity_search
FOR (l:LeaderEntity) ON EACH [l.name] + l.aliases;
```

**Properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| entity_id | STRING | YES | Unique entity identifier |
| name | STRING | YES | Primary display name |
| aliases | LIST[STRING] | YES | All known name variants |
| entity_type | ENUM | YES | `leader`, `party`, `issue` |
| level | ENUM | YES | `national`, `state`, `constituency` |
| party | STRING | YES | Affiliated party |
| constituency_id | STRING | NO | Associated constituency (local leaders) |

### 3.2 — Relationship Types

```cypher
-- Observation mentions an entity
CREATE CONSTRAINT mention_relationship_unique
FOR ()-[m:MENTIONS]->() REQUIRE m.observation_id IS UNIQUE;

-- Cypher: Create all relationships for an observation
MATCH (obs:SentimentObservation {obs_id: $obs_id})
MATCH (entity:LeaderEntity {entity_id: $entity_id})
MERGE (obs)-[r:MENTIONS {
    observation_id: $obs_id,
    alias_matched: $alias_matched,
    mention_confidence: $mention_confidence
}]->(entity);

-- Observation linked to constituency
MATCH (obs:SentimentObservation {obs_id: $obs_id})
MATCH (const:Constituency {constituency_id: $constituency_id})
MERGE (obs)-[:ABOUT_CONSTITUENCY]->(const);

-- Observation linked to booth (optional)
MATCH (obs:SentimentObservation {obs_id: $obs_id})
MATCH (booth:Booth {booth_id: $booth_id})
MERGE (obs)-[:ABOUT_BOOTH]->(booth);

-- Aggregation linked to constituency
MATCH (agg:SentimentAggregation {agg_id: $agg_id})
MATCH (const:LokSabhaConstituency {constituency_id: $constituency_id})
MERGE (agg)-[:AGGREGATES_FOR]->(const);

-- Aggregation linked to booth (optional)
MATCH (agg:SentimentAggregation {agg_id: $agg_id})
MATCH (booth:Booth {booth_id: $booth_id})
MERGE (agg)-[:AGGREGATES_FOR_BOOTH]->(booth);
```

### 3.3 — Aggregation Cypher Queries

#### Compute Constituency-Level Aggregation

```cypher
MATCH (obs:SentimentObservation)
WHERE obs.constituency_id = $constituency_id
  AND obs.entity_id = $entity_id
  AND obs.source_date >= datetime() - duration({days: $days})
RETURN
  obs.constituency_id AS constituency_id,
  obs.entity_id AS entity_id,
  COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) AS positive_count,
  COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) AS negative_count,
  COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) AS neutral_count,
  COUNT(obs) AS total_count,
  ROUND(100.0 * COUNT(CASE WHEN obs.sentiment = 'positive' THEN 1 END) / COUNT(obs), 2) AS positive_pct,
  ROUND(100.0 * COUNT(CASE WHEN obs.sentiment = 'negative' THEN 1 END) / COUNT(obs), 2) AS negative_pct,
  ROUND(100.0 * COUNT(CASE WHEN obs.sentiment = 'neutral' THEN 1 END) / COUNT(obs), 2) AS neutral_pct
```

#### Compute Trending Direction

```cypher
WITH $constituency_id AS cid, $entity_id AS eid
MATCH (obs:SentimentObservation)
WHERE obs.constituency_id = cid AND obs.entity_id = eid
WITH
  COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= datetime() - duration({days: 7}) THEN 1 END) AS recent_positive,
  COUNT(CASE WHEN obs.sentiment = 'positive' AND obs.source_date >= datetime() - duration({days: 14}) AND obs.source_date < datetime() - duration({days: 7}) THEN 1 END) AS prev_positive,
  COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= datetime() - duration({days: 7}) THEN 1 END) AS recent_negative,
  COUNT(CASE WHEN obs.sentiment = 'negative' AND obs.source_date >= datetime() - duration({days: 14}) AND obs.source_date < datetime() - duration({days: 7}) THEN 1 END) AS prev_negative
RETURN
  CASE
    WHEN (recent_positive > prev_positive * 1.2) AND (recent_negative < prev_negative) THEN 'improving'
    WHEN (recent_positive < prev_positive * 0.8) AND (recent_negative > prev_negative * 1.2) THEN 'declining'
    WHEN ABS(recent_positive - prev_positive) < 0.1 * prev_positive THEN 'stable'
    ELSE 'volatile'
  END AS trending
```

#### Booth-Level Disaggregation Query

```cypher
-- Get constituency sentiment, apply demographic weights, store booth-level aggregations
MATCH (const:LokSabhaConstituency {constituency_id: $constituency_id})
<-[:AGGREGATES_FOR]-(agg:SentimentAggregation {entity_id: $entity_id, time_window: $time_window})
MATCH (vs:VidhanSabhaConstituency)-[:WITHIN_LS]->(const)
MATCH (booth:Booth)-[:WITHIN_VS]->(vs)
WITH
  booth,
  agg.positive_pct * (
    0.25 * booth.literacy_rate / const.avg_literacy +
    0.30 * booth.urban_ratio / const.avg_urban +
    0.20 * booth.population / const.avg_population +
    0.25 * booth.socioeconomic_index / const.avg_socioeconomic
  ) AS weighted_positive_pct
MERGE (booth_agg:SentimentAggregation {
  agg_id: 'BOOTH-' + booth.booth_id + '-' + $entity_id + '-' + $time_window,
  booth_id: booth.booth_id,
  constituency_id: booth.constituency_id,
  entity_id: $entity_id,
  time_window: $time_window
})
SET
  booth_agg.positive_pct = ROUND(weighted_positive_pct, 2),
  booth_agg.computed_at = datetime()
```

---

## Part 4 — Entity Alias System

### 4.1 — Alias Database Format

All entity aliases are stored in a JSON configuration file (`entities/up_entities.json`) and synced to Neo4j `LeaderEntity` nodes on startup.

```json
{
  "entity_id": "party-bjp",
  "name": "Bharatiya Janata Party",
  "aliases": [
    "BJP",
    "भाजपा",
    "बीजेपी",
    "@BJP4India",
    "@BJP4UP",
    "यूपी भाजपा",
    "Bharatiya Janata Party",
    "भारतीय जनता पार्टी",
    "कमल दल",
    "lotus party",
    "भाजपा सरकार",
    "BJP govt",
    "BJP leadership",
    "उत्तर प्रदेश भाजपा"
  ],
  "entity_type": "party",
  "level": "national",
  "party": "BJP"
}
```

### 4.2 — UP BJP Leadership Aliases

#### Narendra Modi (entity_id: `leader-narendra-modi`)

```json
{
  "entity_id": "leader-narendra-modi",
  "name": "Narendra Modi",
  "aliases": [
    "Narendra Modi",
    "PM Modi",
    "मोदी",
    "मोदी जी",
    "मोदीजी",
    "@narendramodi",
    "नरेंद्र मोदी",
    "नरेंद्र दामोदरदास मोदी",
    "PM Narendra Modi",
    "Modi ji",
    "Modi Sarkar",
    "मोदी सरकार"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "BJP"
}
```

#### Yogi Adityanath (entity_id: `leader-yogi-adityanath`)

```json
{
  "entity_id": "leader-yogi-adityanath",
  "name": "Yogi Adityanath",
  "aliases": [
    "Yogi Adityanath",
    "Yogi ji",
    "योगी आदित्यनाथ",
    "योगीजी",
    "@myogiadityanath",
    "CM Yogi",
    "योगी जी",
    "आदित्यनाथ",
    "Mahant Yogi",
    "महंत योगी",
    "Yogi Govt",
    "योगी सरकार",
    "Chief Minister Yogi"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

#### Keshav Prasad Maurya (entity_id: `leader-keshav-prasad-maurya`)

```json
{
  "entity_id": "leader-keshav-prasad-maurya",
  "name": "Keshav Prasad Maurya",
  "aliases": [
    "Keshav Prasad Maurya",
    "केशव प्रसाद मौर्य",
    "KP Maurya",
    "केपी मौर्य",
    "Maurya ji",
    "मौर्य जी",
    "UP Deputy CM",
    "उप मुख्यमंत्री मौर्य"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

#### Brajesh Pathak (entity_id: `leader-brajesh-pathak`)

```json
{
  "entity_id": "leader-brajesh-pathak",
  "name": "Brajesh Pathak",
  "aliases": [
    "Brajesh Pathak",
    "बृजेश पाठक",
    "Pathak ji",
    "पाठक जी",
    "Brijesh Pathak",
    "ब्रजेश पाठक"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

#### Manoj Sinha (entity_id: `leader-manoj-sinha`)

```json
{
  "entity_id": "leader-manoj-sinha",
  "name": "Manoj Sinha",
  "aliases": [
    "Manoj Sinha",
    "मनोज सिन्हा",
    "Manoj Kumar Sinha",
    "मनोज कुमार सिन्हा",
    "Sinha ji",
    "सिन्हा जी",
    "Governor Sinha",
    "राजपाल मनोज सिन्हा"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

#### JP Nadda (entity_id: `leader-jp-nadda`)

```json
{
  "entity_id": "leader-jp-nadda",
  "name": "JP Nadda",
  "aliases": [
    "JP Nadda",
    "जेपी नड्डा",
    "Jagat Prakash Nadda",
    "जगत प्रकाश नड्डा",
    "Nadda ji",
    "नड्डा जी",
    "@JPNadda",
    "BJP President Nadda",
    "नड्डा"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "BJP"
}
```

#### Amit Shah (entity_id: `leader-amit-shah`)

```json
{
  "entity_id": "leader-amit-shah",
  "name": "Amit Shah",
  "aliases": [
    "Amit Shah",
    "अमित शाह",
    "Amitbhai Shah",
    "शाह जी",
    "@AmitShah",
    "Home Minister Shah",
    "गृहमंत्री शाह",
    "शाह साहब"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "BJP"
}
```

#### Rajnath Singh (entity_id: `leader-rajnath-singh`)

```json
{
  "entity_id": "leader-rajnath-singh",
  "name": "Rajnath Singh",
  "aliases": [
    "Rajnath Singh",
    "राजनाथ सिंह",
    "Rajnath ji",
    "राजनाथ जी",
    "Defence Minister Singh",
    "रक्षा मंत्री राजनाथ सिंह",
    "राजनाथ सिंह जी"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "BJP"
}
```

#### Anupriya Patel (entity_id: `leader-anupriya-patel`)

```json
{
  "entity_id": "leader-anupriya-patel",
  "name": "Anupriya Patel",
  "aliases": [
    "Anupriya Patel",
    "अनुप्रिया पटेल",
    "Anupriya Singh Patel",
    "अनुप्रिया सिंह पटेल",
    "Apna Dal leader",
    "अपना दल नेता",
    "पटेल जी"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "Apna Dal (Sonelal)"
}
```

#### Sanjay Nishad (entity_id: `leader-sanjay-nishad`)

```json
{
  "entity_id": "leader-sanjay-nishad",
  "name": "Sanjay Nishad",
  "aliases": [
    "Sanjay Nishad",
    "संजय निषाद",
    "Nishad ji",
    "निषाद जी",
    "Nishad Party chief",
    "निषाद पार्टी प्रमुख",
    "संजय निषाद पार्टी"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "Nishad Party"
}
```

#### Suresh Rana (entity_id: `leader-suresh-rana`)

```json
{
  "entity_id": "leader-suresh-rana",
  "name": "Suresh Rana",
  "aliases": [
    "Suresh Rana",
    "सुरेश राणा",
    "Rana ji",
    "राणा जी",
    "UP BJP President",
    "यूपी भाजपा अध्यक्ष",
    "सुरेश राणा जी"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

#### Swatantra Dev Singh (entity_id: `leader-swatantra-dev-singh`)

```json
{
  "entity_id": "leader-swatantra-dev-singh",
  "name": "Swatantra Dev Singh",
  "aliases": [
    "Swatantra Dev Singh",
    "स्वतंत्र देव सिंह",
    "SD Singh",
    "एसडी सिंह",
    "स्वतंत्र देव",
    "Swatantra Singh"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BJP"
}
```

### 4.3 — Opposition Leadership Aliases

#### Rahul Gandhi (entity_id: `leader-rahul-gandhi`)

```json
{
  "entity_id": "leader-rahul-gandhi",
  "name": "Rahul Gandhi",
  "aliases": [
    "Rahul Gandhi",
    "राहुल गांधी",
    "Rahul ji",
    "राहुल जी",
    "@RahulGandhi",
    "Rajiv Gandhi's son",
    "राहुल बाबा",
    "पप्पू",
    "Pappu"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "INC"
}
```

#### Akhilesh Yadav (entity_id: `leader-akhilesh-yadav`)

```json
{
  "entity_id": "leader-akhilesh-yadav",
  "name": "Akhilesh Yadav",
  "aliases": [
    "Akhilesh Yadav",
    "अखिलेश यादव",
    "Netaji",
    "नेताजी",
    "@yadavakhilesh",
    "Akhilesh ji",
    "अखिलेश जी",
    "SP chief",
    "सपा प्रमुख",
    "अखिलेश यादव जी",
    "Mulayam's son"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "SP"
}
```

#### Mayawati (entity_id: `leader-mayawati`)

```json
{
  "entity_id": "leader-mayawati",
  "name": "Mayawati",
  "aliases": [
    "Mayawati",
    "मायावती",
    "Mayawati ji",
    "मायावती जी",
    "BSP chief",
    "बसपा प्रमुख",
    "Behenji",
    "बहनजी",
    "Kumari Mayawati",
    "कुमारी मायावती",
    "माया जी"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "BSP"
}
```

#### Priyanka Gandhi (entity_id: `leader-priyanka-gandhi`)

```json
{
  "entity_id": "leader-priyanka-gandhi",
  "name": "Priyanka Gandhi",
  "aliases": [
    "Priyanka Gandhi",
    "प्रियंका गांधी",
    "Priyanka Gandhi Vadra",
    "प्रियंका गांधी वाड्रा",
    "Priyanka ji",
    "प्रियंका जी"
  ],
  "entity_type": "leader",
  "level": "national",
  "party": "INC"
}
```

#### Arvind Kejriwal (entity_id: `leader-arvind-kejriwal`)

```json
{
  "entity_id": "leader-arvind-kejriwal",
  "name": "Arvind Kejriwal",
  "aliases": [
    "Arvind Kejriwal",
    "अरविंद केजरीवाल",
    "Kejriwal",
    "केजरीवाल",
    "AK",
    "केजरीवाल जी",
    "Delhi CM",
    "दिल्ली CM"
  ],
  "entity_type": "leader",
  "level": "state",
  "party": "AAP"
}
```

### 4.4 — Party Aliases

#### Samajwadi Party (entity_id: `party-sp`)

```json
{
  "entity_id": "party-sp",
  "name": "Samajwadi Party",
  "aliases": [
    "SP",
    "समाजवादी पार्टी",
    "सपा",
    "Samajwadi",
    "@samajwadi",
    "SP party",
    "साइकिल पार्टी",
    "cycle party"
  ],
  "entity_type": "party",
  "level": "state",
  "party": "SP"
}
```

#### Bahujan Samaj Party (entity_id: `party-bsp`)

```json
{
  "entity_id": "party-bsp",
  "name": "Bahujan Samaj Party",
  "aliases": [
    "BSP",
    "बहुजन समाज पार्टी",
    "बसपा",
    "Bahujan",
    "@BSPIndia",
    "हाथी पार्टी",
    "elephant party",
    "मायावती पार्टी"
  ],
  "entity_type": "party",
  "level": "state",
  "party": "BSP"
}
```

#### Indian National Congress (entity_id: `party-inc`)

```json
{
  "entity_id": "party-inc",
  "name": "Indian National Congress",
  "aliases": [
    "Congress",
    "INC",
    "कांग्रेस",
    "इंडियन नेशनल कांग्रेस",
    "@INCIndia",
    "Congress party",
    "कांग्रेस पार्टी",
    "हाथ पार्टी",
    "hand party"
  ],
  "entity_type": "party",
  "level": "national",
  "party": "INC"
}
```

### 4.5 — Alias Loading Cypher

```cypher
-- Load all entities from JSON on application startup
UNWIND $entities AS entity
MERGE (e:LeaderEntity {entity_id: entity.entity_id})
SET
  e.name = entity.name,
  e.aliases = entity.aliases,
  e.entity_type = entity.entity_type,
  e.level = entity.level,
  e.party = entity.party,
  e.constituency_id = entity.constituency_id
```

---

## Part 5 — Implementation Phases

### Phase 1: News-Based Constituency Sentiment (Week 1-2)

**Objective:** Establish the data collection and sentiment processing pipeline for constituency-level sentiment from news articles.

#### 5.1.1 — Tasks

| Task | Owner | Deliverable |
|---|---|---|
| Set up NewsData API polling with 13-key rotation | Backend | Polling service with rate limiting |
| Define UP-specific query templates | Research | Query configuration file |
| Integrate Sarvam AI Translation API | ML Engineering | Translation service module |
| Integrate Sarvam AI Sentiment API | ML Engineering | Sentiment classification service |
| Design SentimentObservation node creation | Backend | Cypher ingestion pipeline |
| Build constituency-level aggregation query | Backend | Aggregation service |
| Create GET /api/up/sentiment/:constituencyId | API Engineering | REST endpoint with caching |

#### 5.1.2 — Acceptance Criteria

- [ ] NewsData API successfully polls 80+ UP queries per cycle
- [ ] Hindi articles translated to English with >90% accuracy (spot check)
- [ ] Sentiment classification produces positive/negative/neutral with confidence scores
- [ ] SentimentObservation nodes created in Neo4j with all required properties
- [ ] SentimentAggregation nodes computed for all 80 LS constituencies
- [ ] API endpoint returns correct JSON format within 500ms

#### 5.1.3 — API Specification

```
GET /api/up/sentiment/:constituencyId?time_window=last_7d

Response:
{
  "constituency_id": "UP-01",
  "constituency_name": "Saharanpur",
  "time_window": "last_7d",
  "aggregations": [
    {
      "entity_id": "party-bjp",
      "entity_name": "BJP",
      "positive_pct": 52.3,
      "negative_pct": 31.2,
      "neutral_pct": 16.5,
      "total_count": 347,
      "dominant_sentiment": "positive",
      "trending": "improving"
    }
  ],
  "computed_at": "2026-05-03T10:30:00Z"
}
```

### Phase 2: Social Media + Entity Resolution (Week 2-3)

**Objective:** Expand data sources to social media and implement robust entity resolution for leader/party/issue mentions.

#### 5.2.1 — Tasks

| Task | Owner | Deliverable |
|---|---|---|
| Load entity alias database into Neo4j | Backend | LeaderEntity nodes with aliases |
| Implement entity resolution module | ML Engineering | Alias matching service |
| X/Twitter API integration (if available) | Backend | Social media data source |
| YouTube comment scraper | Backend | Comment extraction pipeline |
| Code-mixed Hindi-English sentiment pipeline | ML Engineering | Sarvam + mBERT ensemble |
| Create GET /api/up/sentiment/entity/:entityId | API Engineering | Entity sentiment endpoint |

#### 5.2.2 — Acceptance Criteria

- [ ] All 15+ entities loaded into Neo4j with complete alias lists
- [ ] Entity resolution correctly identifies >85% of leader/party mentions (eval set)
- [ ] Code-mixed text sentiment classification matches human annotation >75%
- [ ] YouTube comments processed from 20+ UP political channels
- [ ] Entity sentiment API returns per-entity breakdown

#### 5.2.3 — Entity Resolution Evaluation

```python
# Evaluation script: tests/entity_resolution_test.py
def test_entity_resolution():
    test_cases = [
        ("योगी सरकार ने नई योजना शुरू की", ["leader-yogi-adityanath"]),
        ("BJP ने UP में प्रचार तेज कर दिया", ["party-bjp"]),
        ("मोदी और योगी की बैठक", ["leader-narendra-modi", "leader-yogi-adityanath"]),
        ("अखिलेश ने केंद्र सरकार पर निशाना साधा", ["leader-akhilesh-yadav"]),
    ]
    for text, expected in test_cases:
        result = resolve_entity(text, alias_db)
        assert set(r["entity_id"] for r in result) == set(expected)
```

### Phase 3: Booth-Level Disaggregation (Week 3-4)

**Objective:** Implement spatial interpolation to disaggregate constituency-level sentiment to booth level.

#### 5.3.1 — Tasks

| Task | Owner | Deliverable |
|---|---|---|
| Load SHRUG census data into Neo4j | Data Engineering | Demographic nodes per booth/VS |
| Implement spatial interpolation algorithm | ML Engineering | Disaggregation service |
| Build LS → VS → Booth hierarchy in Neo4j | Data Engineering | Graph relationships |
| Calibrate demographic weights | Data Science | Weight calibration report |
| Store booth-level SentimentAggregation nodes | Backend | Booth aggregation pipeline |
| Create GET /api/up/sentiment/booth/:boothId | API Engineering | Booth sentiment endpoint |

#### 5.3.2 — SHRUG Data Schema

```cypher
CREATE (booth:Booth {
  booth_id: "UP-BOOTH-000001",
  constituency_id: "UP-VS-01-1",
  village_name: "Nagli Jat",
  village_code: "123456",
  district: "Saharanpur",
  population: 2847,
  literacy_rate: 0.67,
  urban_ratio: 0.0,
  socioeconomic_index: 0.45,
  total_voters: 1523
})
```

#### 5.3.3 — Acceptance Criteria

- [ ] All 162,000+ booths loaded with SHRUG demographic data
- [ ] Spatial interpolation produces booth-level sentiment within 10% of constituency baseline
- [ ] Booth-level API returns sentiment with confidence adjusted for interpolation uncertainty
- [ ] Weights calibrated against 2022 VS election data (backtest)

#### 5.3.4 — API Specification

```
GET /api/up/sentiment/booth/:boothId

Response:
{
  "booth_id": "UP-BOOTH-000001",
  "constituency_id": "UP-VS-01-1",
  "village_name": "Nagli Jat",
  "district": "Saharanpur",
  "sentiment": {
    "entity_id": "party-bjp",
    "positive_pct": 48.7,
    "negative_pct": 35.1,
    "neutral_pct": 16.2,
    "dominant_sentiment": "positive",
    "trending": "stable",
    "confidence_adjusted": 0.72,
    "interpolation_note": "Derived via spatial interpolation from constituency-level sentiment"
  },
  "demographics": {
    "population": 2847,
    "literacy_rate": 0.67,
    "urban_ratio": 0.0,
    "total_voters": 1523
  }
}
```

### Phase 4: Dashboard + Alerts (Week 4-5)

**Objective:** Build visualization dashboard and real-time alert system for sentiment monitoring.

#### 5.4.1 — Tasks

| Task | Owner | Deliverable |
|---|---|---|
| D3.js UP constituency heatmap | Frontend | Interactive SVG map |
| Real-time alert engine | Backend | Rule-based alert system |
| Alert rules implementation | Backend | 3 alert types with thresholds |
| GET /api/up/sentiment/alerts | API Engineering | Alert feed endpoint |
| GET /api/up/sentiment/heatmap | API Engineering | Heatmap data endpoint |
| Trending indicators on dashboard | Frontend | Visual trend arrows |

#### 5.4.2 — Alert Rules

```python
ALERT_RULES = [
    {
        "id": "HIGH_ALERT",
        "condition": (
            lambda agg: agg.negative_pct > 60
            and agg.seat_status in ["competitive", "tossup"]
        ),
        "severity": "HIGH",
        "message": "High negative sentiment in competitive seat: {constituency_name}",
        "channel": ["email", "slack", "sms"],
    },
    {
        "id": "MEDIUM_ALERT",
        "condition": (
            lambda agg: agg.trending == "declining"
            and agg.days_until_election < 30
        ),
        "severity": "MEDIUM",
        "message": "Declining sentiment trend in {constituency_name} — {days_until_election} days to election",
        "channel": ["email", "slack"],
    },
    {
        "id": "LEADER_RISK_ALERT",
        "condition": (
            lambda agg: agg.entity_id in [
                "leader-yogi-adityanath", "leader-narendra-modi"
            ]
            and agg.positive_pct < 40
        ),
        "severity": "HIGH",
        "message": "Leader {entity_name} sentiment below 40% in {constituency_name}",
        "channel": ["email", "slack", "sms"],
    },
]
```

#### 5.4.3 — Heatmap Data API

```
GET /api/up/sentiment/heatmap?election_id=LS2024&entity_id=party-bjp&time_window=last_7d

Response:
{
  "election_id": "LS2024",
  "entity_id": "party-bjp",
  "time_window": "last_7d",
  "constituencies": [
    {
      "constituency_id": "UP-01",
      "name": "Saharanpur",
      "positive_pct": 52.3,
      "negative_pct": 31.2,
      "neutral_pct": 16.5,
      "dominant_sentiment": "positive",
      "trending": "improving",
      "center_lat": 29.96,
      "center_lng": 77.55,
      "boundary_coords": [[...]]
    },
    ...
  ]
}
```

#### 5.4.4 — Acceptance Criteria

- [ ] Heatmap renders full UP constituency map in <3 seconds
- [ ] Alert engine evaluates rules every 15 minutes
- [ ] HIGH_ALERT triggers within 5 minutes of threshold breach
- [ ] Dashboard shows sentiment, trend, and alert status per constituency

### Phase 5: Historical Correlation + Validation (Week 5-6)

**Objective:** Back-test the sentiment pipeline against 2022 VS and 2024 LS election results to validate predictive power.

#### 5.5.1 — Tasks

| Task | Owner | Deliverable |
|---|---|---|
| Collect 2022 VS election results | Research | ECI result dataset |
| Collect 2024 LS election results | Research | ECI result dataset |
| Re-run pipeline on historical data | ML Engineering | Backtest execution |
| Calculate per-constituency accuracy | Data Science | Accuracy report |
| Document limitations | Product | Limitations section |
| Publish validation findings | Team | Internal report |

#### 5.5.2 — Validation Methodology

```
For each constituency in 2022 VS and 2024 LS:
  1. Run sentiment pipeline on data from 30 days before election
  2. Compute dominant sentiment for each party/leader
  3. Compare dominant sentiment party vs. actual winning party
  4. Calculate accuracy = correct_predictions / total_constituencies

Additional metrics:
  - Margin correlation: sentiment gap vs. vote margin (Pearson r)
  - Swing detection: sentiment trend direction vs. seat swing
  - False positive rate: seats flagged as competitive but won easily
  - False negative rate: seats not flagged but lost
```

#### 5.5.3 — Acceptance Criteria

- [ ] Backtest achieves >70% constituency-level accuracy
- [ ] Pearson correlation between sentiment gap and vote margin >0.4
- [ ] Limitations documented with confidence intervals
- [ ] Findings published and shared with stakeholders

---

## Part 6 — API Endpoints

### 6.1 — Constituency Sentiment

```
GET /api/up/sentiment/:constituencyId
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| time_window | ENUM | `last_7d` | `last_24h`, `last_7d`, `last_30d`, `last_90d`, `all_time` |
| entity_id | STRING | all | Filter by specific entity |
| source_type | ENUM | all | Filter by source: `news`, `twitter`, `youtube`, `survey` |

**Response (200):**

```json
{
  "constituency_id": "UP-01",
  "constituency_name": "Saharanpur",
  "election_type": "LS",
  "time_window": "last_7d",
  "total_observations": 1247,
  "aggregations": [
    {
      "entity_id": "party-bjp",
      "entity_name": "BJP",
      "entity_type": "party",
      "positive_count": 652,
      "negative_count": 389,
      "neutral_count": 206,
      "total_count": 1247,
      "positive_pct": 52.3,
      "negative_pct": 31.2,
      "neutral_pct": 16.5,
      "dominant_sentiment": "positive",
      "trending": "improving",
      "avg_confidence": 0.78
    }
  ],
  "source_breakdown": {
    "news": 847,
    "twitter": 234,
    "youtube": 166
  },
  "computed_at": "2026-05-03T10:30:00Z"
}
```

**Response (404):**

```json
{
  "error": "Constituency not found",
  "constituency_id": "UP-99"
}
```

### 6.2 — Booth Sentiment

```
GET /api/up/sentiment/booth/:boothId
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| time_window | ENUM | `last_7d` | Aggregation window |
| entity_id | STRING | all | Filter by entity |

**Response (200):**

```json
{
  "booth_id": "UP-BOOTH-000001",
  "constituency_id": "UP-VS-01-1",
  "village_name": "Nagli Jat",
  "district": "Saharanpur",
  "time_window": "last_7d",
  "sentiment": {
    "entity_id": "party-bjp",
    "positive_pct": 48.7,
    "negative_pct": 35.1,
    "neutral_pct": 16.2,
    "dominant_sentiment": "positive",
    "trending": "stable",
    "confidence_adjusted": 0.72
  },
  "demographics": {
    "population": 2847,
    "literacy_rate": 0.67,
    "urban_ratio": 0.0,
    "total_voters": 1523
  },
  "interpolation_metadata": {
    "method": "weighted_distribution",
    "constituency_sentiment": 52.3,
    "adjustment_factor": 0.93,
    "note": "Derived via spatial interpolation from constituency-level sentiment"
  }
}
```

### 6.3 — Entity Sentiment

```
GET /api/up/sentiment/entity/:entityId
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| time_window | ENUM | `last_7d` | Aggregation window |
| constituency_id | STRING | all | Filter by constituency |
| geographic_scope | ENUM | all | `state`, `district`, `constituency` |

**Response (200):**

```json
{
  "entity_id": "leader-yogi-adityanath",
  "entity_name": "Yogi Adityanath",
  "entity_type": "leader",
  "party": "BJP",
  "time_window": "last_7d",
  "state_level": {
    "positive_pct": 58.2,
    "negative_pct": 28.4,
    "neutral_pct": 13.4,
    "total_count": 4521,
    "trending": "stable"
  },
  "constituency_breakdown": [
    {
      "constituency_id": "UP-01",
      "constituency_name": "Saharanpur",
      "positive_pct": 55.1,
      "negative_pct": 30.2,
      "trending": "declining"
    }
  ],
  "top_topics": [
    {"topic": "law_and_order", "count": 1234, "avg_sentiment": 0.42},
    {"topic": "development", "count": 987, "avg_sentiment": 0.61}
  ]
}
```

### 6.4 — Heatmap Data

```
GET /api/up/sentiment/heatmap
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| election_id | STRING | YES | `LS2024`, `VS2022`, `VS2026` |
| entity_id | STRING | YES | Entity to visualize |
| time_window | ENUM | NO | Default `last_7d` |

**Response (200):**

```json
{
  "election_id": "LS2024",
  "entity_id": "party-bjp",
  "time_window": "last_7d",
  "constituencies": [
    {
      "constituency_id": "UP-01",
      "name": "Saharanpur",
      "positive_pct": 52.3,
      "negative_pct": 31.2,
      "neutral_pct": 16.5,
      "dominant_sentiment": "positive",
      "trending": "improving",
      "center_lat": 29.96,
      "center_lng": 77.55,
      "boundary_coords": [[77.50, 29.90], [77.60, 29.90], [77.60, 30.00], [77.50, 30.00]],
      "seat_status": "competitive",
      "previous_winner": "SP"
    }
  ],
  "metadata": {
    "total_constituencies": 80,
    "avg_positive_pct": 48.7,
    "min_positive_pct": 22.1,
    "max_positive_pct": 73.4,
    "generated_at": "2026-05-03T10:30:00Z"
  }
}
```

### 6.5 — Alerts

```
GET /api/up/sentiment/alerts
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| severity | ENUM | all | `HIGH`, `MEDIUM`, `LOW` |
| acknowledged | BOOLEAN | false | Filter acknowledged alerts |

**Response (200):**

```json
{
  "alerts": [
    {
      "alert_id": "ALT-20260503-001",
      "rule_id": "HIGH_ALERT",
      "severity": "HIGH",
      "constituency_id": "UP-23",
      "constituency_name": "Muzaffarnagar",
      "entity_id": "party-bjp",
      "message": "High negative sentiment (67.2%) in competitive seat: Muzaffarnagar",
      "triggered_at": "2026-05-03T09:15:00Z",
      "acknowledged": false,
      "data": {
        "negative_pct": 67.2,
        "positive_pct": 21.3,
        "seat_status": "competitive",
        "trending": "declining"
      }
    }
  ],
  "total_count": 12,
  "unacknowledged_count": 7
}
```

### 6.6 — Ground Feedback

```
POST /api/up/sentiment/ground-feedback
```

**Request Body:**

```json
{
  "booth_id": "UP-BOOTH-000001",
  "constituency_id": "UP-VS-01-1",
  "surveyor_id": "SRV-042",
  "survey_date": "2026-05-03",
  "responses": [
    {
      "entity_id": "party-bjp",
      "sentiment": "positive",
      "confidence": 0.9
    },
    {
      "entity_id": "leader-yogi-adityanath",
      "sentiment": "positive",
      "confidence": 0.85
    }
  ],
  "sample_size": 45,
  "metadata": {
    "location": "Nagli Jat Primary School",
    "demographic_notes": "Predominantly rural, agricultural community"
  }
}
```

**Response (201):**

```json
{
  "observation_ids": ["OBS-GF-20260503-0001", "OBS-GF-20260503-0002"],
  "message": "Ground feedback recorded successfully",
  "booth_id": "UP-BOOTH-000001"
}
```

### 6.7 — Trending Entities

```
GET /api/up/sentiment/trending
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| direction | ENUM | all | `improving`, `declining`, `stable`, `volatile` |
| time_window | ENUM | `last_7d` | Aggregation window |
| entity_type | ENUM | all | `party`, `leader`, `issue` |

**Response (200):**

```json
{
  "trending": [
    {
      "entity_id": "party-bjp",
      "entity_name": "BJP",
      "entity_type": "party",
      "direction": "declining",
      "current_positive_pct": 48.7,
      "previous_positive_pct": 54.2,
      "change_pct": -5.5,
      "constituencies_affected": 23,
      "top_declining_constituencies": [
        {"constituency_id": "UP-23", "name": "Muzaffarnagar", "change_pct": -12.3},
        {"constituency_id": "UP-45", "name": "Meerut", "change_pct": -9.1}
      ]
    }
  ],
  "time_window": "last_7d",
  "generated_at": "2026-05-03T10:30:00Z"
}
```

---

## Part 7 — Data Lineage

Every `SentimentObservation` node must carry complete provenance metadata to ensure auditability and reproducibility.

### 7.1 — Required Lineage Fields

| Field | Type | Source | Purpose |
|---|---|---|---|
| source_type | ENUM | Input | Identifies data origin |
| source_url | STRING | Input | Original document URL |
| source_date | DATE | Input | Publication/creation date |
| model_version | STRING | Processing | Model used for sentiment classification |
| confidence | FLOAT | Processing | Model confidence score |
| text_excerpt | STRING | Input | Original text for audit |
| language | ENUM | Processing | Detected language |
| ingested_at | DATETIME | System | Pipeline ingestion timestamp |

### 7.2 — Model Version Tracking

```
Model Version Format: {model-name}-v{major}.{minor}.{patch}

Examples:
  sarvam-sentiment-v1.0.0
  mbert-hindi-v2.1.0
  xlmr-fallback-v1.0.0
  fasttext-lid-v1.0.0
```

Model versions are tracked in a registry:

```json
{
  "models": {
    "sarvam-sentiment-v1.0.0": {
      "deployed_at": "2026-04-01T00:00:00Z",
      "accuracy_on_eval_set": 0.78,
      "languages_supported": ["hi", "hi-en-mixed"],
      "status": "active"
    },
    "mbert-hindi-v2.1.0": {
      "deployed_at": "2026-03-15T00:00:00Z",
      "accuracy_on_eval_set": 0.74,
      "languages_supported": ["hi", "en", "hi-en-mixed"],
      "status": "active"
    }
  }
}
```

### 7.3 — Audit Query

```cypher
-- Retrieve full lineage for a specific observation
MATCH (obs:SentimentObservation {obs_id: $obs_id})
OPTIONAL MATCH (obs)-[:MENTIONS]->(entity:LeaderEntity)
OPTIONAL MATCH (obs)-[:ABOUT_CONSTITUENCY]->(const:Constituency)
OPTIONAL MATCH (obs)-[:ABOUT_BOOTH]->(booth:Booth)
RETURN
  obs.obs_id,
  obs.source_type,
  obs.source_url,
  obs.source_date,
  obs.text_excerpt,
  obs.language,
  obs.entity_id,
  entity.name AS entity_name,
  obs.sentiment,
  obs.confidence,
  obs.model_version,
  obs.topic,
  obs.geographic_scope,
  obs.constituency_id,
  const.name AS constituency_name,
  obs.booth_id,
  booth.village_name AS booth_village,
  obs.ingested_at
```

### 7.4 — Lineage Verification Script

```python
def verify_lineage(observation_id: str) -> dict:
    """Verify that an observation has complete lineage metadata."""
    obs = neo4j_query("MATCH (obs:SentimentObservation {obs_id: $id}) RETURN obs", {"id": observation_id})

    required_fields = [
        "source_type", "source_url", "source_date", "text_excerpt",
        "language", "entity_id", "entity_type", "sentiment",
        "confidence", "topic", "geographic_scope", "constituency_id",
        "model_version", "ingested_at"
    ]

    missing = [f for f in required_fields if f not in obs or obs[f] is None]

    return {
        "observation_id": observation_id,
        "lineage_complete": len(missing) == 0,
        "missing_fields": missing,
        "model_registered": obs.get("model_version") in MODEL_REGISTRY,
    }
```

---

## Part 8 — Known Limitations

### 8.1 — Social Media Bias

Social media discourse represents a **vocal minority**, not the silent majority. Key biases:

- **Age bias:** Younger demographics (18-35) are overrepresented on X/Twitter and YouTube
- **Urban bias:** Urban areas have higher internet penetration and social media usage
- **Language bias:** English and Hindi-dominant users are overrepresented; regional dialect speakers (Braj, Awadhi, Bhojpuri) are underrepresented
- **Participation bias:** Users with strong opinions (positive or negative) post more than neutral users

**Mitigation:** Weight digital signals with ground survey data where available. Apply urban dampening factor (0.85) to urban booth sentiment from digital sources.

### 8.2 — Booth-Level Inference

Booth-level sentiment is **interpolated, not directly measured**. The spatial distribution model introduces uncertainty:

- Interpolation assumes sentiment varies smoothly across geographic space (may not hold for polarized areas)
- Demographic weights are calibrated from census data, which may be outdated
- Confidence scores for booth-level sentiment should be interpreted with 15-25% uncertainty margin

**Mitigation:** Clearly mark booth-level data as "interpolated" in all API responses. Provide confidence_adjusted scores.

### 8.3 — Hindi Dialect Variation

Uttar Pradesh has significant dialect diversity that may affect sentiment classification accuracy:

| Dialect | Region | Impact |
|---|---|---|
| Braj | Western UP (Mathura, Agra) | Sarvam AI trained on standard Hindi; Braj vocabulary may reduce accuracy |
| Awadhi | Eastern UP (Ayodhya, Gorakhpur) | Similar to standard Hindi but distinct vocabulary |
| Bhojpuri | Eastern UP (Varanasi, Gorakhpur, Deoria) | Significantly different grammar and vocabulary; lowest accuracy expected |
| Purvi (Khariboli) | Central UP | Closest to standard Hindi; highest accuracy |
| Bundeli | Southern UP (Jhansi, Lalitpur) | Moderate vocabulary differences |

**Mitigation:** Track dialect-specific accuracy in evaluation. Consider dialect-aware fine-tuning in future iterations.

### 8.4 — News Sentiment vs. Ground Sentiment

News articles reflect **editorial framing**, not necessarily ground-level public opinion:

- Newspapers have editorial biases that affect tone
- News coverage volume correlates with newsworthiness, not public importance
- Negative news is overrepresented (negativity bias in media)

**Mitigation:** Weight ground survey data higher than news data when both are available. Use multiple news sources to reduce single-source bias.

### 8.5 — Temporal Lag

The sentiment pipeline has inherent temporal delays:

- **News collection:** Articles published today may reflect events from 2-5 days ago
- **Processing latency:** 5-minute average from collection to availability in API
- **Aggregation window:** 24h minimum for meaningful aggregation
- **Not real-time:** System is not designed for sub-minute sentiment updates

### 8.6 — No Individual Voter Profiling

This system operates at **aggregate level only**:

- No individual voter data is collected or analyzed
- No micro-targeting capabilities are provided
- All outputs are constituency-level or booth-level aggregates
- System complies with Indian data protection regulations (DPDP Act 2023)

### 8.7 — Model Accuracy Ceiling

Even with best-in-class models, sentiment classification accuracy has theoretical limits:

- Code-mixed Hindi-English political text: ~75-80% F1 (per EMNLP 2025 research)
- Sarcasm and irony detection: <60% accuracy (known NLP limitation)
- Implicit sentiment (without explicit positive/negative words): <70% accuracy

---

## Part 9 — Success Metrics

### 9.1 — Prediction Accuracy

| Metric | Target | Measurement |
|---|---|---|
| Constituency-level accuracy | >70% | % of constituencies where dominant sentiment party matches ECI winner |
| Vote margin correlation | Pearson r > 0.4 | Correlation between sentiment gap and actual vote margin |
| Swing detection rate | >75% | % of seats that swung correctly predicted by sentiment trend |
| False positive rate | <20% | % of seats flagged as competitive but won by >10% margin |
| False negative rate | <25% | % of seats not flagged as competitive but lost |

### 9.2 — Alert System Performance

| Metric | Target | Measurement |
|---|---|---|
| Competitive seat detection | >80% | % of competitive seats correctly flagged with negative sentiment |
| Alert latency | <5 minutes | Time from threshold breach to alert generation |
| Alert precision | >70% | % of HIGH_ALERTs that correspond to actual negative sentiment shifts |

### 9.3 — Pipeline Performance

| Metric | Target | Measurement |
|---|---|---|
| Daily article throughput | >1000 articles/day | Count of unique articles processed per day |
| Processing latency | <5 minutes | Time from article ingestion to sentiment availability |
| API response time (p95) | <500ms | 95th percentile API response latency |
| Neo4j query time (p95) | <200ms | 95th percentile Cypher query execution time |
| System uptime | >99.5% | Monthly uptime percentage |

### 9.4 — Model Quality

| Metric | Target | Measurement |
|---|---|---|
| Sarvam AI code-mixed accuracy | >75% | F1 score on held-out code-mixed Hindi-English eval set |
| Entity resolution accuracy | >85% | % of leader/party mentions correctly resolved |
| Language detection accuracy | >95% | % of texts correctly classified as hi/en/hi-en-mixed |
| Translation quality | >90% | BLEU score for Hindi-to-English translation (spot check) |

### 9.5 — Dashboard Performance

| Metric | Target | Measurement |
|---|---|---|
| Heatmap render time | <3 seconds | Time to render full UP constituency heatmap |
| Page load time (p95) | <2 seconds | 95th percentile dashboard page load |
| Data freshness | <15 minutes | Time from data collection to dashboard update |

### 9.6 — Measurement Cadence

| Metric | Frequency | Owner |
|---|---|---|
| Constituency accuracy | Post-election | Data Science |
| Alert precision | Weekly | Backend |
| Pipeline throughput | Daily | SRE |
| Model accuracy | Monthly (continuous eval) | ML Engineering |
| API latency | Continuous (APM) | SRE |
| Dashboard performance | Weekly | Frontend |

### 9.7 — Continuous Evaluation Framework

```python
# Continuous eval: run on a rolling 30-day window
def evaluate_sentiment_pipeline():
    """Evaluate sentiment pipeline against ground truth labels."""
    eval_set = load_eval_set(window="last_30d")

    results = {
        "total_samples": len(eval_set),
        "correct_predictions": 0,
        "by_source": {},
        "by_language": {},
        "by_entity": {},
    }

    for sample in eval_set:
        predicted = classify_sentiment(sample.text)
        actual = sample.human_label

        if predicted == actual:
            results["correct_predictions"] += 1

        # Track by dimensions
        source = sample.source_type
        lang = sample.language
        entity = sample.entity_id

        results["by_source"].setdefault(source, {"correct": 0, "total": 0})
        results["by_language"].setdefault(lang, {"correct": 0, "total": 0})
        results["by_entity"].setdefault(entity, {"correct": 0, "total": 0})

        results["by_source"][source]["total"] += 1
        results["by_language"][lang]["total"] += 1
        results["by_entity"][entity]["total"] += 1

        if predicted == actual:
            results["by_source"][source]["correct"] += 1
            results["by_language"][lang]["correct"] += 1
            results["by_entity"][entity]["correct"] += 1

    results["overall_accuracy"] = results["correct_predictions"] / results["total_samples"]

    return results
```

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| LS | Lok Sabha (Parliamentary constituency) |
| VS | Vidhan Sabha (Assembly constituency) |
| SHRUG | South Asia Region at Harvard University Geospatial dataset |
| PS | Polling Station |
| Code-mixed | Text containing words from multiple languages (Hindi + English) |
| Spatial interpolation | Estimating values at unmeasured locations from nearby measured values |
| Kriging | Geostatistical interpolation method using spatial autocorrelation |
| ECI | Election Commission of India |
| F1 Score | Harmonic mean of precision and recall |

## Appendix B — File Structure

```
sentiment-engine/
├── config/
│   ├── entities/
│   │   └── up_entities.json          # Entity alias database
│   ├── queries/
│   │   └── news_queries.json         # NewsData API query templates
│   └── topics/
│       └── topic_taxonomy.json       # Topic keyword mappings
├── src/
│   ├── collectors/
│   │   ├── newsdata.py               # NewsData API polling
│   │   ├── twitter.py                # X/Twitter API (conditional)
│   │   ├── youtube.py                # YouTube comment scraper
│   │   └── ground_feedback.py        # Ground survey input handler
│   ├── processors/
│   │   ├── language_detection.py     # fastText language ID
│   │   ├── translation.py            # Sarvam AI translation
│   │   ├── sentiment.py              # Sarvam + mBERT ensemble
│   │   ├── entity_resolution.py      # Alias matching
│   │   └── topic_classification.py   # Topic keyword matching
│   ├── disaggregation/
│   │   ├── spatial_interpolation.py  # Kriging-like weighted distribution
│   │   └── demographic_weights.py    # SHRUG weight calibration
│   ├── aggregation/
│   │   ├── constituency_agg.py       # Constituency-level aggregation
│   │   └── booth_agg.py              # Booth-level aggregation
│   ├── alerts/
│   │   └── alert_engine.py           # Rule-based alert system
│   └── api/
│       ├── routes/
│       │   ├── sentiment.py          # Sentiment API routes
│       │   └── alerts.py             # Alert API routes
│       └── schemas/
│           └── response.py           # Pydantic response models
├── neo4j/
│   ├── schema/
│   │   ├── constraints.cypher        # Unique constraints
│   │   ├── indexes.cypher            # Index definitions
│   │   └── relationships.cypher      # Relationship schemas
│   └── queries/
│       ├── aggregation.cypher        # Aggregation queries
│       └── trending.cypher           # Trending queries
├── tests/
│   ├── test_entity_resolution.py
│   ├── test_sentiment_classification.py
│   ├── test_spatial_interpolation.py
│   └── test_api_endpoints.py
└── docs/
    ├── SENTIMENT_ANALYSIS_PRD.md     # This document
    └── validation/
        └── backtest_report.md        # Phase 5 validation findings
```

## Appendix C — Security and Compliance

- **Data Protection:** All personally identifiable information (PII) from ground surveys is anonymized before storage
- **DPDP Act 2023:** System complies with India's Digital Personal Data Protection Act 2023
- **API Key Management:** NewsData API keys stored in secrets manager, rotated monthly
- **Audit Trail:** All data ingestion and processing events logged with timestamps
- **Access Control:** Role-based access to admin dashboard (analyst, admin, super-admin)
- **snscrape Compliance Warning:** X/Twitter scraping via snscrape may violate platform Terms of Service. Use only for research-scale, non-commercial academic purposes. Do not use for production-critical decision-making without legal review.

## Appendix D — Implementation Requirements

### What We Need to Start Building Phase 1

#### A. Infrastructure & Dependencies

| Item | Status | Notes |
|---|---|---|
| Local Neo4j Docker | ✅ Running | `neo4j:5.14-community` on localhost:7687, APOC enabled |
| Python 3.10+ | ❓ Verify | Need Python environment separate from Node.js server |
| `pip install vaderSentiment` | ❓ Install | Fast baseline for English-only text |
| `pip install transformers torch` | ❓ Install | Main multilingual sentiment engine (CPU OK, GPU recommended) |
| `pip install fasttext` | ❓ Install | Language detection (lid.176.bin model) |
| `pip install spacy` + `python -m spacy download en_core_web_sm` | ❓ Install | NER pipeline for entity resolution |
| `pip install snscrape` | ❓ Install | X/Twitter scraping (may need git install: `pip install git+https://github.com/bisguzar/twitter-scraper`) |
| `pip install requests` | ✅ Likely | Already available in most environments |
| `pip install pandas` | ❓ Install | Data manipulation for tweet/article aggregation |
| Sarvam AI API key | ✅ Available | Already in `.env.local` as `SARVAM_API_KEY` |
| NewsData API keys | ✅ Available | 13 keys already hardcoded in `server.js` (should be moved to `.env`) |

#### B. Data

| Item | Status | Notes |
|---|---|---|
| NewsData API queries | ✅ Ready | 13 keys available; need UP-specific query templates |
| X/Twitter queries | ✅ Defined | 15+ queries for UP BJP/SP/BSP/leaders defined above |
| Entity alias database | ✅ Ready | 15+ entities with Hindi/English aliases in PRD Part 4 |
| Constituency names map | ✅ Partial | 80 LS names exist in Neo4j; need Hindi variants for matching |
| SHRUG census data | ❌ Missing | Required for booth-level demographic weighting (Phase 3) |
| Ground survey forms | ❌ Missing | Required for ground truth validation (Phase 1+) |

#### C. Neo4j Schema (to be added to local DB)

| Item | Cypher | Status |
|---|---|---|
| `SentimentObservation` constraint + indexes | See Part 3.1.1 | ❌ Not created yet |
| `SentimentAggregation` constraint + indexes | See Part 3.1.2 | ❌ Not created yet |
| `LeaderEntity` constraint + fulltext index | See Part 3.1.3 | ❌ Not created yet |
| Load entity aliases into `LeaderEntity` nodes | See Part 4.5 | ❌ Not loaded yet |
| Create `MENTIONS`, `ABOUT_CONSTITUENCY`, `ABOUT_BOOTH`, `AGGREGATES_FOR` relationships | See Part 3.2 | ❌ Not created yet |

#### D. Development Environment Setup

```bash
# 1. Create Python virtual environment
mkdir -p sentiment_engine
cd sentiment_engine
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install vaderSentiment transformers torch fasttext spacy snscrape pandas requests

# 3. Download spaCy models
python -m spacy download en_core_web_sm
python -m spacy download hi_core_news_sm  # Hindi NER model

# 4. Download fastText language ID model
# Download lid.176.bin from: https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin

# 5. Test transformer pipeline
python -c "
from transformers import pipeline
classifier = pipeline('sentiment-analysis', model='tabularisai/multilingual-sentiment-analysis')
print(classifier('योगी सरकार ने अच्छा काम किया'))  # Hindi test
print(classifier('BJP is doing great work in UP'))  # English test
"
```

#### E. First Steps (Week 1 — Immediate)

1. **Set up Python environment** with `transformers`, `vaderSentiment`, `spacy`, `snscrape`
2. **Create Neo4j schema** — run constraints/indexes from Part 3
3. **Load entity aliases** — create `LeaderEntity` nodes from Part 4 JSON
4. **Build NewsData collector** — poll 13 keys with UP queries, store articles
5. **Build sentiment classifier** — multilingual transformer on article text
6. **Store `SentimentObservation` nodes** — one per article with full provenance
7. **Build aggregation query** — compute constituency-level sentiment
8. **Create `GET /api/up/sentiment/:constituencyId`** — return aggregation JSON

### What I Need From You

1. **Confirm Python version** — run `python --version` on your machine
2. **Confirm GPU availability** — run `nvidia-smi` (if GPU exists, transformer inference will be 10x faster)
3. **NewsData API keys** — extract the 13 keys from `server.js` into `.env.local`
4. **X/Twitter risk tolerance** — do you want snscrape enabled now, or defer to Phase 2?
5. **Priority** — should I start with Phase 1 (News-based constituency sentiment) immediately?

## Appendix D — Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-03 | UP Election Ontology Team | Initial PRD |
