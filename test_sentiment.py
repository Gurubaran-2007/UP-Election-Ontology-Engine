import sys
import os
import json

sys.stdout.reconfigure(encoding='utf-8')

# Add project root to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sentiment_engine.src.processors.sentiment import classify_sentiment
from sentiment_engine.src.processors.language_detection import detect_language

def test():
    test_texts = [
        "The new infrastructure projects in UP are absolutely fantastic and creating many jobs.",
        "बेरोजगारी और महंगाई ने आम आदमी की कमर तोड़ दी है।",
        "The recent decisions by the Yogi govt are ok, neither good nor bad.",
        "BJP govt is doing good work but corruption is still a major issue in some districts.",
    ]

    print("--- Sentiment Analysis Engine Test ---\n")
    for idx, text in enumerate(test_texts):
        print(f"Test {idx + 1}:")
        print(f"Text: '{text}'")
        
        result = classify_sentiment(text)
        
        print(f"Language Detected: {result.get('language')}")
        print(f"Sentiment:         {result.get('sentiment').upper()}")
        print(f"Confidence:        {result.get('confidence')}")
        print(f"Model Used:        {result.get('model')}")
        if result.get('vader_score'):
            print(f"VADER Score:       {result.get('vader_score')} ({result.get('vader_label')})")
        print(f"Topic Classified:  {result.get('topic')}")
        print("-" * 40)

if __name__ == "__main__":
    test()
