import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sentiment_engine.config.settings import SENTIMENT_MODEL, MAX_SENTIMENT_INPUT_LENGTH, BATCH_SIZE, TOPIC_KEYWORDS
from sentiment_engine.src.processors.language_detection import detect_language


tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
model.eval()

vader = SentimentIntensityAnalyzer()

LABEL_MAP = {0: "negative", 1: "neutral", 2: "positive"}


def classify_sentiment(text):
    """Multi-model sentiment classification with fallback per PRD 2.3.0"""
    lang = detect_language(text)

    result = {
        "sentiment": "neutral",
        "confidence": 0.5,
        "model": "default",
        "language": lang,
        "topic": classify_topic(text),
    }

    if lang == "en":
        vader_score = vader.polarity_scores(text)["compound"]
        result["vader_score"] = vader_score
        result["vader_label"] = _vader_to_label(vader_score)
        result["model"] = "vader-en-v1.0"
        result["confidence"] = abs(vader_score)
        result["sentiment"] = result["vader_label"]
        return result

    # Run transformer for hi and hi-en-mixed
    with torch.no_grad():
        inputs = tokenizer(
            text,
            truncation=True,
            max_length=MAX_SENTIMENT_INPUT_LENGTH,
            padding=True,
            return_tensors="pt",
        )
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)[0]
        pred = torch.argmax(probs).item()
        confidence = probs[pred].item()

    result["sentiment"] = LABEL_MAP[pred]
    result["confidence"] = round(confidence, 4)
    result["model"] = "distilbert-multilingual-v2.0"

    return result


def classify_batch(texts):
    """Batch sentiment classification"""
    results = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i: i + BATCH_SIZE]
        with torch.no_grad():
            inputs = tokenizer(
                batch,
                truncation=True,
                max_length=MAX_SENTIMENT_INPUT_LENGTH,
                padding=True,
                return_tensors="pt",
            )
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            preds = torch.argmax(probs, dim=1).tolist()
            confidences = probs.max(dim=1).values.tolist()

        for text, pred, conf in zip(batch, preds, confidences):
            lang = detect_language(text)
            vader_label = None
            vader_score = None
            if lang == "en":
                vader_score = vader.polarity_scores(text)["compound"]
                vader_label = _vader_to_label(vader_score)
                results.append({
                    "text": text,
                    "sentiment": vader_label,
                    "confidence": abs(vader_score),
                    "model": "vader-en-v1.0",
                    "language": lang,
                    "vader_label": vader_label,
                    "vader_score": vader_score,
                    "topic": classify_topic(text),
                })
            else:
                results.append({
                    "text": text,
                    "sentiment": LABEL_MAP[pred],
                    "confidence": round(conf, 4),
                    "model": "distilbert-multilingual-v2.0",
                    "language": lang,
                    "vader_label": vader_label,
                    "vader_score": vader_score,
                    "topic": classify_topic(text),
                })
    return results


def classify_topic(text):
    """Classify text into topic taxonomy per PRD 2.3.5"""
    text_lower = text.lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in text_lower:
                return topic
    return "general"


def _vader_to_label(score):
    """Convert VADER compound score to label per PRD 2.3.3"""
    if score > 0.65:
        return "positive"
    elif score < -0.35:
        return "negative"
    else:
        return "neutral"
