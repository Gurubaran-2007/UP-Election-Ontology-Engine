const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'states');

const _cache = new Map();

function resolveState(stateCode) {
    const code = stateCode.toUpperCase();
    if (_cache.has(code)) return _cache.get(code);

    const configPath = path.join(STATE_DIR, `${code.toLowerCase()}.json`);
    if (!fs.existsSync(configPath)) return null;

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    _cache.set(code, config);
    return config;
}

function listStates() {
    return fs.readdirSync(STATE_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const cfg = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
            return { state_code: cfg.state_code, state_name: cfg.state_name };
        });
}

module.exports = { resolveState, listStates };
