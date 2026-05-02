document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();

    const strategyForm = document.getElementById('strategy-form');
    if(strategyForm) {
        strategyForm.addEventListener('submit', handleStrategySubmit);
    }

    const aiSearchBtn = document.getElementById('ai-search-btn');
    if(aiSearchBtn) {
        aiSearchBtn.addEventListener('click', handleAISearch);
    }

    // Landing Page Enter App
    const enterBtn = document.getElementById('enter-app-btn');
    if(enterBtn) {
        enterBtn.addEventListener('click', () => {
            const landingPage = document.getElementById('landing-page');
            landingPage.classList.remove('fade-in');
            landingPage.classList.add('fade-out');
            
            setTimeout(() => {
                landingPage.style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                // Load map only after container is visible so width/height are calculated properly
                if(!window.mapLoaded) {
                    loadIndiaMap();
                    window.mapLoaded = true;
                }
            }, 500); // match animation duration
        });
    }

    // Tab Switching — use event delegation so dynamically injected nav links also work
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', (e) => {
            const link = e.target.closest('.tab-link');
            if (!link) return;
            e.preventDefault();

            // Remove active from all links & hide all tabs
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

            // Activate clicked link
            link.classList.add('active');

            // Show target tab
            const targetId = link.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';

                // Lazy-load UP Dashboard
                if (targetId === 'up-dashboard-tab' && !window.upDashboardLoaded) {
                    loadUPDashboard();
                    window.upDashboardLoaded = true;
                }

                // Lazy-load UP District Map
                if (targetId === 'up-map-tab') {
                    setTimeout(() => {
                        if (typeof window._initUPMap === 'function') window._initUPMap();
                    }, 150);
                }
            }
        });
    }

    // Close Modal Logic
    const closeModalBtn = document.getElementById('close-modal-btn');
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('state-modal').style.display = 'none';
        });
    }
});

