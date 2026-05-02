/**
 * UP CONSTITUENCY & BOOTH MODULE
 * Handles multi-level drill-down: Region -> District -> Constituency -> Booth
 */

(function() {
    // Navigation Stack to handle "Back" functionality
    const navStack = [];
    const container = document.getElementById('booth-dynamic-container');
    const backBtn = document.getElementById('booth-back-btn');
    const titleEl = document.getElementById('booth-view-title');
    const subtitleEl = document.getElementById('booth-view-subtitle');

    const REGIONS = [
        { id: 'western', name: 'Western UP', color: '#fef9c3', desc: 'The industrial & agricultural hub of the West.' },
        { id: 'central', name: 'Central UP', color: '#d8b4fe', desc: 'The heart of political power and governance.' },
        { id: 'eastern', name: 'Eastern UP (Purvanchal)', color: '#86efac', desc: 'Densely populated belt with diverse demographics.' },
        { id: 'bundelkhand', name: 'Bundelkhand', color: '#fca5a5', desc: 'The historic plateau region with unique issues.' }
    ];

    // Initialize module
    function init() {
        if (!container) return;
        
        backBtn.onclick = goBack;
        showRegions();
    }

    // ── NAVIGATION HELPERS ──────────────────────────────────────────

    let currentView = { fn: showRegions, args: [] };

    function pushView(nextFn, nextArgs) {
        // Save where we are now before going forward
        navStack.push({ 
            fn: currentView.fn, 
            args: currentView.args, 
            title: titleEl.innerText, 
            subtitle: subtitleEl.innerText 
        });
        
        backBtn.style.display = 'flex';
        
        // Update current view and execute
        currentView = { fn: nextFn, args: nextArgs };
        nextFn(...nextArgs);
    }

    function goBack() {
        const previous = navStack.pop();
        if (previous) {
            if (navStack.length === 0) backBtn.style.display = 'none';
            
            // Restore header and view
            setHeader(previous.title, previous.subtitle);
            currentView = { fn: previous.fn, args: previous.args };
            previous.fn(...previous.args);
        }
    }

    function setHeader(title, subtitle) {
        titleEl.innerText = title;
        subtitleEl.innerText = subtitle;
    }

    // ── VIEW 1: REGIONS ──────────────────────────────────────────────

    function showRegions() {
        setHeader('UP Constituency & Booth', 'Select a region to begin deep-dive analysis');
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                ${REGIONS.map(r => `
                    <div class="glass-panel hover-card" onclick="window._boothPushDistricts('${r.id}', '${r.name}')" style="cursor:pointer; padding:2rem; border-left: 5px solid ${r.color};">
                        <h3 style="color:${r.color}; font-size:1.5rem; margin-bottom:0.5rem;">${r.name}</h3>
                        <p style="color:var(--text-muted); font-size:0.9rem;">${r.desc}</p>
                        <div style="margin-top:1.5rem; color:var(--primary); font-weight:bold; font-size:0.8rem;">EXPLORE REGION →</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    window._boothPushDistricts = (id, name) => pushView(showDistricts, [id, name]);

    // ── VIEW 2: DISTRICTS ─────────────────────────────────────────────

    async function showDistricts(regionId, regionName) {
        setHeader(regionName, `Districts in ${regionName}`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const res = await fetch(`/api/up/region/${regionId}/districts`);
            const districts = await res.json();

            if (!districts || districts.length === 0) {
                container.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-muted);">No districts found for this region in database.</p>`;
                return;
            }

            container.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                    ${districts.map(d => `
                        <div class="glass-panel" onclick="window._boothPushConstituencies('${d}')" style="cursor:pointer; padding:1.2rem; text-align:center; transition:0.2s; border:1px solid var(--border);">
                            <div style="font-size:1.1rem; font-weight:700;">${d}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;">VIEW CONSTITUENCIES</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:var(--negative)">Error loading districts. Please check server.</p>`;
        }
    }

    window._boothPushConstituencies = (dist) => pushView(showConstituencies, [dist]);

    // ── VIEW 3: CONSTITUENCIES ────────────────────────────────────────

    async function showConstituencies(districtName) {
        setHeader(districtName, `Constituencies in ${districtName} District`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const res = await fetch(`/api/up/district/${encodeURIComponent(districtName)}/constituencies`);
            const data = await res.json();

            container.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;">
                    ${data.map(c => `
                        <div class="glass-panel" onclick="window._boothPushAnalysis('${c}')" style="cursor:pointer; padding:1.5rem; background:rgba(255,153,51,0.03); border:1.5px solid rgba(255,153,51,0.15);">
                            <div style="font-size:0.75rem; color:var(--secondary); font-weight:bold; letter-spacing:1px; margin-bottom:0.5rem;">CONSTITUENCY</div>
                            <div style="font-size:1.2rem; font-weight:800; color:#fff;">${c}</div>
                            <div style="margin-top:1rem; font-size:0.8rem; color:var(--primary);">ANALYZE DEEP-DIVE →</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:var(--negative)">Error loading constituencies.</p>`;
        }
    }

    window._boothPushAnalysis = (constName) => pushView(showConstituencyAnalysis, [constName]);

    // ── VIEW 4: CONSTITUENCY ANALYSIS ────────────────────────────────

    async function showConstituencyAnalysis(constName) {
        setHeader(constName, `Intelligent Analysis & Booth Data`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const res = await fetch(`/api/up/constituency/${encodeURIComponent(constName)}/analysis`);
            const data = await res.json();

            // Helper for section styling
            const section = (title, content, color="#FF9933") => `
                <div class="glass-panel mb-2" style="border-top: 3px solid ${color};">
                    <h3 style="color:${color}; font-size:1.1rem; margin-bottom:1.2rem; text-transform:uppercase; letter-spacing:1px;">${title}</h3>
                    ${content}
                </div>
            `;

            container.innerHTML = `
                <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1.5rem;">
                    <div class="col-main">
                        ${section('1. Basic Info & Demographics', `
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                                <div class="stat-card"><strong>Total Voters:</strong> ${data.basic.total_voters}</div>
                                <div class="stat-card"><strong>Urban/Rural:</strong> ${data.basic.urban_rural}</div>
                                <div class="stat-card"><strong>Dominant Caste:</strong> ${data.demographics.dominant_caste}</div>
                                <div class="stat-card"><strong>Youth %:</strong> ${data.demographics.youth_pop}</div>
                            </div>
                            <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6;">${data.demographics.religion_dist}</p>
                        `, '#4ade80')}

                        ${section('2. Election Results (2022)', `
                            <div style="background:rgba(0,0,0,0.2); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem;">
                                <div style="font-size:1.4rem; font-weight:800; color:var(--positive);">${data.results.winner}</div>
                                <div style="display:flex; gap:1rem; margin-top:0.5rem; font-size:0.9rem;">
                                    <span>Party: <strong>${data.results.party}</strong></span>
                                    <span>Vote Share: <strong>${data.results.vote_share}%</strong></span>
                                </div>
                            </div>
                            <div id="results-chart" style="height:200px; width:100%; display:flex; align-items:flex-end; gap:1rem; padding-top:1rem;">
                                ${data.results.chart_data.map(c => `
                                    <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:100%; height:${c.val}%; background:linear-gradient(to top, var(--primary), var(--secondary)); border-radius:4px 4px 0 0;"></div>
                                        <div style="font-size:0.65rem; margin-top:0.5rem; text-align:center;">${c.label}</div>
                                    </div>
                                `).join('')}
                            </div>
                        `)}

                        ${section('3. Candidate Intelligence', `
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                ${data.candidates.map(c => `
                                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:1rem; border-radius:8px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <strong style="font-size:1.1rem;">${c.name} (${c.party})</strong>
                                            <span style="${c.cases > 0 ? 'color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid #ef4444;' : 'color:var(--positive);'} padding:2px 8px; border-radius:10px; font-size:0.7rem;">
                                                ${c.cases > 0 ? '⚠️ ' + c.cases + ' Cases' : 'Clean Record'}
                                            </span>
                                        </div>
                                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">
                                            Education: ${c.education} | Assets: ${c.assets}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `, '#60a5fa')}

                        ${section('6. Trends (2017 vs 2022)', `
                            <div style="margin-bottom:1rem;">${data.trends.graph_explanation}</div>
                            <div style="height:150px; background:rgba(0,0,0,0.1); border:1px dashed var(--border); display:flex; align-items:center; justify-content:center; border-radius:8px;">
                                <p style="font-size:0.8rem; color:var(--text-muted);">[Performance Trend Line Graph Placeholder]</p>
                            </div>
                        `, '#c084fc')}
                    </div>

                    <div class="col-sidebar">
                        ${section('5. Issue Heatmap', `
                            ${data.issues.map(i => `
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; font-size:0.9rem;">
                                    <span>${i.name}</span>
                                    <span style="padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold; background:${i.level === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(243,156,18,0.15)'}; color:${i.level === 'High' ? '#ef4444' : '#f39c12'};">
                                        ${i.level}
                                    </span>
                                </div>
                            `).join('')}
                        `, '#f39c12')}

                        ${section('7. Graph View', `
                            <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.6; margin-bottom:1rem;">${data.graph_explanation}</p>
                            <div style="height:180px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:var(--secondary);">
                                VIEW ONTOLOGY NODES...
                            </div>
                        `)}

                        ${section('8. Alerts Section', `
                            ${data.alerts.map(a => `
                                <div style="background:rgba(239,68,68,0.05); border-left:3px solid #ef4444; padding:0.8rem; margin-bottom:0.5rem; font-size:0.8rem;">
                                    ${a}
                                </div>
                            `).join('')}
                        `, '#ef4444')}

                        <!-- BOOTH LIST -->
                        <div class="glass-panel mt-2" style="background:rgba(59,130,246,0.05); border:1.5px solid rgba(59,130,246,0.3);">
                            <h3 style="color:#60a5fa; font-size:1.1rem; margin-bottom:1rem;">📍 Ground Booths</h3>
                            <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem;">
                                ${data.booths.map(b => `
                                    <div class="booth-link" onclick="window._boothPushDetail('${b.id}', '${b.name}')" style="cursor:pointer; padding:0.7rem; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px; font-size:0.85rem; display:flex; justify-content:space-between;">
                                        <span>${b.name}</span>
                                        <span style="color:var(--text-muted); font-size:0.7rem;">ID: ${b.id}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:var(--negative)">Error generating constituency intelligence.</p>`;
        }
    }

    window._boothPushDetail = (id, name) => pushView(showBoothAnalysis, [id, name]);

    // ── VIEW 5: BOOTH ANALYSIS ───────────────────────────────────────

    async function showBoothAnalysis(boothId, boothName) {
        setHeader(`Booth: ${boothName}`, `Constituency & Ground Level Data`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const res = await fetch(`/api/up/booth/${boothId}/analysis`);
            const data = await res.json();

            const section = (title, content, color="#FF9933") => `
                <div class="glass-panel" style="border-top: 2px solid ${color}; margin-bottom:1.2rem;">
                    <h4 style="color:${color}; font-size:0.9rem; margin-bottom:1rem; text-transform:uppercase;">${title}</h4>
                    ${content}
                </div>
            `;

            container.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1.2rem;">
                    <div class="booth-col">
                        ${section('1. Booth Basic Info', `
                            <p><strong>ID:</strong> ${data.basic.id}</p>
                            <p><strong>Location:</strong> ${data.basic.location}</p>
                            <p><strong>Linked:</strong> ${data.basic.constituency}</p>
                        `, '#60a5fa')}
                        
                        ${section('2. Voter Data', `
                            <p><strong>Total:</strong> ${data.voters.total}</p>
                            <p><strong>Ratio:</strong> ${data.voters.ratio}</p>
                            <p><strong>Ages:</strong> ${data.voters.age_groups}</p>
                        `, '#4ade80')}

                        ${section('7. Risk Indicators', `
                            ${data.risks.map(r => `<div style="color:#ef4444; font-weight:bold; margin-bottom:0.4rem;">🚨 ${r}</div>`).join('')}
                        `, '#ef4444')}
                    </div>

                    <div class="booth-col">
                        ${section('3. Voting Pattern', `
                            <div style="height:120px; width:120px; border-radius:50%; border:15px solid var(--primary); margin:0 auto; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                                ${data.pattern.turnout}%
                            </div>
                            <p style="text-align:center; margin-top:1rem;"><strong>Winner:</strong> ${data.pattern.winner}</p>
                        `, '#f39c12')}

                        ${section('4. Turnout Analysis', `
                            <div style="height:100px; display:flex; align-items:flex-end; gap:0.5rem; background:rgba(0,0,0,0.1); padding:0.5rem; border-radius:4px;">
                                <div style="flex:1; height:60%; background:var(--text-muted);"></div>
                                <div style="flex:1; height:85%; background:var(--positive);"></div>
                            </div>
                            <p style="font-size:0.75rem; margin-top:0.5rem;">Current vs Avg: ${data.turnout_comparison}</p>
                        `, '#06b6d4')}
                    </div>

                    <div class="booth-col">
                        ${section('5. Social Composition', `
                            <p><strong>Dominant:</strong> ${data.social.dominant}</p>
                            <p><strong>Type:</strong> ${data.social.type}</p>
                        `, '#c084fc')}

                        ${section('6. Issue Tagging', `
                            <div style="background:rgba(255,255,255,0.03); padding:0.8rem; border-radius:6px; border:1px dashed var(--border);">
                                <span style="color:var(--secondary); font-weight:bold;">Primary Issue:</span><br>
                                ${data.issue}
                            </div>
                        `, '#f472b6')}
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:var(--negative)">Error loading booth data.</p>`;
        }
    }

    // Export to global scope
    window.initBoothModule = init;

    // Auto-init on load if tab is active
    document.addEventListener('DOMContentLoaded', init);
})();
