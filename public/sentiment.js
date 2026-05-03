/* Sentiment Analysis UI - Phase 4 Dashboard per PRD */
let sentimentData = null;
let currentConstituency = null;

async function loadSentimentData(constituencyId) {
    currentConstituency = constituencyId;
    const timeWindow = document.getElementById('sentiment-time-window')?.value || 'last_7d';

    try {
        const res = await fetch(`/api/up/sentiment/${constituencyId}?time_window=${timeWindow}`);
        sentimentData = await res.json();

        renderSentimentDashboard(sentimentData);
        await loadConstituencyAlerts(constituencyId);
    } catch (e) {
        console.error('[SENTIMENT] Error loading data:', e);
        showSentimentError(e.message);
    }
}

function renderSentimentDashboard(data) {
    const container = document.getElementById('sentiment-dashboard');
    if (!container) return;

    let html = `
        <div class="sentiment-header">
            <h3>Sentiment Analysis: ${data.constituency_id}</h3>
            <p>Time Window: ${data.time_window} | Computed: ${new Date(data.computed_at).toLocaleString()}</p>
        </div>
        <div class="sentiment-grid">
    `;

    if (data.aggregations && data.aggregations.length > 0) {
        data.aggregations.forEach(a => {
            const posColor = a.positive_pct > 50 ? '#10b981' : '#6b7280';
            const negColor = a.negative_pct > 50 ? '#ef4444' : '#6b7280';
            const domColor = a.dominant_sentiment === 'positive' ? '#10b981' :
                           a.dominant_sentiment === 'negative' ? '#ef4444' : '#f59e0b';

            html += `
                <div class="sentiment-card" style="border-left: 4px solid ${domColor}">
                    <div class="entity-name">${a.entity_id}</div>
                    <div class="sentiment-bars">
                        <div class="sentiment-bar positive" style="width: ${a.positive_pct}%; background: ${posColor};">
                            ${a.positive_pct.toFixed(1)}%
                        </div>
                        <div class="sentiment-bar neutral" style="width: ${a.neutral_pct}%; background: #f59e0b;">
                            ${a.neutral_pct.toFixed(1)}%
                        </div>
                        <div class="sentiment-bar negative" style="width: ${a.negative_pct}%; background: ${negColor};">
                            ${a.negative_pct.toFixed(1)}%
                        </div>
                    </div>
                    <div class="sentiment-meta">
                        <span class="dominant ${a.dominant_sentiment}">${a.dominant_sentiment}</span>
                        <span class="count">${a.total_count} observations</span>
                    </div>
                </div>
            `;
        });
    } else {
        html += `<div class="no-data">No sentiment data available for this constituency yet.</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

async function loadConstituencyAlerts(constituencyId) {
    try {
        const res = await fetch('/api/up/sentiment/alerts');
        const data = await res.json();

        const alertsContainer = document.getElementById('sentiment-alerts');
        if (!alertsContainer) return;

        const relevantAlerts = data.alerts.filter(a => a.constituency_id === constituencyId);

        if (relevantAlerts.length === 0) {
            alertsContainer.innerHTML = '<div class="no-alerts">No active alerts for this constituency.</div>';
            return;
        }

        let html = '<h4>Active Alerts</h4>';
        relevantAlerts.forEach(alert => {
            const bgColor = alert.severity === 'HIGH' ? '#7f1d1d' :
                          alert.severity === 'MEDIUM' ? '#854d0e' : '#1e3a5f';
            html += `
                <div class="alert-card" style="background: ${bgColor};">
                    <span class="alert-severity">${alert.severity}</span>
                    <span class="alert-message">${alert.message}</span>
                    <span class="alert-time">${new Date(alert.triggered_at).toLocaleTimeString()}</span>
                </div>
            `;
        });

        alertsContainer.innerHTML = html;
    } catch (e) {
        console.error('[SENTIMENT] Error loading alerts:', e);
    }
}

async function loadHeatmap() {
    const entityId = document.getElementById('heatmap-entity')?.value || 'party-bjp';
    const timeWindow = document.getElementById('sentiment-time-window')?.value || 'last_7d';
    const mapContainer = document.getElementById('sentiment-map-container');
    if (mapContainer) mapContainer.innerHTML = '<div class="loading-spinner" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>';

    try {
        const [sentRes, geoRes] = await Promise.all([
            fetch(`/api/up/sentiment/heatmap?entity_id=${entityId}&time_window=${timeWindow}`),
            fetch('/api/up/geo')
        ]);
        
        const data = await sentRes.json();
        const geojson = await geoRes.json();

        renderStateSummary(data.state_summary, data.entity_id);
        renderGeographicHeatmap(geojson, data.constituencies);
        renderAlerts(data.constituencies);
    } catch (e) {
        console.error('[SENTIMENT] Error loading heatmap:', e);
        if (mapContainer) mapContainer.innerHTML = `<p style="padding:2rem; color:var(--negative);">Error loading geographic data: ${e.message}</p>`;
    }
}

function renderStateSummary(summary, entityId) {
    const container = document.getElementById('state-metrics-grid');
    if (!container || !summary) return;

    const metrics = [
        { label: 'Positive', val: summary.positive_pct, col: '#10b981' },
        { label: 'Neutral', val: summary.neutral_pct, col: '#f59e0b' },
        { label: 'Negative', val: summary.negative_pct, col: '#ef4444' }
    ];

    container.innerHTML = metrics.map(m => `
        <div style="text-align: center; min-width: 100px; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; border-top: 3px solid ${m.col};">
            <div style="font-size: 1.4rem; font-weight: 800; color: ${m.col};">${m.val.toFixed(1)}%</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">${m.label}</div>
        </div>
    `).join('') + `
        <div style="text-align: right; margin-left: 1rem; border-left: 1px solid var(--border); padding-left: 1rem;">
            <div style="font-size: 0.9rem; font-weight: bold; color: var(--secondary);">${summary.total_observations}</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">GROUND SIGNALS</div>
        </div>
    `;
}

function renderGeographicHeatmap(geojson, sentiments) {
    const container = document.getElementById('sentiment-map-container');
    if (!container || !geojson) return;
    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const svg = d3.select('#sentiment-map-container')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`);

    const projection = d3.geoIdentity()
        .reflectY(true)
        .fitSize([width, height], geojson);

    const pathGenerator = d3.geoPath().projection(projection);

    // Map sentiment data for quick lookup
    const sentMap = {};
    sentiments.forEach(s => {
        if (s.constituency_id) sentMap[s.constituency_id.toLowerCase()] = s;
    });

    const g = svg.append('g');

    g.selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('d', pathGenerator)
        .style('stroke', 'rgba(255,255,255,0.1)')
        .style('stroke-width', '0.5px')
        .style('cursor', 'pointer')
        .style('fill', d => {
            const name = (d.properties.NAME_2 || d.properties.name || '').toLowerCase();
            const s = sentMap[name];
            if (!s) return '#1e293b'; // Slate-800 for no data
            
            // Color based on dominant sentiment and intensity
            if (s.positive_pct > 60) return '#10b981'; // Green
            if (s.negative_pct > 40) return '#ef4444'; // Red
            if (s.positive_pct > 40) return '#059669'; // Darker Green
            return '#f59e0b'; // Amber for mixed/neutral
        })
        .on('mouseover', function(e, d) {
            d3.select(this).style('stroke', '#fff').style('stroke-width', '1.5px');
        })
        .on('mouseout', function(e, d) {
            d3.select(this).style('stroke', 'rgba(255,255,255,0.1)').style('stroke-width', '0.5px');
        })
        .on('click', function(e, d) {
            const name = d.properties.NAME_2 || d.properties.name;
            openSentimentDetail(name);
        });

    // Add labels for districts with high sentiment intensity
    g.selectAll('text')
        .data(geojson.features.filter(d => {
            const name = (d.properties.NAME_2 || d.properties.name || '').toLowerCase();
            return sentMap[name];
        }))
        .enter()
        .append('text')
        .attr('x', d => pathGenerator.centroid(d)[0])
        .attr('y', d => pathGenerator.centroid(d)[1])
        .attr('text-anchor', 'middle')
        .style('font-size', '0.6rem')
        .style('fill', '#fff')
        .style('pointer-events', 'none')
        .style('text-shadow', '0 0 3px #000')
        .text(d => d.properties.NAME_2 || d.properties.name);
}