async function loadIndiaMap() {
    const mapContainer = document.getElementById('india-d3-map');
    if (!mapContainer) return;

    try {
        const response = await fetch('https://code.highcharts.com/mapdata/countries/in/custom/in-all-disputed.geo.json');
        const geojson = await response.json();

        mapContainer.innerHTML = ''; 
        
        const width = mapContainer.clientWidth || 600;
        const height = mapContainer.clientHeight || 500;

        const svg = d3.select("#india-d3-map")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`);

        const mapGroup = svg.append("g");

        const projection = d3.geoIdentity()
            .reflectY(true)
            .fitSize([width, height], geojson);

        const pathGenerator = d3.geoPath().projection(projection);

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                mapGroup.attr("transform", event.transform);
            });
        
        svg.call(zoom);

        const infoModal = document.getElementById('state-modal');

        mapGroup.selectAll("path")
            .data(geojson.features)
            .enter()
            .append("path")
            .attr("d", pathGenerator)
            .attr("class", "state-path")
            .on("click", function(event, d) {
                const stateName = d.properties.name;
                
                infoModal.style.display = 'flex';
                const displayStateName = currentLang === 'hi' ? (stateTranslations[stateName] || stateName) : stateName;
                document.getElementById('state-name-display').innerText = displayStateName;
                
                document.getElementById('state-population').innerText = currentLang === 'hi' ? "लोड हो रहा है..." : "Loading...";
                document.getElementById('state-cm').innerText = currentLang === 'hi' ? "लोड हो रहा है..." : "Loading...";
                document.getElementById('state-cm-years').innerText = "";
                document.getElementById('state-districts-list').innerHTML = `<li>${currentLang === 'hi' ? "लोड हो रहा है..." : "Loading..."}</li>`;
                document.getElementById('state-news-list').innerHTML = `<li>${currentLang === 'hi' ? "लोड हो रहा है..." : "Loading..."}</li>`;

                fetchStateInfo(stateName);
            });

        mapGroup.selectAll("text")
            .data(geojson.features)
            .enter()
            .append("text")
            .attr("class", "state-label")
            .attr("x", d => pathGenerator.centroid(d)[0] || 0)
            .attr("y", d => pathGenerator.centroid(d)[1] || 0)
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("data-state-name", d => d.properties.name)
            .text(d => currentLang === 'hi' ? (stateTranslations[d.properties.name] || d.properties.name) : d.properties.name)
            .style("pointer-events", "none");

    } catch (error) {
        console.error("Error loading map:", error);
        mapContainer.innerHTML = `<p style="color:var(--negative)">Failed to load India map.</p>`;
    }
}

async function fetchStateInfo(stateName) {
    try {
        const response = await fetch(`/api/state-info/${encodeURIComponent(stateName)}`);
        if (!response.ok) throw new Error("Failed to fetch state data");
        
        const data = await response.json();
        const pData = data.political_data;

        const displayPop = pData.population;
        let cmName = pData.cm;
        
        if (currentLang === 'hi') {
            cmName = await transliterateSentence(cmName);
        }

        document.getElementById('state-population').innerText = displayPop;
        document.getElementById('state-cm').innerText = cmName;
        document.getElementById('state-cm-years').innerText = pData.cm_years;
        
        const districtList = document.getElementById('state-districts-list');
        if (pData.districts && pData.districts.length > 0) {
            let htmlStr = '';
            for (let d of pData.districts) {
                let dName = currentLang === 'hi' ? await transliterateSentence(d.name) : d.name;
                let polName = currentLang === 'hi' ? await transliterateSentence(d.politician) : d.politician;
                htmlStr += `<li><strong>${dName}</strong>: ${polName} (${d.years} ${currentLang === 'hi' ? 'वर्ष' : 'yrs'})</li>`;
            }
            districtList.innerHTML = htmlStr;
        } else {
            districtList.innerHTML = currentLang === 'hi' ? "<li>कोई जिला डेटा उपलब्ध नहीं है।</li>" : "<li>No district data available.</li>";
        }

        const newsList = document.getElementById('state-news-list');
        if (data.news && data.news.length > 0) {
            let newsHtml = '';
            for (let n of data.news) {
                let newsTitle = currentLang === 'hi' ? await translateToHindi(n.title) : n.title;
                newsHtml += `<li><a href="${n.url}" target="_blank">${newsTitle}</a></li>`;
            }
            newsList.innerHTML = newsHtml;
        } else {
            newsList.innerHTML = currentLang === 'hi' ? "<li>कोई ताज़ा खबर नहीं मिली।</li>" : "<li>No recent news found.</li>";
        }

    } catch (error) {
        console.error(error);
        document.getElementById('state-districts-list').innerHTML = `<li style="color:var(--negative)">Error loading data.</li>`;
    }
}

// Wakeup banner — shown when server is cold-starting
function showWakeupBanner() {
    if (document.getElementById('wakeup-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'wakeup-banner';
    banner.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;
        background: linear-gradient(90deg, #f97316, #eab308);
        color: #000; text-align: center; padding: 10px 16px;
        font-size: 0.85rem; font-weight: 600; letter-spacing: 0.03em;
        box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center; gap: 10px;
    `;
    banner.innerHTML = `
        <span style="font-size:1.1rem;">⚡</span>
        Server is waking up — this takes about 30–60 seconds. Please wait...
        <span id="wakeup-countdown" style="background:rgba(0,0,0,0.15); padding:2px 8px; border-radius:10px; font-size:0.8rem; margin-left:6px;"></span>
    `;
    document.body.prepend(banner);
}

function hideWakeupBanner() {
    const banner = document.getElementById('wakeup-banner');
    if (banner) banner.remove();
}

let _retryCount = 0;
async function checkServerStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const data = await response.json();
            updateStatus('server-status', true);
            updateStatus('db-status', data.database === 'Connected');
            updateStatus('ai-status', data.ai === 'Connected');
            hideWakeupBanner();
            _retryCount = 0;
        }
    } catch (error) {
        console.warn("Server unreachable — retrying...");
        updateStatus('server-status', false);
        updateStatus('db-status', false);
        updateStatus('ai-status', false);
        showWakeupBanner();
        _retryCount++;
        // Retry every 8 seconds until server responds (max 20 tries = ~2.5 mins)
        if (_retryCount < 20) {
            setTimeout(checkServerStatus, 8000);
        }
    }
}

function updateStatus(elementId, isOnline) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (isOnline) {
        el.classList.remove('offline');
        el.classList.add('online');
    } else {
        el.classList.remove('online');
        el.classList.add('offline');
    }
}

function handleStrategySubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('plan-title').value;
    const description = document.getElementById('plan-description').value;
    
    // Scroll down to the results section smoothly
    setTimeout(() => {
        document.getElementById('ai-prediction-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    simulateAIAnalysis(title, description);
}

async function simulateAIAnalysis(title, description) {
    const aiContent = document.getElementById('ai-prediction-content');

    aiContent.innerHTML = `
        <div style="text-align:center; padding: 2rem;">
            <div class="loading-spinner"></div>
            <p style="margin-top:1rem; color:var(--text-muted); font-style:italic;">
                Scanning database for historical precedents...<br>
                Fetching real-time news context...<br>
                Running deep political analysis via Sarvam AI...
            </p>
        </div>
    `;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch('/api/strategy', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        clearTimeout(timeoutId);

        // The /api/strategy endpoint NEVER returns a 500 — always parse the JSON
        const data = await response.json();

        const metrics = data.metrics || { positive: 65, negative: 20, overall: 60 };

        // Impact Scorecard
        const scorecardHtml = `
            <div style="display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                <div style="flex:1; min-width:120px; background:rgba(34,197,94,0.1); border:1px solid var(--positive); padding:1rem; border-radius:8px; text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Positive Impact</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:var(--positive);">${metrics.positive}%</div>
                </div>
                <div style="flex:1; min-width:120px; background:rgba(239,68,68,0.1); border:1px solid var(--negative); padding:1rem; border-radius:8px; text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Resistance</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:var(--negative);">${metrics.negative}%</div>
                </div>
                <div style="flex:1; min-width:120px; background:rgba(59,130,246,0.1); border:1px solid var(--secondary); padding:1rem; border-radius:8px; text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Success Rate</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:var(--secondary);">${metrics.overall}%</div>
                </div>
            </div>
        `;

        // DB Context badge
        const dbBadge = data.db_context && data.db_context.includes("found")
            ? `<div style="display:inline-block; background:rgba(34,197,94,0.15); border:1px solid var(--positive); border-radius:20px; padding:3px 12px; font-size:0.75rem; color:var(--positive); margin-bottom:1rem;">📚 Historical Precedent Found in Database</div>`
            : `<div style="display:inline-block; background:rgba(255,165,0,0.1); border:1px solid orange; border-radius:20px; padding:3px 12px; font-size:0.75rem; color:orange; margin-bottom:1rem;">🔍 No Exact Precedent — AI Expert Analysis Applied</div>`;

        // Format the analysis text with better styling
        const rawText = data.ai_prediction || "";
        const formattedText = rawText
            .replace(/•\s*(STRATEGIC OVERVIEW|DEMOGRAPHIC IMPACT|HISTORICAL PRECEDENT|PREDICTED OUTCOME|RISK FACTORS):/g,
                '<div style="margin-top:1rem; margin-bottom:0.3rem; color:var(--primary); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">$1</div>')
            .replace(/•/g, '<span style="color:var(--secondary);">▸</span>')
            .replace(/\n/g, '<br>');

        aiContent.innerHTML = `
            ${scorecardHtml}
            ${dbBadge}
            <div class="ai-response-text" style="text-align:left; max-height:450px; overflow-y:auto; padding:1.2rem; background:var(--bg-card); border-radius:8px; border:1px solid var(--border); line-height:1.8; font-size:0.92rem;">
                ${formattedText}
            </div>
        `;

        // Render graph with delay for layout paint
        setTimeout(() => renderD3Graph(data.graph_data), 120);

        // Render Resistance Deep-Dive
        const resContent = document.getElementById('resistance-content');
        if (data.resistance && data.resistance.length > 0) {
            resContent.innerHTML = data.resistance.map(item => `
                <div class="resistance-item fade-in">
                    <strong>⚠️ ${item.group}</strong>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${item.reason}</p>
                </div>
            `).join('');
        } else {
            resContent.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No major resistance detected for this strategy.</p>`;
        }

        // Render AI Roadmap
        const roadmapContent = document.getElementById('roadmap-content');
        if (data.roadmap && data.roadmap.length > 0) {
            roadmapContent.innerHTML = data.roadmap.map((step, idx) => `
                <div class="roadmap-item fade-in" style="animation-delay:${idx * 0.1}s;">
                    <div class="step-num">${idx + 1}</div>
                    <p style="font-size:0.85rem; margin:0;">${step}</p>
                </div>
            `).join('');
        } else {
            roadmapContent.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Strategy is already highly optimized.</p>`;
        }

    } catch (error) {
        // Even on timeout/network error, show professional message
        aiContent.innerHTML = `
            <div style="padding:1.5rem; background:rgba(239,68,68,0.05); border:1px solid var(--border); border-radius:8px;">
                <p style="color:var(--text-muted); margin:0;">
                    <strong style="color:var(--primary);">Analysis Note:</strong> 
                    The AI engine took longer than expected. Please try again or simplify the plan title.
                    <br><br>
                    <button onclick="simulateAIAnalysis('${title.replace(/'/g, "\\'")}', '${description.replace(/'/g, "\\'")}');" 
                        style="background:var(--primary); color:#000; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:600;">
                        Retry Analysis
                    </button>
                </p>
            </div>
        `;
        console.error("Strategy analysis error:", error);
    }
}


function renderD3Graph(data, containerId = 'd3-graph-container') {
    const container = document.getElementById(containerId);
    if (!container || !data || !data.nodes || data.nodes.length === 0) return;
    container.innerHTML = '';

    // Use a fixed internal coordinate space — SVG will scale to fill the container
    const W = 800;
    const H = 480;
    const padding = 80; // Keep nodes inside this boundary

    const svg = d3.select('#' + containerId)
        .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%')
        .style('background', 'rgba(0,0,0,0.1)')
        .style('border-radius', '12px');

    // Unique arrow marker per container to avoid shared-ID conflicts
    const markerId = 'arrow-' + containerId;
    svg.append('defs').append('marker')
        .attr('id', markerId)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'rgba(255,255,255,0.4)');

    // Spread nodes across the full space at start
    data.nodes.forEach((node, i) => {
        if (!node.x) node.x = padding + Math.random() * (W - padding * 2);
        if (!node.y) node.y = padding + Math.random() * (H - padding * 2);
    });

    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(180))
        .force('charge', d3.forceManyBody().strength(-900))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide().radius(d => 22 + (d.impact || 10) / 4 + 15))
        // Boundary forces — push nodes away from edges
        .force('boundX', d3.forceX(d => {
            if (d.x < padding) return padding;
            if (d.x > W - padding) return W - padding;
            return d.x;
        }).strength(0.15))
        .force('boundY', d3.forceY(d => {
            if (d.y < padding) return padding;
            if (d.y > H - padding) return H - padding;
            return d.y;
        }).strength(0.15));

    const link = svg.append('g')
        .selectAll('line')
        .data(data.links)
        .enter().append('line')
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', d => Math.max(1.5, Math.sqrt(d.value || 5)))
        .attr('marker-end', `url(#${markerId})`);

    const node = svg.append('g')
        .selectAll('g')
        .data(data.nodes)
        .enter().append('g')
        .style('cursor', 'grab')
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = Math.max(padding, Math.min(W - padding, event.x));
                d.fy = Math.max(padding, Math.min(H - padding, event.y));
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));

    // Node circles
    node.append('circle')
        .attr('r', d => 22 + (d.impact || 10) / 4)
        .attr('fill', d => {
            if (d.group === 1) return 'var(--secondary)';      // Orange — scheme center
            if (d.group === 3) return 'var(--negative)';       // Red — opposition
            if (d.group === 4) return '#3b82f6';               // Blue — implementation body
            return d.sentiment >= 0 ? 'var(--positive)' : 'var(--negative)'; // Green/Red — demographic
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))');

    // Node labels
    node.append('text')
        .text(d => d.id)
        .attr('x', 0)
        .attr('y', d => 30 + (d.impact || 10) / 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text)')
        .style('font-size', '15px')
        .style('font-weight', '700')
        .style('pointer-events', 'none');

    simulation.on('tick', () => {
        // Clamp nodes within boundary on each tick
        data.nodes.forEach(d => {
            d.x = Math.max(padding, Math.min(W - padding, d.x));
            d.y = Math.max(padding, Math.min(H - padding, d.y));
        });

        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}


async function handleAISearch() {
    const inputField = document.getElementById('ai-search-input');
    const query = inputField.value.trim();
    if (!query) return;

    const resultsBox = document.getElementById('ai-search-results');
    resultsBox.style.display = 'block';
    resultsBox.innerHTML = `
        <div class="loading-spinner"></div>
        <p style="text-align:center;">Searching knowledge base via Sarvam AI...</p>
    `;

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error("Search request failed");

        const data = await response.json();
        const formattedText = data.ai_response.replace(/\n/g, '<br>');

        resultsBox.innerHTML = `
            <div style="text-align:left;">
                <h4 style="color:var(--primary); margin-bottom: 0.5rem;">Q: ${query}</h4>
                <p>${formattedText}</p>
            </div>
        `;
    } catch (error) {
        resultsBox.innerHTML = `<p style="color:var(--negative);">Error connecting to AI Search engine.</p>`;
        console.error(error);
    }
}

