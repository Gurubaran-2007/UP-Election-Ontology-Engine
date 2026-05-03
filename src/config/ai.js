const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_MODEL = 'sarvam-105b';
const NEWSDATA_KEYS = (process.env.NEWSDATA_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => ({ key, exhausted: false, resetAt: 0 }));

// Returns the first non-exhausted key. Resets keys after 24 hours.
function getActiveNewsKey() {
    if (NEWSDATA_KEYS.length === 0) return null;
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    // Auto-reset keys that exhausted more than 24 hours ago
    NEWSDATA_KEYS.forEach(k => {
        if (k.exhausted && now - k.resetAt > ONE_DAY) {
            k.exhausted = false;
            console.log(`[NEWS KEY] Key ...${k.key.slice(-6)} auto-reset after 24h`);
        }
    });
    return NEWSDATA_KEYS.find(k => !k.exhausted) || NEWSDATA_KEYS[0]; // fallback to first
}

const SARVAM_URL = 'https://api.sarvam.ai/v1/chat/completions';

const callAI = async (prompt) => {
    if (!SARVAM_API_KEY) {
        throw new Error('SARVAM_API_KEY is not configured');
    }

    try {
        console.log(`[SARVAM AI] Connecting to Cloud...`);
        const response = await fetch(SARVAM_URL, {
            method: 'POST',
            headers: { 
                'api-subscription-key': SARVAM_API_KEY,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: SARVAM_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });
        
        if (!response.ok) throw new Error("Cloud connection lost");
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.warn("AI unavailable:", e.message);
        throw e;
    }
};

module.exports = {
    SARVAM_API_KEY,
    NEWSDATA_KEYS,
    getActiveNewsKey,
    callAI
};
