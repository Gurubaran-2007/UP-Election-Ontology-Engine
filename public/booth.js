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
                                <div class="stat-card" style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px; border:1px solid var(--border);">
                                    <span style="display:block; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Total Voters</span>
                                    <strong style="font-size:1.4rem; color:var(--primary);">${data.basic.total_voters}</strong>
                                </div>
                                <div class="stat-card" style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px; border:1px solid var(--border);">
                                    <span style="display:block; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Area Type</span>
                                    <strong style="font-size:1.4rem; color:var(--secondary);">${data.basic.urban_rural}</strong>
                                </div>
                            </div>
                            <div style="padding:1rem; background:rgba(74,222,128,0.05); border-radius:8px; border:1px solid rgba(74,222,128,0.2);">
                                <p style="margin:0; font-size:0.9rem; color:#4ade80;"><strong>Demographic Focus:</strong> ${data.demographics.dominant_caste}</p>
                                <p style="margin:0.5rem 0 0; font-size:0.85rem; color:var(--text-muted);">${data.demographics.religion_dist}</p>
                            </div>
                        `, '#4ade80')}

                        ${section('2. Election Results (2022)', `
                            <div style="background:linear-gradient(90deg, rgba(255,153,51,0.1), transparent); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem; border:1px solid rgba(255,153,51,0.2);">
                                <div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-bottom:0.4rem;">LEADING CANDIDATE</div>
                                <div style="font-size:1.6rem; font-weight:900; color:#fff;">${data.results.winner}</div>
                                <div style="display:flex; gap:1.5rem; margin-top:0.8rem; font-size:0.95rem;">
                                    <span>Party: <strong style="color:var(--secondary);">${data.results.party}</strong></span>
                                    <span>Vote Share: <strong style="color:var(--positive);">${data.results.vote_share}%</strong></span>
                                </div>
                            </div>
                            <div style="height:250px; width:100%; position:relative;">
                                <div id="booth-results-chart" style="height:100%; width:100%;"></div>
                            </div>
                        `)}

                        ${section('3. Candidate Intelligence', `
                            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                                ${data.candidates.map(c => `
                                    <div class="glass-panel" style="padding:1rem; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                        <div>
                                            <div style="font-weight:700; font-size:1rem; color:#fff;">${c.name}</div>
                                            <div style="font-size:0.8rem; color:var(--text-muted);">${c.party} | Education: ${c.education}</div>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-weight:800; color:var(--primary);">${Number(c.votes).toLocaleString()} Votes</div>
                                            <span style="${c.cases > 0 ? 'color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid #ef4444;' : 'color:var(--positive);'} padding:2px 8px; border-radius:10px; font-size:0.65rem;">
                                                ${c.cases > 0 ? '⚠️ ' + c.cases + ' Cases' : 'Clean Record'}
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `, '#60a5fa')}
                    </div>

                    <div class="col-sidebar">
                        ${section('5. Issue Heatmap', `
                            ${data.issues.map(i => `
                                <div style="margin-bottom:1rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.85rem;">
                                        <span style="font-weight:600;">${i.name}</span>
                                        <span style="padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold; background:${i.level === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(243,156,18,0.15)'}; color:${i.level === 'High' ? '#ef4444' : '#f39c12'};">
                                            ${i.level}
                                        </span>
                                    </div>
                                    <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                        <div style="width:${i.level === 'High' ? '85' : '45'}%; height:100%; background:${i.level === 'High' ? '#ef4444' : '#f39c12'};"></div>
                                    </div>
                                </div>
                            `).join('')}
                        `, '#f39c12')}

                        ${section('7. Live Graph View', `
                            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.5; margin-bottom:1rem;">${data.graph_explanation}</p>
                            <div id="constituency-graph-container" style="height:350px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:12px; position:relative; overflow:hidden;">
                                <div class="loading-spinner-small" style="position:absolute; top:50%; left:50%;"></div>
                            </div>
                            <!-- LEGEND ADDED HERE -->
                            <div style="display:flex; gap:1rem; margin-top:1rem; justify-content:center; font-size:0.75rem;">
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    <div style="width:10px; height:10px; border-radius:50%; background:var(--primary);"></div>
                                    <span style="color:var(--text-muted);">Region</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    <div style="width:10px; height:10px; border-radius:50%; background:var(--secondary);"></div>
                                    <span style="color:var(--text-muted);">Candidate</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    <div style="width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,0.2);"></div>
                                    <span style="color:var(--text-muted);">Booth</span>
                                </div>
                            </div>
                            <p style="text-align:center; font-size:0.7rem; color:var(--secondary); margin-top:1rem; font-style:italic;">
                                (Tip: You can drag the nodes with your mouse to explore the network!)
                            </p>
                        `)}

                        ${section('8. Smart Alerts', `
                            ${data.alerts.map(a => `
                                <div style="background:rgba(239,68,68,0.05); border-left:3px solid #ef4444; padding:0.8rem; margin-bottom:0.5rem; font-size:0.78rem; line-height:1.4; color:#e2e8f0;">
                                    <strong style="color:#ef4444;">ALERT:</strong> ${a}
                                </div>
                            `).join('')}
                        `, '#ef4444')}

                        <div class="glass-panel mt-2" style="background:rgba(59,130,246,0.05); border:1.5px solid rgba(59,130,246,0.3);">
                            <h3 style="color:#60a5fa; font-size:1.1rem; margin-bottom:0.2rem;">📍 Polling Stations</h3>
                            <p style="color:var(--text-muted); font-size:0.75rem; margin-bottom:1rem;">Top booths by electors in ${constName}</p>
                            <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem; padding-right:5px;">
                                ${data.booths.map(b => `
                                    <div class="booth-link" onclick="window._boothPushDetail('${b.id}', '${b.name}')" style="cursor:pointer; padding:0.8rem; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center; transition:0.2s;">
                                        <span style="font-weight:600;">${b.name}</span>
                                        <span style="color:var(--secondary); font-size:0.7rem; background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:4px;">${b.electors} electors</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // RENDER VISUALS
            setTimeout(() => {
                renderBoothResultsChart(data.results.chart_data, 'booth-results-chart');
                renderConstituencyGraph(data, 'constituency-graph-container');
            }, 150);

        } catch (e) {
            console.error("Analysis Crash:", e);
            container.innerHTML = `<p style="color:var(--negative)">Error generating constituency intelligence. ${e.message}</p>`;
        }
    }

    // ── D3 VISUALIZATION ENGINES ─────────────────────────────────────

    function renderBoothResultsChart(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const width = container.clientWidth;
        const height = container.clientHeight;
        const margin = {top: 20, right: 20, bottom: 40, left: 40};

        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const x = d3.scaleBand()
            .range([margin.left, width - margin.right])
            .domain(data.map(d => d.label))
            .padding(0.4);

        const y = d3.scaleLinear()
            .range([height - margin.bottom, margin.top])
            .domain([0, 100]);

        // Draw Bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.label))
            .attr('y', height - margin.bottom)
            .attr('width', x.bandwidth())
            .attr('height', 0)
            .attr('fill', (d, i) => i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)')
            .attr('rx', 4)
            .transition().duration(800)
            .attr('y', d => y(d.val))
            .attr('height', d => height - margin.bottom - y(d.val));

        // Add Labels
        svg.selectAll('.label')
            .data(data)
            .enter()
            .append('text')
            .attr('x', d => x(d.label) + x.bandwidth() / 2)
            .attr('y', d => y(d.val) - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .text(d => d.val + '%');

        // Add X Axis
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('fill', 'var(--text-muted)')
            .style('font-size', '10px');
    }

    function renderConstituencyGraph(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Prepare Nodes
        const nodes = [
            { id: 'Center', label: 'CONSTITUENCY', group: 1, size: 25 },
            ...data.candidates.map(c => ({ id: c.name, label: c.name, group: 2, size: 15 })),
            ...data.booths.slice(0, 10).map(b => ({ id: b.id, label: 'Booth', group: 3, size: 8 }))
        ];

        // Prepare Links
        const links = [
            ...data.candidates.map(c => ({ source: 'Center', target: c.name })),
            ...data.booths.slice(0, 10).map(b => ({ source: 'Center', target: b.id }))
        ];

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-150))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .style('stroke', 'rgba(255,255,255,0.1)')
            .style('stroke-width', 1);

        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => {
                if (d.group === 1) return 'var(--primary)';
                if (d.group === 2) return 'var(--secondary)';
                return 'rgba(255,255,255,0.2)';
            })
            .style('stroke', 'rgba(0,0,0,0.5)')
            .style('stroke-width', 1)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        simulation.on('tick', () => {
            link.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('cx', d => d.x)
                .attr('cy', d => d.y);
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
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
            if (data.error) throw new Error(data.error);

            const section = (title, content, color="#FF9933") => `
                <div class="glass-panel" style="border-top: 2px solid ${color}; margin-bottom:1.2rem; padding:1.5rem;">
                    <h4 style="color:${color}; font-size:0.9rem; margin-bottom:1.2rem; text-transform:uppercase; letter-spacing:1px;">${title}</h4>
                    ${content}
                </div>
            `;

            container.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1.5rem;">
                    <div class="booth-col">
                        ${section('1. Station Identity', `
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                <div><label style="color:var(--text-muted); font-size:0.75rem;">NAME</label><div style="font-weight:bold; font-size:1.1rem;">${data.basic.location}</div></div>
                                <div><label style="color:var(--text-muted); font-size:0.75rem;">REGION</label><div style="color:var(--primary);">${data.basic.constituency}</div></div>
                                <div style="padding:0.8rem; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--border);">
                                    ID: <code style="color:var(--secondary);">${data.basic.id}</code>
                                </div>
                            </div>
                        `, '#60a5fa')}
                        
                        ${section('2. Elector Demographics', `
                            <div style="text-align:center; padding:1rem;">
                                <div style="font-size:2rem; font-weight:900; color:#fff;">${data.voters.total}</div>
                                <div style="color:var(--text-muted); font-size:0.8rem;">TOTAL REGISTERED ELECTORS</div>
                                <div style="margin-top:1.5rem; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                                    <div style="width:65%; height:100%; background:var(--positive);"></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-top:0.5rem; font-size:0.7rem; color:var(--text-muted);">
                                    <span>GENDER RATIO: ${data.voters.ratio}</span>
                                    <span>AGE: ${data.voters.age_groups}</span>
                                </div>
                            </div>
                        `, '#4ade80')}
                    </div>

                    <div class="booth-col">
                        ${section('3. Voting Behavior', `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:1rem; padding:1rem;">
                                <div style="position:relative; height:140px; width:140px;">
                                    <svg viewBox="0 0 36 36" style="width:140px; height:140px;">
                                        <path style="stroke:rgba(255,255,255,0.1); stroke-width:3; fill:none;" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path style="stroke:var(--primary); stroke-width:3; stroke-dasharray: ${data.pattern.turnout}, 100; fill:none; stroke-linecap:round;" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    </svg>
                                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:1.8rem; font-weight:800;">${data.pattern.turnout}%</div>
                                </div>
                                <div style="text-align:center;">
                                    <span style="color:var(--text-muted); font-size:0.75rem;">BOOTH TURNOUT</span>
                                    <div style="margin-top:1rem; color:var(--positive); font-weight:bold;">WINNER: ${data.pattern.winner}</div>
                                </div>
                            </div>
                        `, '#f39c12')}

                        ${section('4. Risk Indicators', `
                            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                                ${data.risks.map(r => `
                                    <div style="padding:0.8rem; background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:6px; font-size:0.85rem; color:#f87171;">
                                        ⚠️ ${r}
                                    </div>
                                `).join('')}
                            </div>
                        `, '#ef4444')}
                    </div>

                    <div class="booth-col">
                        ${section('5. Social Composition', `
                            <div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px;">
                                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.4rem;">DOMINANT GROUP</div>
                                <div style="font-weight:bold; color:var(--secondary); font-size:1.2rem;">${data.social.dominant}</div>
                                <div style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">${data.social.type} Category</div>
                            </div>
                        `, '#c084fc')}

                        ${section('6. Ground Intelligence', `
                            <div style="background:rgba(255,255,255,0.02); border:1px dashed var(--border); padding:1rem; border-radius:8px; line-height:1.6; font-size:0.9rem;">
                                <span style="color:var(--primary); font-weight:bold; display:block; margin-bottom:0.5rem;">PRIMARY LOCAL ISSUE</span>
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
