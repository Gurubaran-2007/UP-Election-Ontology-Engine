const neo4j = require('neo4j-driver');

const uri      = process.env.NEO4J_URI      || 'neo4j://localhost:7687';
const user     = process.env.NEO4J_USER     || 'neo4j';
const password = process.env.NEO4J_PASSWORD;

const isCloud  = uri.startsWith('neo4j+s') || uri.startsWith('bolt+s');
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(user, password),
    isCloud ? {} : { encrypted: 'ENCRYPTION_OFF' }
);

console.log(`[NEO4J] Connecting to: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
console.log(`[NEO4J] Mode: ${isCloud ? '☁️  Cloud (AuraDB)' : '🖥️  Local'}`);
if (!password) {
    console.warn('[NEO4J] NEO4J_PASSWORD is not configured. Database-backed routes will fail until it is set.');
}

module.exports = driver;
