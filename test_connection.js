require('dotenv').config({path: '.env.local'});
const neo4j = require('neo4j-driver');

const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD;

console.log('Testing connection...');
console.log('URI:', uri);

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

driver.verifyConnectivity()
    .then(result => {
        console.log('✓ Connected!', result);
    })
    .catch(error => {
        console.log('✗ Failed:', error.message);
    })
    .finally(() => driver.close());