function renderAlerts(sentiments) {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    const critical = sentiments.filter(s => s.negative_pct > 40)
        .sort((a, b) => b.negative_pct - a.negative_pct);

    if (critical.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No critical negative pressure detected.</p>';
        return;
    }

    list.innerHTML = critical.map(s => `
        <div onclick="openSentimentDetail('${s.constituency_id}')" style="cursor:pointer; background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:0.6rem; margin-bottom:0.5rem; border-radius:4px; transition:0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
            <div style="font-weight:bold; font-size:0.85rem;">${s.constituency_id}</div>
            <div style="font-size:0.75rem; color:#f87171;">Negative Sentiment: ${s.negative_pct}%</div>
        </div>
    `).join('');
}

window.openSentimentDetail = function(constituencyId) {
    const overlay = document.getElementById('sentiment-detail-overlay');
    if (overlay) overlay.style.height = '70%';
    loadSentimentData(constituencyId);
}

window.closeSentimentDetail = function() {
    const overlay = document.getElementById('sentiment-detail-overlay');
    if (overlay) overlay.style.height = '0';
}

function showSentimentError(message) {
    const container = document.getElementById('sentiment-dashboard');
    if (!container) return;

    container.innerHTML = `
        <div class="error-message" style="color: #ef4444; padding: 1rem; background: #7f1d1d; border-radius: 8px;">
            <strong>Error:</strong> ${message}
            <p style="font-size: 0.9rem; margin-top: 0.5rem;">Please ensure Neo4j is running and sentiment data has been ingested.</p>
        </div>
    `;
}

