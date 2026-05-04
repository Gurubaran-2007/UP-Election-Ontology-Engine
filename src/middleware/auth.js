const API_KEY = process.env.INTERNAL_API_KEY;

const apiKeyAuth = (req, res, next) => {
    // Skip auth for GET routes (Public Dashboards)
    if (req.method === 'GET') return next();

    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    if (!API_KEY) {
        console.warn('[AUTH] INTERNAL_API_KEY not configured. Allowing access for development.');
        return next();
    }

    if (providedKey !== API_KEY) {
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'A valid X-API-KEY header is required for this action.' 
        });
    }
    next();
};

module.exports = { apiKeyAuth };