// ==========================================
// BILINGUAL & TRANSLITERATION ENGINE
// ==========================================

const translations = {
    en: {
        title: "Political Strategy Ontology Engine",
        subtitle: "Advanced Predictive Sentiment Analysis & Real-time Demographics",
        enter_engine: "Enter Engine",
        logo_small: "Ontology Engine",
        nav_map: "Interactive India Map",
        nav_strategy: "Strategy Builder & Prediction",
        nav_ai_search: "AI Search",
        status_server: "Server",
        status_neo4j: "Neo4j",
        status_ai: "AI Engine",
        map_title: "Interactive India Map",
        map_desc: "Click on a state to view real-time demographic, political, and news data.",
        strategy_title: "Strategy Builder",
        strategy_desc: "Enter the details of the proposed political implementation plan to analyze public sentiment.",
        plan_title_label: "Plan Title",
        plan_title_placeholder: "e.g. Free Laptop Distribution Scheme",
        plan_desc_label: "Implementation Details",
        plan_desc_placeholder: "Describe the policy, target audience, and key highlights...",
        analyze_btn: "Analyze Strategy Impact",
        dash_title: "Prediction & Sentiment Analysis Dashboard",
        dash_ai_pred: "AI Strategy Prediction",
        dash_placeholder: "No strategy analyzed yet. Please submit a strategy above to generate an analysis.",
        dash_graph_title: "Public Sentiment Graph",
        dash_graph_placeholder: "Awaiting Data...",
        dash_graph_caption: "Graphical representation of expected positive vs negative impact in various demographics. (Node Size = Impact, Node Color = Sentiment)",
        ai_search_title: "General Indian Information AI Search",
        ai_search_desc: "Ask Sarvam AI for general information regarding Indian society, past political strategies, or any other query.",
        ai_search_placeholder: "e.g. What were the major infrastructure projects in UP in 2017?",
        ask_ai_btn: "Ask AI",
        modal_pop: "Population:",
        modal_cm: "Chief Minister:",
        modal_years: "years",
        modal_districts: "Key District Politicians",
        modal_loading: "Loading...",
        modal_news: "Top 5 News Headlines",
        modal_loading_news: "Loading real-time news...",
        nav_up: "Uttar Pradesh",
        up_title: "Uttar Pradesh Command Center",
        up_subtitle: "Real-time political and climatic tracking",
        up_weather_loading: "Fetching live climate data...",
        up_recent_title: "Recently Introduced Schemes",
        up_future_title: "Future Schemes That Going To Be In Action",
        up_fetching_ai: "Agent Sarvam AI is analyzing current events..."
    },
    hi: {
        title: "राजनीतिक रणनीति ओन्टोलॉजी इंजन",
        subtitle: "उन्नत भविष्य कहनेवाला भावना विश्लेषण और रीयल-टाइम जनसांख्यिकी",
        enter_engine: "इंजन दर्ज करें",
        logo_small: "ओन्टोलॉजी इंजन",
        nav_map: "इंटरएक्टिव भारत का नक्शा",
        nav_strategy: "रणनीति निर्माता और भविष्यवाणी",
        nav_ai_search: "एआई खोज",
        status_server: "सर्वर",
        status_neo4j: "नियो4जे (Neo4j)",
        status_ai: "एआई इंजन",
        map_title: "इंटरएक्टिव भारत का नक्शा",
        map_desc: "रीयल-टाइम जनसांख्यिकीय, राजनीतिक और समाचार डेटा देखने के लिए किसी राज्य पर क्लिक करें।",
        strategy_title: "रणनीति निर्माता",
        strategy_desc: "जनभावना का विश्लेषण करने के लिए प्रस्तावित राजनीतिक कार्यान्वयन योजना का विवरण दर्ज करें।",
        plan_title_label: "योजना का शीर्षक",
        plan_title_placeholder: "उदा. मुफ्त लैपटॉप वितरण योजना",
        plan_desc_label: "कार्यान्वयन विवरण",
        plan_desc_placeholder: "नीति, लक्षित दर्शकों और प्रमुख बातों का वर्णन करें...",
        analyze_btn: "रणनीति प्रभाव का विश्लेषण करें",
        dash_title: "भविष्यवाणी और भावना विश्लेषण डैशबोर्ड",
        dash_ai_pred: "एआई रणनीति भविष्यवाणी",
        dash_placeholder: "अभी तक किसी रणनीति का विश्लेषण नहीं किया गया। विश्लेषण उत्पन्न करने के लिए कृपया ऊपर एक रणनीति सबमिट करें।",
        dash_graph_title: "जनभावना ग्राफ",
        dash_graph_placeholder: "डेटा की प्रतीक्षा...",
        dash_graph_caption: "विभिन्न जनसांख्यिकी में अपेक्षित सकारात्मक बनाम नकारात्मक प्रभाव का ग्राफिकल प्रतिनिधित्व। (नोड का आकार = प्रभाव, नोड का रंग = भावना)",
        ai_search_title: "सामान्य भारतीय जानकारी एआई खोज",
        ai_search_desc: "भारतीय समाज, पिछली राजनीतिक रणनीतियों या किसी अन्य प्रश्न के बारे में सामान्य जानकारी के लिए Phi-3 मिनी से पूछें।",
        ai_search_placeholder: "उदा. 2017 में यूपी में प्रमुख बुनियादी ढांचा परियोजनाएं क्या थीं?",
        ask_ai_btn: "एआई से पूछें",
        modal_pop: "जनसंख्या:",
        modal_cm: "मुख्यमंत्री:",
        modal_years: "वर्ष",
        modal_districts: "प्रमुख जिला राजनेता",
        modal_loading: "लोड हो रहा है...",
        modal_news: "शीर्ष 5 समाचार सुर्खियां",
        modal_loading_news: "रीयल-टाइम समाचार लोड हो रहा है...",
        nav_up: "उत्तर प्रदेश",
        up_title: "उत्तर प्रदेश कमांड सेंटर",
        up_subtitle: "रीयल-टाइम राजनीतिक और जलवायु ट्रैकिंग",
        up_weather_loading: "लाइव जलवायु डेटा प्राप्त किया जा रहा है...",
        up_recent_title: "हाल ही में शुरू की गई योजनाएं",
        up_future_title: "भविष्य की योजनाएं जो कार्रवाई में होंगी",
        up_fetching_ai: "एजेंट Sarvam AI वर्तमान घटनाओं का विश्लेषण कर रहा है..."
    }
};

