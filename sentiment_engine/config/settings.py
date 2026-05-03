import os
from dotenv import load_dotenv

load_dotenv(".env")

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# NewsData.io — keys loaded from env, comma-separated: NEWSDATA_API_KEYS=key1,key2,...
NEWSDATA_KEYS = [k.strip() for k in os.getenv("NEWSDATA_API_KEYS", "").split(",") if k.strip()]

# Sarvam AI
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_MODEL = "sarvam-105b"

# Sentiment Model - DistilBERT multilingual per PRD
SENTIMENT_MODEL = "tabularisai/multilingual-sentiment-analysis"
MAX_SENTIMENT_INPUT_LENGTH = 512
BATCH_SIZE = 8

# News queries - expanded per PRD Table 2.2.1
NEWS_QUERIES = [
    "UP election 2026",
    "\u092f\u094b\u0917\u0940 \u0906\u0926\u093f\u0924\u094d\u092f\u0928\u093e\u0925",
    "BJP Uttar Pradesh",
    "\u0938\u092e\u093e\u091c\u0935\u093e\u0926\u0940 \u092a\u093e\u0930\u094d\u091f\u0940 UP",
    "UP news",
    "{constituency_name}",
    "{leader_name} {constituency_name}",
    "UP development news",
    "UP farmer protest",
    "UP unemployment",
    "UP infrastructure",
    "UP healthcare",
    "UP education",
    "UP law order",
    "UP schemes",
]

# Constituency list for targeted queries
UP_LS_CONSTITUENCIES = [
    "Saharanpur", "Kairana", "Muzaffarnagar", "Bijnor", "Nagina", "Moradabad",
    "Rampur", "Sambhal", "Amroha", "Meerut", "Baghpat", "Ghaziabad",
    "Gautam Buddha Nagar", "Bulandshahr", "Aligarh", "Hathras", "Mathura",
    "Agra", "Fatehpur Sikri", "Firozabad", "Mainpuri", "Etah", "Badaun",
    "Aonla", "Bareilly", "Pilibhit", "Shahjahanpur", "Kheri", "Dhaurahra",
    "Sitapur", "Hardoi", "Misrikh", "Unnao", "Lucknow", "Mohanlalganj",
    "Rae Bareli", "Amethi", "Sultanpur", "Faizabad", "Barabanki", "Bahraich",
    "Kaiserganj", "Shravasti", "Gonda", "Domariaganj", "Basti", "Sant Kabir Nagar",
    "Mahrajganj", "Gorakhpur", "Kushi Nagar", "Deoria", "Bansgaon", "Lalganj",
    "Azamgarh", "Mau", "Salempur", "Ballia", "Ghosi", "Bhadohi", "Pratapgarh",
    "Allahabad", "Phulpur", "Ambedkar Nagar", "Shrawasti", "Akbarpur",
    "Jalaun", "Jhansi", "Hamirpur", "Banda", "Fatehpur", "Kaushambi",
    "Varanasi", "Mirzapur", "Chandauli", "Bhadohi", "Sant Ravidas Nagar",
    "Chitrakoot", "Robertsganj", "Jaunpur", "Machhlishahr", "Bhadohi",
]

# Leaders for query templates
UP_LEADERS = [
    "Yogi Adityanath", "Narendra Modi", "Akhilesh Yadav", "Mayawati",
    "Rahul Gandhi", "Priyanka Gandhi", "Amit Shah", "Rajnath Singh",
    "Keshav Prasad Maurya", "Brajesh Pathak", "Anupriya Patel",
]

# Polling interval (minutes)
NEWS_POLL_INTERVAL = 15

# API
API_HOST = "127.0.0.1"
API_PORT = 8000

# Topic keywords for classification
TOPIC_KEYWORDS = {
    "unemployment": ["\u092c\u0947\u0930\u094b\u091c\u0917\u093e\u0930\u0940", "\u0928\u094c\u0915\u0930\u0940", "\u0930\u094b\u091c\u0917\u093e\u0930", "unemployment", "jobs", "employment"],
    "inflation": ["\u092e\u0939\u0902\u0917\u093e\u0908", "\u092e\u0939\u0901\u0917\u093e\u0908", "\u0926\u093e\u092e", "inflation", "prices", "cost"],
    "temple": ["\u092e\u0902\u0926\u093f\u0930", "\u092e\u0938\u094d\u091c\u093f\u0926", "\u0930\u093e\u092e \u092e\u0902\u0926\u093f\u0930", "temple", "mosque", "ram mandir"],
    "farmer": ["\u0915\u093f\u0938\u093e\u0928", "\u0916\u0947\u0924\u0940", "MSP", "farmer", "agriculture", "MSP"],
    "development": ["\u0935\u093f\u0915\u093e\u0938", "\u0938\u093e\u0921\u093c\u0915", "\u092c\u093f\u091c\u0932\u0940", "development", "road", "electricity"],
    "law_and_order": ["\u0915\u093e\u0928\u0942\u0928", "\u0905\u092a\u0930\u093e\u0927", "\u0938\u0941\u0930\u0915\u094d\u0937\u093e", "law", "crime", "security"],
    "women": ["\u092e\u0939\u093f\u0932\u093e", "\u0928\u093e\u0930\u0940", "\u0938\u0941\u0930\u0915\u094d\u0937\u093e", "women", "safety", "reservation"],
    "caste": ["\u091c\u093e\u0924\u093f", "\u0906\u0930\u0915\u094d\u0937\u0923", "OBC", "caste", "reservation", "OBC"],
    "youth": ["\u092f\u0941\u0935\u093e", "\u091b\u093e\u0924\u094d\u0930", "\u0936\u093f\u0915\u094d\u0937\u093e", "youth", "students", "education"],
    "corruption": ["\u092d\u094d\u0930\u0937\u094d\u0937\u093e\u091a\u093e\u0930", "\u0918\u094b\u091f\u093e\u0932\u093e", "corruption", "scam", "fraud"],
}

# Alert rules per PRD 5.4.2
ALERT_RULES = [
    {
        "id": "HIGH_ALERT",
        "condition": lambda agg: agg.get("negative_pct", 0) > 60,
        "severity": "HIGH",
        "message": "High negative sentiment in competitive seat: {constituency_name}",
    },
    {
        "id": "MEDIUM_ALERT",
        "condition": lambda agg: agg.get("trending") == "declining",
        "severity": "MEDIUM",
        "message": "Declining sentiment trend in {constituency_name}",
    },
    {
        "id": "LEADER_RISK_ALERT",
        "condition": lambda agg: agg.get("entity_id", "") in [
            "leader-yogi-adityanath", "leader-narendra-modi"
        ] and agg.get("positive_pct", 0) < 40,
        "severity": "HIGH",
        "message": "Leader {entity_name} sentiment below 40% in {constituency_name}",
    },
]
