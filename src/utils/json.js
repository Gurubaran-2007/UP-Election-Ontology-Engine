const extractAndRepairJSON = (text) => {
    if (!text || typeof text !== 'string') return null;
    try {
        // Find JSON block
        const match = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        let jsonStr = (match[1] || match[0]).trim();
        
        // Remove trailing commas and fix common AI JSON errors
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        jsonStr = jsonStr.replace(/(\w+):/g, '"$1":'); // Fix unquoted keys
        
        return JSON.parse(jsonStr);
    } catch (e) { 
        console.error("JSON Repair Failed:", e.message);
        return null; 
    }
};

module.exports = {
    extractAndRepairJSON
};