const stateTranslations = {
    "Andaman and Nicobar": "अंडमान और निकोबार",
    "Andhra Pradesh": "आंध्र प्रदेश",
    "Arunachal Pradesh": "अरुणाचल प्रदेश",
    "Assam": "असम",
    "Bihar": "बिहार",
    "Chandigarh": "चंडीगढ़",
    "Chhattisgarh": "छत्तीसगढ़",
    "Dadra and Nagar Haveli": "दादरा और नगर हवेली",
    "Daman and Diu": "दमन और दीव",
    "Delhi": "दिल्ली",
    "Goa": "गोवा",
    "Gujarat": "गुजरात",
    "Haryana": "हरियाणा",
    "Himachal Pradesh": "हिमाचल प्रदेश",
    "Jammu and Kashmir": "जम्मू और कश्मीर",
    "Jharkhand": "झारखंड",
    "Karnataka": "कर्नाटक",
    "Kerala": "केरल",
    "Lakshadweep": "लक्षद्वीप",
    "Madhya Pradesh": "मध्य प्रदेश",
    "Maharashtra": "महाराष्ट्र",
    "Manipur": "मणिपुर",
    "Meghalaya": "मेघालय",
    "Mizoram": "मिजोरम",
    "Nagaland": "नागालैंड",
    "Odisha": "ओडिशा",
    "Puducherry": "पुडुचेरी",
    "Punjab": "पंजाब",
    "Rajasthan": "राजस्थान",
    "Sikkim": "सिक्किम",
    "Tamil Nadu": "तमिलनाडु",
    "Telangana": "तेलंगाना",
    "Tripura": "त्रिपुरा",
    "Uttar Pradesh": "उत्तर प्रदेश",
    "Uttarakhand": "उत्तराखंड",
    "West Bengal": "पश्चिम बंगाल"
};