// Initialize sentiment UI when constituency is selected
document.addEventListener('DOMContentLoaded', () => {
    // Select the tab link by its data-target attribute as defined in index.html
    const sentimentTab = document.querySelector('[data-target="sentiment-tab"]');
    
    if (sentimentTab) {
        sentimentTab.addEventListener('click', () => {
            console.log('[SENTIMENT] Tab clicked, checking selection...');
            const sel = window.AppState?.getSelection();
            if (sel?.constituencyId) {
                currentConstituency = sel.constituencyId;
                loadSentimentData(sel.constituencyId);
            } else if (sel?.district) {
                // Try to load constituency for this district
                fetch(`/api/up/district/${encodeURIComponent(sel.district)}/constituencies`)
                    .then(r => r.json())
                    .then(constituencies => {
                        if (constituencies && constituencies.length > 0) {
                            // The API might return an array of strings or objects
                            const first = constituencies[0];
                            const cid = typeof first === 'string' ? first : (first.id || first.name);
                            currentConstituency = cid;
                            loadSentimentData(cid);
                        } else {
                            loadHeatmap();
                        }
                    })
                    .catch(() => loadHeatmap());
            } else {
                // Fallback to state-wide heatmap if no selection
                loadHeatmap();
            }
        });
    }

    // Listen for selection changes in AppState
    if (window.AppState) {
        window.AppState.onChange((sel) => {
            const activeTab = document.querySelector('.tab-link.active');
            const isSentimentActive = activeTab && activeTab.getAttribute('data-target') === 'sentiment-tab';
            
            if (isSentimentActive && sel?.constituencyId) {
                currentConstituency = sel.constituencyId;
                loadSentimentData(sel.constituencyId);
            }
        });
    }
});
