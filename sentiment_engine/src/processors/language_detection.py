from langdetect import detect, LangDetectException
import os

try:
    import fasttext
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "lid.176.bin")
    ft_model = fasttext.load_model(MODEL_PATH)
except Exception:
    ft_model = None


def detect_language(text):
    """Language detection per PRD 2.3.1 - fastText lid.176"""
    if ft_model:
        try:
            predictions = ft_model.predict(text.replace("\n", " "), k=1)
            lang = predictions[0][0].replace("__label__", "")
            if lang in ("hi", "en"):
                return lang
            # Check for code-mixed
            hi_conf = _get_lang_confidence(text, "hi")
            en_conf = _get_lang_confidence(text, "en")
            if hi_conf > 0.2 and en_conf > 0.2:
                return "hi-en-mixed"
            return lang if lang in ("hi", "en") else "unknown"
        except Exception:
            pass

    # Fallback to langdetect
    try:
        lang = detect(text)
        return lang if lang in ("hi", "en") else "unknown"
    except LangDetectException:
        return "unknown"


def _get_lang_confidence(text, lang):
    """Get confidence for a specific language"""
    if not ft_model:
        return 0.0
    try:
        predictions = ft_model.predict(text.replace("\n", " "), k=5)
        for label, conf in zip(predictions[0], predictions[1]):
            if label == "__label__" + lang:
                return float(conf)
    except Exception:
        pass
    return 0.0
