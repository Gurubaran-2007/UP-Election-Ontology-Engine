import re
import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sentiment_engine.config.settings import (
    SENTIMENT_MODEL, MAX_SENTIMENT_INPUT_LENGTH, BATCH_SIZE,
    TOPIC_KEYWORDS, SARVAM_API_KEY,
)
from sentiment_engine.src.processors.language_detection import detect_language

# torch/transformers optional — install via: .venv/bin/pip install torch transformers
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    _tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
    _model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
    _model.eval()
    _TRANSFORMER_AVAILABLE = True
    print("[SENTIMENT] DistilBERT multilingual model loaded.")
except Exception:
    _TRANSFORMER_AVAILABLE = False
    _tokenizer = None
    _model = None
    print("[SENTIMENT] torch/transformers not available — using Sarvam AI for Hindi, VADER for English.")

vader = SentimentIntensityAnalyzer()

LABEL_MAP = {0: "negative", 1: "neutral", 2: "positive"}

_SARVAM_URL = "https://api.sarvam.ai/v1/chat/completions"
_SARVAM_MODEL = "sarvam-105b"

_SARVAM_PROMPT = """You are a sentiment classifier for Indian political news. Classify the sentiment of the text below as exactly one of: positive, negative, neutral.

Rules:
- Reply on a single line in this exact format: <label> <confidence>
- <label> must be one of: positive, negative, neutral
- <confidence> must be a decimal between 0.0 and 1.0
- Do not add any explanation.

Text: {text}"""


def classify_sentiment(text):
    """Multi-model sentiment classification with language routing per PRD 2.3.0"""
    lang = detect_language(text)
    topic = classify_topic(text)

    result = {
        "sentiment": "neutral",
        "confidence": 0.5,
        "model": "default",
        "language": lang,
        "topic": topic,
        "vader_score": None,
        "vader_label": None,
    }

    if lang == "en":
        return _classify_vader(text, lang, topic)

    # Hindi / mixed — try transformer first, then Sarvam, then VADER fallback
    if _TRANSFORMER_AVAILABLE:
        return _classify_transformer(text, lang, topic)

    if SARVAM_API_KEY:
        sarvam_result = _classify_sarvam(text, lang, topic)
        if sarvam_result:
            return sarvam_result

    # VADER fallback for non-English when nothing else is available
    return _classify_vader(text, lang, topic, model_label="vader-fallback-v1.0")


def classify_batch(texts):
    """Batch sentiment classification — routes each text by language."""
    return [classify_sentiment(t) for t in texts]


def classify_topic(text):
    """Classify text into topic taxonomy per PRD 2.3.5"""
    text_lower = text.lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in text_lower:
                return topic
    return "general"


# ── Private helpers ──────────────────────────────────────────────────────────

def _classify_vader(text, lang, topic, model_label="vader-en-v1.0"):
    score = vader.polarity_scores(text)["compound"]
    label = _vader_to_label(score)
    return {
        "sentiment": label,
        "confidence": round(abs(score), 4),
        "model": model_label,
        "language": lang,
        "topic": topic,
        "vader_score": score,
        "vader_label": label,
    }


def _classify_transformer(text, lang, topic):
    import torch
    with torch.no_grad():
        inputs = _tokenizer(
            text,
            truncation=True,
            max_length=MAX_SENTIMENT_INPUT_LENGTH,
            padding=True,
            return_tensors="pt",
        )
        outputs = _model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)[0]
        pred = torch.argmax(probs).item()
        confidence = probs[pred].item()

    vader_score = vader.polarity_scores(text)["compound"]
    return {
        "sentiment": LABEL_MAP[pred],
        "confidence": round(confidence, 4),
        "model": "distilbert-multilingual-v2.0",
        "language": lang,
        "topic": topic,
        "vader_score": vader_score,
        "vader_label": _vader_to_label(vader_score),
    }


def _classify_sarvam(text, lang, topic):
    """Call Sarvam AI for Hindi/mixed text sentiment classification."""
    try:
        prompt = _SARVAM_PROMPT.format(text=text[:1000])
        response = requests.post(
            _SARVAM_URL,
            headers={
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "model": _SARVAM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 20,
            },
            timeout=10,
        )
        if not response.ok:
            print(f"[SARVAM] API error {response.status_code}: {response.text[:100]}")
            return None

        content = response.json()["choices"][0]["message"]["content"].strip().lower()

        # Parse "positive 0.87" or "negative" etc.
        match = re.match(r"(positive|negative|neutral)\s*([0-9.]+)?", content)
        if not match:
            print(f"[SARVAM] Unexpected response: {content!r}")
            return None

        label = match.group(1)
        confidence = float(match.group(2)) if match.group(2) else 0.7

        vader_score = vader.polarity_scores(text)["compound"]
        return {
            "sentiment": label,
            "confidence": round(min(max(confidence, 0.0), 1.0), 4),
            "model": "sarvam-105b",
            "language": lang,
            "topic": topic,
            "vader_score": vader_score,
            "vader_label": _vader_to_label(vader_score),
        }

    except Exception as e:
        print(f"[SARVAM] Call failed: {e}")
        return None


def _vader_to_label(score):
    if score > 0.65:
        return "positive"
    elif score < -0.35:
        return "negative"
    else:
        return "neutral"
