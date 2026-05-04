// ============================================================
// INDIA MAP MODULE — state-level drill-down
// ============================================================

(function () {

    // States that have data configured — clicking these drills down
    const CONFIGURED_STATES = {
        'Uttar Pradesh': { code: 'UP', tab: 'up-map-tab', label: 'UP District Map' },
    };

    // Party color palette for election result coloring
    const PARTY_COLORS = {
        bjp:   '#FF9933',
        sp:    '#FF0000',
        bsp:   '#0000FF',
        inc:   '#00BFFF',
        other: '#94a3b8',
    };

    function getStateColor(stateName) {
        // Color live-configured states distinctly; others are dimmed
        return CONFIGURED_STATES[stateName] ? 'rgba(255,153,51,0.25)' : '#1e293b';
    }

    function getStateHoverColor(stateName) {
        return CONFIGURED_STATES[stateName] ? 'rgba(255,153,51,0.55)' : '#334155';
    }

    // ── Render India map ────────────────────────────────────────────
    function renderIndiaMap(geojson) {
        const container = document.getElementById('india-map-svg');
        if (!container) return;
        container.innerHTML = '';

        const parent = container.parentElement;
        const width  = parent.clientWidth  || 900;
        const height = parent.clientHeight || 680;

        const svg = d3.select('#india-map-svg')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', 'var(--bg-dark, #0f172a)');

        const g = svg.append('g');

        const projection = d3.geoMercator().fitSize([width, height], geojson);
        const path = d3.geoPath().projection(projection);

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                g.selectAll('.state-label')
                    .style('font-size', `${Math.max(0.4, 0.7 / Math.sqrt(event.transform.k))}rem`);
            });
        svg.call(zoom);

        const tooltip = d3.select('#india-map-tooltip');

        // Draw states
        g.selectAll('path')
            .data(geojson.features)
            .enter()
            .append('path')
            .attr('d', path)
            .attr('class', 'india-state-path')
            .style('fill', d => getStateColor(d.properties.ST_NM))
            .style('stroke', '#334155')
            .style('stroke-width', '0.8px')
            .style('cursor', d => CONFIGURED_STATES[d.properties.ST_NM] ? 'pointer' : 'default')
            .on('mouseover', function (event, d) {
                const name = d.properties.ST_NM;
                d3.select(this)
                    .transition().duration(120)
                    .style('fill', getStateHoverColor(name));
                tooltip
                    .style('opacity', 1)
                    .html(() => {
                        const cfg = CONFIGURED_STATES[name];
                        return `<strong>${name}</strong>${cfg ? '<br><span style="color:#FF9933;font-size:0.75rem;">Click to explore →</span>' : ''}`;
                    });
            })
            .on('mousemove', function (event) {
                const svgRect = svg.node().getBoundingClientRect();
                tooltip
                    .style('left', (event.clientX - svgRect.left + 12) + 'px')
                    .style('top',  (event.clientY - svgRect.top  - 28) + 'px');
            })
            .on('mouseout', function (event, d) {
                d3.select(this)
                    .transition().duration(120)
                    .style('fill', getStateColor(d.properties.ST_NM));
                tooltip.style('opacity', 0);
            })
            .on('click', function (event, d) {
                const name = d.properties.ST_NM;
                const cfg = CONFIGURED_STATES[name];
                if (!cfg) {
                    showComingSoon(name);
                    return;
                }
                // Switch to that state's tab
                document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(s => {
                    s.style.display = 'none';
                    s.classList.remove('active');
                });
                const target = document.getElementById(cfg.tab);
                if (target) {
                    target.style.display = 'block';
                    target.classList.add('active');
                    if (window._initUPMap) window._initUPMap();
                }
                const link = document.querySelector(`[data-target="${cfg.tab}"]`);
                if (link) link.classList.add('active');
            });

        // State name labels
        g.selectAll('.state-label')
            .data(geojson.features)
            .enter()
            .append('text')
            .attr('class', 'state-label')
            .attr('x', d => path.centroid(d)[0])
            .attr('y', d => path.centroid(d)[1])
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('pointer-events', 'none')
            .style('font-size', '0.6rem')
            .style('font-weight', '600')
            .style('fill', d => CONFIGURED_STATES[d.properties.ST_NM] ? '#fff' : '#64748b')
            .style('text-transform', 'uppercase')
            .style('paint-order', 'stroke')
            .style('stroke', 'rgba(0,0,0,0.5)')
            .style('stroke-width', '0.3px')
            .text(d => {
                const name = d.properties.ST_NM;
                // Abbreviate long names
                const abbr = {
                    'Arunachal Pradesh': 'AR', 'Andaman & Nicobar': 'A&N',
                    'Dadra and Nagar Haveli and Daman and Diu': 'DNHDD',
                    'Jammu & Kashmir': 'J&K', 'Himachal Pradesh': 'HP',
                    'Madhya Pradesh': 'MP', 'Uttar Pradesh': 'UP',
                    'Andhra Pradesh': 'AP', 'West Bengal': 'WB',
                };
                return abbr[name] || name.split(' ').map(w => w[0]).join('').slice(0, 3);
            });

        // Legend
        const legend = svg.append('g').attr('transform', `translate(${width - 160}, ${height - 70})`);
        legend.append('rect')
            .attr('width', 150).attr('height', 60)
            .attr('rx', 6)
            .style('fill', 'rgba(15,23,42,0.85)')
            .style('stroke', '#334155');
        [
            { color: 'rgba(255,153,51,0.35)', label: 'Data Available' },
            { color: '#1e293b', label: 'Coming Soon' },
        ].forEach((item, i) => {
            legend.append('rect')
                .attr('x', 10).attr('y', 12 + i * 22)
                .attr('width', 14).attr('height', 14).attr('rx', 3)
                .style('fill', item.color).style('stroke', '#475569');
            legend.append('text')
                .attr('x', 30).attr('y', 23 + i * 22)
                .style('fill', '#cbd5e1').style('font-size', '0.7rem')
                .text(item.label);
        });
    }

    function showComingSoon(stateName) {
        const banner = document.getElementById('india-coming-soon');
        if (!banner) return;
        banner.textContent = `${stateName} — data coming soon`;
        banner.style.opacity = '1';
        setTimeout(() => { banner.style.opacity = '0'; }, 2500);
    }

    // ── Init ────────────────────────────────────────────────────────
    window._initIndiaMap = async function () {
        const container = document.getElementById('india-map-svg');
        if (!container) return;
        if (container.querySelector('svg')) return; // already rendered

        try {
            const res = await fetch('/api/up/geo/india');
            if (!res.ok) throw new Error(`Server ${res.status}`);
            const geo = await res.json();
            if (geo.error) throw new Error(geo.error);
            renderIndiaMap(geo);
        } catch (e) {
            console.error('[INDIA MAP] Failed:', e.message);
            const container = document.getElementById('india-map-svg');
            if (container) container.innerHTML = `
                <div style="text-align:center;padding:3rem;color:var(--text-muted);">
                    <p style="color:#ef4444;">⚠️ Could not load India map</p>
                    <p style="font-size:0.85rem;">${e.message}</p>
                    <button onclick="window._initIndiaMap()" style="margin-top:1rem;background:var(--primary);color:#000;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;">Retry</button>
                </div>`;
        }
    };

})();