let currentLang = 'en';

document.getElementById('lang-select').addEventListener('change', (e) => {
    currentLang = e.target.value;
    switchLanguage(currentLang);
});

function switchLanguage(lang) {
    const dict = translations[lang];
    
    // Translate text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerText = dict[key];
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            el.setAttribute('placeholder', dict[key]);
        }
    });

    if (typeof d3 !== 'undefined') {
        d3.selectAll(".state-label").text(function() {
            const engName = d3.select(this).attr("data-state-name");
            if(engName) {
                return currentLang === 'hi' ? (stateTranslations[engName] || engName) : engName;
            }
        });
    }
    
    // Also update modal title if open
    const modalDisplay = document.getElementById('state-modal');
    if (modalDisplay && modalDisplay.style.display === 'flex') {
        const currentTitleEl = document.getElementById('state-name-display');
        const englishMapName = Object.keys(stateTranslations).find(key => stateTranslations[key] === currentTitleEl.innerText) || currentTitleEl.innerText;
        currentTitleEl.innerText = currentLang === 'hi' ? (stateTranslations[englishMapName] || englishMapName) : englishMapName;
    }
}

// English to Hindi Live Transliteration Engine
async function transliterateToHindi(text) {
    if (!text.trim()) return text;
    try {
        const response = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=hi-t-i0-und&num=1`);
        const data = await response.json();
        if (data[0] === 'SUCCESS' && data[1][0][1][0]) {
            return data[1][0][1][0]; // Returns the top Hindi word prediction
        }
    } catch (err) {
        console.error("Transliteration error:", err);
    }
    return text; // Fallback to original text if API fails
}

// English to Hindi Full Sentence Translation Engine
async function translateToHindi(text) {
    if (!text.trim()) return text;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        // The translation is usually in data[0][0][0]
        if (data && data[0] && data[0][0] && data[0][0][0]) {
            return data[0][0][0];
        }
    } catch (err) {
        console.error("Translation error:", err);
    }
    return text; // Fallback to original text
}

async function transliterateSentence(sentence) {
    if (!sentence) return sentence;
    const words = sentence.split(' ');
    const transliteratedWords = [];
    for (let word of words) {
        if (!word.match(/[a-zA-Z]/)) {
             transliteratedWords.push(word);
             continue;
        }
        const match = word.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
        if (match) {
            const hi = await transliterateToHindi(match[2]);
            transliteratedWords.push(match[1] + hi + match[3]);
        } else {
            const hi = await transliterateToHindi(word);
            transliteratedWords.push(hi);
        }
    }
    return transliteratedWords.join(' ');
}

async function handleTransliteration(e) {
    if (currentLang !== 'hi') return; // Only transliterate in Hindi mode
    
    // Trigger on Space (32) or Enter (13)
    if (e.keyCode === 32 || e.keyCode === 13) {
        const inputEl = e.target;
        const fullText = inputEl.value;
        
        // Find the word just before the cursor
        const cursorPosition = inputEl.selectionStart;
        const textBeforeCursor = fullText.substring(0, cursorPosition);
        
        // Match the last English word typed
        const wordMatch = textBeforeCursor.match(/([a-zA-Z]+)(\s*)$/);
        
        if (wordMatch) {
            const englishWord = wordMatch[1];
            const trailingSpace = wordMatch[2];
            
            const hindiWord = await transliterateToHindi(englishWord);
            
            // Replace the English word with the Hindi word
            const newText = fullText.substring(0, cursorPosition - wordMatch[0].length) + 
                            hindiWord + 
                            trailingSpace + 
                            fullText.substring(cursorPosition);
            
            inputEl.value = newText;
            
            // Re-adjust cursor position
            const newCursorPos = cursorPosition - englishWord.length + hindiWord.length;
            inputEl.setSelectionRange(newCursorPos, newCursorPos);
        }
    }
}

// Bind to input fields
document.getElementById('plan-title').addEventListener('keyup', handleTransliteration);
document.getElementById('plan-description').addEventListener('keyup', handleTransliteration);
document.getElementById('ai-search-input').addEventListener('keyup', handleTransliteration);

// ==========================================
// UP Dashboard Engine
// ==========================================

async function loadUPDashboard() {
    // 1. Fetch Weather
    try {
        const wRes = await fetch('/api/up/weather');
        if (wRes.ok) {
            const wData = await wRes.json();
            const wContainer = document.getElementById('up-weather-container');
            wContainer.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 8px;">
                    <strong style="color:var(--primary); font-size:1.2rem;">${wData.temperature}°C</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-muted);">Wind: ${wData.windspeed} km/h</span>
                </div>
            `;
        }
    } catch(err) {
        console.error("Weather failed:", err);
    }

    // 2. Fetch Schemes
    try {
        const sRes = await fetch('/api/up/schemes');
        if (!sRes.ok) throw new Error("Schemes fetch failed");
        const schemesData = await sRes.json();

        const recentContainer = document.getElementById('up-recent-container');
        const futureContainer = document.getElementById('up-future-container');

        let schemeCounter = window._upSchemeCounter || 0;

        const processSchemes = async (schemesList, container) => {
            if (!schemesList || schemesList.length === 0) return;
            for (let scheme of schemesList) {
                // DEDUPLICATION: skip already-rendered schemes on live refresh
                if (!window._renderedSchemes) window._renderedSchemes = new Set();
                if (window._renderedSchemes.has(scheme.title)) continue;
                window._renderedSchemes.add(scheme.title);

                const schemeId = `up-scheme-${schemeCounter++}`;
                window._upSchemeCounter = schemeCounter;

                let displayTitle = scheme.title;
                let displayPolitician = scheme.politician;
                let displayDesc = scheme.description;

                if (currentLang === 'hi') {
                    displayTitle = await translateToHindi(scheme.title);
                    displayPolitician = await transliterateSentence(scheme.politician);
                    displayDesc = await translateToHindi(scheme.description);
                }

                const card = document.createElement('div');
                card.className = 'glass-panel';
                card.style.padding = '1rem';
                card.style.marginBottom = '1rem';

                card.innerHTML = `
                    <div style="border-bottom: 2px solid var(--secondary); padding-bottom: 0.8rem; margin-bottom: 1.2rem;">
                        <h4 style="margin: 0; color:var(--text); font-size: 1.2rem; line-height: 1.3;">${displayTitle}</h4>
                        <p style="font-size: 0.9rem; color: var(--primary); margin: 0.5rem 0; font-weight: 600;">Announced By: ${displayPolitician}</p>
                    </div>
                    <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem;">${displayDesc}</p>
                    <a href="${scheme.url}" target="_blank" class="btn-secondary" style="display: inline-block; padding: 4px 12px; font-size: 0.75rem; margin-bottom: 1.5rem; text-decoration: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">View Source News Article &#8599;</a>
                    <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.2rem; border: 1px solid var(--border);">
                        <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--secondary); margin-bottom: 1rem; font-weight: bold;">Advanced Public Sentiment Graph</div>
                        <div id="d3-${schemeId}" style="height: 480px; width: 100%; position: relative; overflow: hidden; border-radius: 8px;">
                            <div class="loading-spinner" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
                        </div>
                        <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 1rem; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.8rem;">
                            <span><strong style="color:var(--secondary);">●</strong> Scheme Center</span>
                            <span><strong style="color:var(--positive);">●</strong> Positive Impact</span>
                            <span><strong style="color:var(--negative);">●</strong> Opposition/Resistance</span>
                            <span><strong style="color:#3b82f6;">●</strong> Implementation Body</span>
                            <span><strong>Size</strong> = Intensity of Impact</span>
                        </div>
                    </div>
                    <div id="text-${schemeId}" style="font-size:0.95rem; line-height: 1.7; color:var(--text); padding: 0.5rem;">
                        <div class="loading-spinner-small"></div>
                        <span style="font-style: italic; color: var(--text-muted);">Processing high-accuracy analysis via Sarvam AI...</span>
                    </div>
                `;
                container.appendChild(card);

                // Fire analysis in parallel
                analyzeSchemeForUP(scheme.title, scheme.description, `d3-${schemeId}`, `text-${schemeId}`)
                    .catch(e => console.error("Single scheme analysis failed:", e));
            }
        };

        // Only clear containers on first load
        if (!window._dashboardInitialized) {
            recentContainer.innerHTML = '';
            futureContainer.innerHTML = '';
            window._dashboardInitialized = true;
        }

        await processSchemes(schemesData.recent, recentContainer);
        await processSchemes(schemesData.future, futureContainer);

    } catch(err) {
        console.error("Schemes failed:", err);
    }
}

