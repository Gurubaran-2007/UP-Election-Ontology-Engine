const http = require('http');

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log('Testing Scheme APIs...\n');
    
    // Test 1: All schemes
    console.log('1. GET /api/up/schemes');
    const schemes = await makeRequest('/api/up/schemes');
    console.log('   Schemes:', JSON.stringify(schemes, null, 2).substring(0, 500));
    
    // Test 2: Scheme progress
    console.log('\n2. GET /api/up/schemes/progress');
    const progress = await makeRequest('/api/up/schemes/progress');
    console.log('   Summary:', JSON.stringify(progress.summary, null, 2));
    console.log('   District data:', progress.district_level?.length, 'records');
    
    // Test 3: Benefits
    console.log('\n3. GET /api/up/schemes/benefits');
    const benefits = await makeRequest('/api/up/schemes/benefits');
    console.log('   Total Benefits:', JSON.stringify(benefits.total_benefits, null, 2));
    
    // Test 4: Levels
    console.log('\n4. GET /api/up/schemes/levels');
    const levels = await makeRequest('/api/up/schemes/levels');
    console.log('   Districts:', levels.districts?.length);
    console.log('   Blocks:', levels.blocks?.length);
    console.log('   Panchayats:', levels.panchayats?.length);
    
    // Test 5: Dashboard
    console.log('\n5. GET /api/up/schemes/dashboard');
    const dashboard = await makeRequest('/api/up/schemes/dashboard');
    console.log('   Schemes:', dashboard.schemes?.length);
    console.log('   Total Sanctioned (Cr):', dashboard.summary?.total_sanctioned_cr);
    console.log('   Total Expended (Cr):', dashboard.summary?.total_expended_cr);
}

test().catch(console.error);