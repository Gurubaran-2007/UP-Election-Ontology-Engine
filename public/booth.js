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

    window._boothPushAnalysis = (constName) => {
        pushView(showConstituencyAnalysis, [constName]);
        // Propagate constituency selection to AppState for sentiment tab
        if (window.AppState) {
            window.AppState.setSelection({
                constituencyId: constName,
                level: 'constituency'
            });
        }
    };

    // ── VIEW 4: CONSTITUENCY ANALYSIS ────────────────────────────────

    async function showConstituencyAnalysis(constName) {
        setHeader(constName, `Intelligent Analysis & Booth Data`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const res = await fetch(`/api/up/constituency/${encodeURIComponent(constName)}/analysis`);
            const data = await res.json();

            const sentimentData = await fetch(`/api/up/sentiment/${encodeURIComponent(constName)}`).then(r => r.json()).catch(() => null);

            const section = (title, content, color="#FF9933") => `
                <div class="glass-panel mb-2" style="border-top: 3px solid ${color};">
                    <h3 style="color:${color}; font-size:1.1rem; margin-bottom:1.2rem; text-transform:uppercase; letter-spacing:1px;">${title}</h3>
                    ${content}
                </div>
            `;

            const sentimentHtml = sentimentData && sentimentData.total > 0 ? `
                ${section('9. Sentiment Analysis', `
                    <div style="display:flex; gap:0.8rem; margin-bottom:1rem;">
                        ${sentimentData.breakdown.map(b => `
                            <div style="flex:1; text-align:center; padding:0.8rem; background:rgba(0,0,0,0.2); border-radius:8px; border-top: 3px solid ${b.label === 'positive' ? '#4ade80' : b.label === 'negative' ? '#ef4444' : '#94a3b8'};">
                                <div style="font-size:1.8rem; font-weight:800; color:${b.label === 'positive' ? '#4ade80' : b.label === 'negative' ? '#ef4444' : '#94a3b8'};">${b.count}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">${b.label}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="max-height:200px; overflow-y:auto;">
                        ${sentimentData.recent.map(r => `
                            <div style="padding:0.6rem; background:rgba(255,255,255,0.02); border-left:3px solid ${r.label === 'positive' ? '#4ade80' : r.label === 'negative' ? '#ef4444' : '#94a3b8'}; margin-bottom:0.5rem; border-radius:4px;">
                                <div style="font-size:0.75rem; font-weight:600;">${r.title.substring(0, 80)}${r.title.length > 80 ? '...' : ''}</div>
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.3rem;">
                                    <span style="color:${r.label === 'positive' ? '#4ade80' : r.label === 'negative' ? '#ef4444' : '#94a3b8'}; font-weight:bold;">${r.label.toUpperCase()}</span>
                                    · ${r.confidence ? (r.confidence * 100).toFixed(0) + '%' : 'N/A'}
                                    · ${r.language || 'unknown'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="text-align:center; margin-top:0.8rem; font-size:0.7rem; color:var(--text-muted);">
                        ${sentimentData.total} articles analyzed
                    </div>
                `, '#a78bfa')}` : `
                ${section('9. Sentiment Analysis', `
                    <div style="text-align:center; padding:1.5rem; color:var(--text-muted);">
                        <div style="font-size:2rem; margin-bottom:0.5rem;">📊</div>
                        <div style="font-size:0.8rem;">No sentiment data yet for ${constName}</div>
                        <div style="font-size:0.7rem; margin-top:0.3rem;">Run the sentiment pipeline to collect news</div>
                    </div>
                `, '#94a3b8')}`;

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

                        ${sentimentHtml}

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
                            <h3 style="color:#60a5fa; font-size:1.1rem; margin-bottom:0.2rem;">📍 Ground Booths</h3>
                            <p style="color:var(--text-muted); font-size:0.75rem; margin-bottom:1rem; font-style:italic;">Choose any booth to view in detail</p>
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
        setHeader(`Booth: ${boothName}`, `Constituency & Ground Level Intelligence`);
        container.innerHTML = '<div class="loading-spinner" style="margin:15% auto;"></div>';

        try {
            const [metaRes, leadersRes] = await Promise.all([
                fetch(`/api/up/booth/${boothId}/analysis`),
                fetch(`/api/up/booth/${boothId}/leaders`),
            ]);
            const data = await metaRes.json();
            const leadersData = await leadersRes.json();

            const b = data.basic;
            const demo = data.demographics || {};
            const shrugNote = demo.shrug_loaded
                ? `<span style="color:#4ade80;font-size:0.7rem;">✓ SHRUG demographics loaded</span>`
                : `<span style="color:#f59e0b;font-size:0.7rem;">⚠ SHRUG pending — equal-weight interpolation active</span>`;

            const metaHtml = `
                <div class="glass-panel" style="border-top:3px solid #60a5fa;margin-bottom:1.2rem;">
                    <h4 style="color:#60a5fa;font-size:0.9rem;margin-bottom:1rem;text-transform:uppercase;letter-spacing:1px;">📍 Booth Context</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;font-size:0.85rem;">
                        <div><span style="color:var(--text-muted);">Booth ID:</span> <strong>${b.id}</strong></div>
                        <div><span style="color:var(--text-muted);">Location:</span> <strong>${b.location}</strong></div>
                        <div><span style="color:var(--text-muted);">District:</span> <strong>${b.district}</strong></div>
                        <div><span style="color:var(--text-muted);">Type:</span> <strong>${data.social && data.social.type !== 'N/A' ? data.social.type : 'Unknown'}</strong></div>
                        <div><span style="color:var(--text-muted);">VS:</span> <strong>${b.vs_name || b.constituency}</strong></div>
                        <div><span style="color:var(--text-muted);">LS:</span> <strong>${b.ls_name || 'N/A'}</strong></div>
                        ${demo.total_voters ? `<div><span style="color:var(--text-muted);">Total Voters:</span> <strong>${Number(demo.total_voters).toLocaleString()}</strong></div>` : ''}
                        ${demo.literacy_rate ? `<div><span style="color:var(--text-muted);">Literacy:</span> <strong>${(demo.literacy_rate*100).toFixed(1)}%</strong></div>` : ''}
                    </div>
                    <div style="margin-top:0.8rem;">${shrugNote}</div>
                </div>`;

            const leaders = leadersData.leaders || [];
            const partyColors = { BJP:'#FF9933', SP:'#e11d48', BSP:'#1d4ed8', INC:'#16a34a' };
            const leadersHtml = `
                <div class="glass-panel" style="border-top:3px solid #a78bfa;margin-bottom:1.2rem;">
                    <h4 style="color:#a78bfa;font-size:0.9rem;margin-bottom:0.8rem;text-transform:uppercase;letter-spacing:1px;">🏛 Political Entities at this Booth</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                        ${leaders.map(l => `
                            <div onclick="window._loadBoothEntitySentiment('${boothId}','${l.entity_id}','${l.name}')"
                                 style="cursor:pointer;padding:0.4rem 0.9rem;border-radius:20px;
                                        border:1px solid ${partyColors[l.party]||'#6b7280'};
                                        background:rgba(0,0,0,0.3);font-size:0.78rem;transition:0.2s;"
                                 onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                                 onmouseout="this.style.background='rgba(0,0,0,0.3)'">
                                <span style="color:${partyColors[l.party]||'#94a3b8'};font-weight:bold;">${l.party||''}</span>
                                ${l.entity_type==='leader' ? '👤' : '🏳'} ${l.name}
                                ${l.is_local ? '<span style="font-size:0.65rem;color:#4ade80;"> LOCAL</span>' : ''}
                            </div>`).join('')}
                    </div>
                    <p style="font-size:0.7rem;color:var(--text-muted);">Click any entity to view sentiment analysis</p>
                </div>`;

            container.innerHTML = metaHtml + leadersHtml + `<div id="booth-sentiment-panel"></div>`;

            if (leaders.length > 0) {
                window._loadBoothEntitySentiment(boothId, leaders[0].entity_id, leaders[0].name);
            }

        } catch (e) {
            container.innerHTML = `<p style="color:var(--negative)">Error loading booth data: ${e.message}</p>`;
        }
    }

    window._loadBoothEntitySentiment = async function(boothId, entityId, entityName) {
        const panel = document.getElementById('booth-sentiment-panel');
        if (!panel) return;
        panel.innerHTML = '<div class="loading-spinner" style="margin:2rem auto;"></div>';
        try {
            const res = await fetch(`/api/up/sentiment/booth/${boothId}?entityId=${entityId}&time_window=last_7d`);
            const data = await res.json();
            const sentiments = data.sentiments || [];
            const s = sentiments.find(x => x.entity_id === entityId) || sentiments[0];
            const trendIcon = { improving:'↑', declining:'↓', stable:'→', volatile:'~' };
            const domColor = { positive:'#4ade80', negative:'#ef4444', neutral:'#f59e0b' };

            if (!s) {
                panel.innerHTML = `
                    <div class="glass-panel" style="border-top:3px solid #6b7280;text-align:center;padding:1.5rem;">
                        <div style="font-size:2rem;">📊</div>
                        <div style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem;">
                            No data yet for <strong>${entityName}</strong> in this area.<br>
                            <span style="font-size:0.75rem;">Run the sentiment pipeline to collect news.</span>
                        </div>
                    </div>`;
                return;
            }
            const confPct = Math.round((s.confidence_adjusted || 0) * 100);
            panel.innerHTML = `
                <div class="glass-panel" style="border-top:3px solid ${domColor[s.dominant_sentiment]||'#6b7280'};">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                        <h4 style="color:${domColor[s.dominant_sentiment]};font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">
                            📊 Sentiment — ${entityName}
                        </h4>
                        <span style="font-size:0.7rem;background:rgba(167,139,250,0.15);color:#a78bfa;
                               border:1px solid #a78bfa;padding:2px 8px;border-radius:10px;">ⓘ Interpolated Signal</span>
                    </div>
                    <div style="display:flex;gap:0.6rem;margin-bottom:1rem;">
                        ${[['Positive','positive_pct','#4ade80'],['Neutral','neutral_pct','#f59e0b'],['Negative','negative_pct','#ef4444']].map(([lbl,key,col])=>`
                            <div style="flex:1;text-align:center;padding:0.8rem;background:rgba(0,0,0,0.25);border-radius:8px;border-top:3px solid ${col};">
                                <div style="font-size:1.8rem;font-weight:800;color:${col};">${((s[key])||0).toFixed(1)}%</div>
                                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;">${lbl}</div>
                            </div>`).join('')}
                    </div>
                    <div style="display:flex;align-items:center;gap:1.2rem;font-size:0.82rem;margin-bottom:0.8rem;">
                        <span>Dominant: <strong style="color:${domColor[s.dominant_sentiment]};">${s.dominant_sentiment}</strong></span>
                        <span>Trend: <strong style="color:#60a5fa;">${trendIcon[s.trending]||'→'} ${s.trending}</strong></span>
                        <span>Confidence: <strong>${confPct}%</strong></span>
                        ${s.total_observations ? `<span style="color:var(--text-muted);font-size:0.75rem;">${s.total_observations} obs</span>` : ''}
                    </div>
                    <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);
                                border-radius:6px;padding:0.6rem;font-size:0.7rem;color:#a78bfa;">
                        ℹ️ ${s.interpolation_note || 'Aggregated from constituency-level data.'}
                    </div>
                </div>`;
        } catch(e) {
            panel.innerHTML = `<p style="color:var(--negative)">Error loading sentiment: ${e.message}</p>`;
        }
    };


    // Export to global scope
    window.initBoothModule = init;

    // Auto-init on load if tab is active
    document.addEventListener('DOMContentLoaded', init);
})();