// AUTO-UPDATE: Check for new UP Government announcements every 5 minutes
setInterval(() => {
    console.log('[LIVE UPDATE] Checking for new UP Government announcements...');
    loadUPDashboard();
}, 5 * 60 * 1000);

async function analyzeSchemeForUP(title, description, d3ContainerId, textContainerId) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for deep analysis

        const response = await fetch('/api/analyze', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();

        // Update Text & Metrics
        const textContainer = document.getElementById(textContainerId);
        if (textContainer) {
            const metrics = data.metrics || { positive: 50, negative: 10, overall: 60 };
            textContainer.innerHTML = `
                <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.85rem;">
                        <span style="color:var(--positive);">Support: ${metrics.positive}%</span>
                        <span style="color:var(--negative);">Resistance: ${metrics.negative}%</span>
                        <span style="color:var(--secondary); font-weight:bold;">Success: ${metrics.overall}%</span>
                    </div>
                    <div style="color:var(--text); line-height:1.5;">
                        ${data.ai_prediction.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // Render isolated D3 Graph — wait for layout paint so clientWidth is valid
        setTimeout(() => {
            renderD3Graph(data.graph_data, d3ContainerId);

            // Generate smart graph explanation after render
            if (data.graph_data && data.graph_data.nodes) {
                const nodes = data.graph_data.nodes;
                const supporters = nodes.filter(n => n.group !== 1 && n.sentiment >= 0)
                    .sort((a, b) => (b.impact || 0) - (a.impact || 0));
                const resistors = nodes.filter(n => n.group !== 1 && n.sentiment < 0)
                    .sort((a, b) => (b.impact || 0) - (a.impact || 0));
                const centerNode = nodes.find(n => n.group === 1);

                const supportList = supporters.slice(0, 3).map(n => `<strong style="color:var(--positive);">${n.id}</strong>`).join(', ');
                const resistList = resistors.slice(0, 2).map(n => `<strong style="color:var(--negative);">${n.id}</strong>`).join(', ');

                const graphExplanation = `
                    <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.25); border-radius: 8px; border-left: 3px solid var(--secondary); font-size: 0.82rem; line-height: 1.7; color: var(--text-muted);">
                        <div style="font-weight: 700; color: var(--secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem;">📊 Graph Reading Guide</div>
                        <div>
                            The central <strong style="color:var(--secondary);">orange node</strong> represents
                            <strong style="color:var(--text);">${centerNode ? centerNode.id : 'this scheme'}</strong> — the policy being analyzed.
                            ${supporters.length > 0
                                ? `The <strong style="color:var(--positive);">green nodes</strong> (${supportList}) represent demographics expected to <strong>benefit positively</strong> from this scheme.`
                                : ''}
                            ${resistors.length > 0
                                ? ` The <strong style="color:var(--negative);">red nodes</strong> (${resistList}) indicate groups that may show <strong>resistance or opposition</strong>.`
                                : ' No significant resistance groups identified.'}
                        </div>
                        <div style="margin-top: 0.5rem;">
                            <strong>Node size</strong> reflects the <strong>intensity of impact</strong> — larger means more affected.
                            <strong>Link thickness</strong> shows the <strong>strength of connection</strong> between the scheme and each group.
                            You can <strong>drag any node</strong> to explore the network interactively.
                        </div>
                    </div>
                `;

                // Insert explanation below the graph container
                const graphEl = document.getElementById(d3ContainerId);
                if (graphEl && graphEl.parentElement) {
                    // Remove old explanation if any
                    const oldExp = graphEl.parentElement.querySelector('.graph-explanation');
                    if (oldExp) oldExp.remove();

                    const expDiv = document.createElement('div');
                    expDiv.className = 'graph-explanation';
                    expDiv.innerHTML = graphExplanation;
                    graphEl.parentElement.insertBefore(expDiv, graphEl.nextSibling);
                }
            }
        }, 120);

    } catch(err) {
        console.error(`UP Analysis error for ${title}:`, err);
        const textContainer = document.getElementById(textContainerId);
        if (textContainer) {
            textContainer.innerHTML = `<span style="color:var(--negative); font-size: 0.8rem;">Analysis Temporarily Delayed. Re-fetch to retry.</span>`;
        }
    }
}


