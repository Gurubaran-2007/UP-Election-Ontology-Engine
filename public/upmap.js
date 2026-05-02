// ============================================================
// UP DISTRICT MAP MODULE
// ============================================================

(function () {

    // ── 9. Init on DOM ready ───────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // Functions now rely on static HTML in index.html
    });

    // ── 3. Close panel ─────────────────────────────────────────────
    window._upMapClosePanel = function () {
        document.getElementById('up-district-panel').style.width = '0';
        document.getElementById('up-map-selected-label').textContent = 'No district selected';
        if (window._upLastSelected) {
            window._upLastSelected.style('fill', '');
        }
    };

    // ── 4. Regional Classification Logic ───────────────────────────
    const REGIONS = {
        'Western U.P.': {
            color: '#fef9c3', // Gold/Yellow
            districts: ['Saharanpur', 'Muzaffarnagar', 'Shamli', 'Baghpat', 'Meerut', 'Ghaziabad', 'Hapur', 'Gautam Buddha Nagar', 'Bulandshahr', 'Aligarh', 'Hathras', 'Mathura', 'Agra', 'Firozabad', 'Etah', 'Kasganj', 'Mainpuri', 'Etawah', 'Auraiya', 'Kannauj', 'Farrukhabad']
        },
        'Rohilkhand': {
            color: '#60a5fa', // Blue
            districts: ['Bijnor', 'Jyotiba Phule Nagar', 'Amroha', 'Moradabad', 'Rampur', 'Sambhal', 'Budaun', 'Bareilly', 'Pilibhit', 'Shahjahanpur']
        },
        'Awadh': {
            color: '#d8b4fe', // Purple
            districts: ['Kheri', 'Sitapur', 'Hardoi', 'Unnao', 'Lucknow', 'Rae Bareli', 'Barabanki', 'Faizabad', 'Ayodhya', 'Amethi', 'Sultanpur', 'Ambedkar Nagar', 'Gonda', 'Bahraich', 'Shravasti', 'Balrampur', 'Fatehpur']
        },
        'Bundelkhand': {
            color: '#fca5a5', // Red/Pink
            districts: ['Jalaun', 'Jhansi', 'Lalitpur', 'Hamirpur', 'Mahoba', 'Banda', 'Chitrakoot']
        },
        'Purvanchal': {
            color: '#86efac', // Green
            districts: ['Siddharthnagar', 'Maharajganj', 'Kushinagar', 'Basti', 'Sant Kabir Nagar', 'Gorakhpur', 'Deoria', 'Azamgarh', 'Mau', 'Ballia', 'Jaunpur', 'Ghazipur', 'Varanasi', 'Sant Ravidas Nagar', 'Mirzapur', 'Chandauli', 'Sonbhadra', 'Allahabad', 'Prayagraj', 'Kaushambi', 'Pratapgarh']
        }
    };

    function getDistrictRegion(name) {
        const n = name.trim();
        for (const [region, data] of Object.entries(REGIONS)) {
            if (data.districts.some(d => n.includes(d) || d.includes(n))) return { region, color: data.color };
        }
        return { region: 'Other', color: '#cbd5e1' };
    }

    // ── 5. Render D3 Map ────────────────────────────────────────────
    function renderUPMap(geojson) {
        const container = document.getElementById('up-district-map');
        if (!container) return;
        container.innerHTML = '';

        const width  = container.clientWidth  || 800;
        const height = container.clientHeight || 700;

        const svg = d3.select('#up-district-map')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`);

        const mapGroup = svg.append('g');

        const projection = d3.geoIdentity()
            .reflectY(true)
            .fitSize([width, height], geojson);

        const pathGenerator = d3.geoPath().projection(projection);

        // Region Label Coordinates (Heuristic for UP)
        const regionLabels = [
            { text: 'Western U.P.', x: width * 0.15, y: height * 0.55 },
            { text: 'Rohilkhand', x: width * 0.40, y: height * 0.10 },
            { text: 'Awadh', x: width * 0.60, y: height * 0.30 },
            { text: 'Bundelkhand', x: width * 0.35, y: height * 0.82 },
            { text: 'Purvanchal', x: width * 0.85, y: height * 0.78 }
        ];

        mapGroup.selectAll('path')
            .data(geojson.features)
            .enter()
            .append('path')
            .attr('d', pathGenerator)
            .attr('class', 'district-path')
            .style('fill', d => getDistrictRegion(d.properties.NAME_2 || d.properties.name).color)
            .style('stroke', '#475569')
            .style('stroke-width', '0.5px')
            .style('cursor', 'pointer')
            .style('transition', 'all 0.2s ease')
            .on('mouseover', function (event, d) {
                d3.select(this)
                    .style('stroke-width', '1.5px')
                    .style('stroke', '#000')
                    .raise();
            })
            .on('mouseout', function (event, d) {
                const isSelected = window._upLastSelected && window._upLastSelected.node() === this;
                d3.select(this)
                    .style('stroke-width', isSelected ? '2px' : '0.5px')
                    .style('stroke', isSelected ? 'var(--primary)' : '#475569');
            })
            .on('click', function (event, d) {
                if (window._upLastSelected) {
                    window._upLastSelected.style('stroke-width', '0.5px').style('stroke', '#475569');
                }
                window._upLastSelected = d3.select(this);
                d3.select(this).style('stroke-width', '2px').style('stroke', 'var(--primary)');

                const name = d.properties.NAME_2 || d.properties.name || 'Unknown';
                openDistrictPanel(name);
            });

        // Add Regional Text Labels (Large)
        mapGroup.selectAll('.region-label')
            .data(regionLabels)
            .enter()
            .append('text')
            .attr('class', 'region-label')
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('text-anchor', 'middle')
            .style('font-size', '1.8rem')
            .style('font-weight', '900')
            .style('fill', 'rgba(0,0,0,0.7)')
            .style('font-family', 'Outfit, sans-serif')
            .style('pointer-events', 'none')
            .text(d => d.text);

        // Add Small District Labels
        mapGroup.selectAll('.district-label')
            .data(geojson.features)
            .enter()
            .append('text')
            .attr('class', 'district-label')
            .attr('x', d => pathGenerator.centroid(d)[0] || 0)
            .attr('y', d => pathGenerator.centroid(d)[1] || 0)
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('pointer-events', 'none')
            .style('font-size', '0.45rem')
            .style('font-weight', '600')
            .style('fill', '#000')
            .style('opacity', '0.8')
            .text(d => d.properties.NAME_2 || d.properties.name || '');
    }

    // ── 5. Open District Panel ─────────────────────────────────────
    function openDistrictPanel(districtName) {
        document.getElementById('up-map-selected-label').textContent = districtName;
        document.getElementById('up-dist-name').textContent = districtName;
        document.getElementById('up-dist-loader').style.display = 'block';
        document.getElementById('up-dist-content').style.display = 'none';
        document.getElementById('up-district-panel').style.width = '420px';
        fetchDistrictData(districtName);
    }

    // ── 6. Fetch district data from server ──────────────────────────
    async function fetchDistrictData(name) {
        try {
            const res = await fetch(`/api/up/district/${encodeURIComponent(name)}`);
            const data = await res.json();
            renderDistrictPanel(data);
        } catch (e) {
            document.getElementById('up-dist-content').innerHTML = `<p style="color:var(--negative)">Failed to load district data. Please retry.</p>`;
            document.getElementById('up-dist-loader').style.display = 'none';
            document.getElementById('up-dist-content').style.display = 'block';
        }
    }

    // ── 7. Render panel data ────────────────────────────────────────
    function renderDistrictPanel(d) {
        const leader  = d.leader   || {};
        const pop     = d.population || {};
        const demo    = d.demographics || [];
        const news    = d.headlines   || [];
        const census  = d.census      || {};

        // ── stat box helper ───────────────────────────────────────────────
        const statBox = (value, label, color) => `
            <div style="background:rgba(15,15,25,0.85);border:1.5px solid ${color}40;border-radius:10px;padding:.9rem .7rem;text-align:center;backdrop-filter:blur(4px);">
                <div style="font-size:1.2rem;font-weight:800;color:${color};letter-spacing:.3px;">${value || '<span style="color:#6b7280;font-size:1rem;">—</span>'}</div>
                <div style="font-size:.75rem;color:#cbd5e1;margin-top:.35rem;font-weight:600;letter-spacing:.4px;text-transform:uppercase;">${label}</div>
            </div>`;

        // ── Population section ───────────────────────────────────
        const totalPop = pop.total || ((pop.rural || 0) + (pop.urban || 0)) || ((census.ruralPopulation || 0) + (census.urbanPopulation || 0));
        const hasPop   = totalPop > 0;
        const fmt = (v) => (v && Number(v) > 0) ? Number(v).toLocaleString('en-IN') : null;

        const popSection = hasPop ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
                ${statBox(fmt(totalPop), 'Total Population', '#4ade80')}
                ${statBox(pop.density ? pop.density + '/km²' : null, 'Population Density', '#60a5fa')}
                ${statBox(pop.literacy ? pop.literacy + '%' : null, 'Literacy Rate', '#FF9933')}
                ${statBox(pop.sex_ratio || null, 'Sex Ratio (per 1000 males)', '#c084fc')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.6rem;">
                ${statBox(fmt(pop.rural || census.ruralPopulation), 'Rural Population', '#22c55e')}
                ${statBox(fmt(pop.urban || census.urbanPopulation), 'Urban Population', '#8b5cf6')}
                ${statBox(fmt(pop.male), 'Male', '#60a5fa')}
                ${statBox(fmt(pop.female), 'Female', '#f472b6')}
            </div>
            ${census.hinduPopulation ? `
            <div style="margin-top:.9rem;background:rgba(15,15,25,0.7);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:.8rem;">
                <div style="font-size:.8rem;color:#f1f5f9;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:.5rem;">Religion Breakdown</div>
                <div style="display:flex;flex-wrap:wrap;gap:.45rem;">
                    <span style="background:#f97316;color:#fff;font-weight:700;font-size:.78rem;border-radius:8px;padding:4px 11px;">Hindu: ${Number(census.hinduPopulation).toLocaleString('en-IN')}</span>
                    <span style="background:#3b82f6;color:#fff;font-weight:700;font-size:.78rem;border-radius:8px;padding:4px 11px;">Muslim: ${Number(census.muslimPopulation || 0).toLocaleString('en-IN')}</span>
                    ${(census.sikhPopulation > 0) ? `<span style="background:#eab308;color:#000;font-weight:700;font-size:.78rem;border-radius:8px;padding:4px 11px;">Sikh: ${Number(census.sikhPopulation).toLocaleString('en-IN')}</span>` : ''}
                    ${(census.christianPopulation > 0) ? `<span style="background:#22c55e;color:#000;font-weight:700;font-size:.78rem;border-radius:8px;padding:4px 11px;">Christian: ${Number(census.christianPopulation).toLocaleString('en-IN')}</span>` : ''}
                </div>
            </div>` : ''}
            ${census.marriedPopulation ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.6rem;">
                ${statBox(fmt(census.marriedPopulation), 'Currently Married', '#ec4899')}
                ${statBox(fmt(census.migrantPopulation), 'Migrants', '#06b6d4')}
            </div>` : ''}
            <div style="font-size:.75rem;color:#4ade80;font-weight:700;margin-top:.6rem;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:5px 10px;display:inline-block;">✅ Source: Census 2011 DB + AI</div>
        ` : `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:1rem;text-align:center;">
                <div class="loading-spinner" style="margin:0 auto 0.5rem;"></div>
                <p style="color:#94a3b8;font-size:.85rem;margin:0;">Fetching from AI — please wait...</p>
             </div>`;

        // ── Demographics bars ────────────────────────────────────
        const maxVal  = Math.max(...demo.map(x => x.percent || 0), 1);
        const demoBars = demo.length > 0
            ? demo.map(g => `
            <div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.35rem;">
                    <span style="color:#f1f5f9;font-weight:600;">${g.label}</span>
                    <span style="color:#fff;font-weight:800;font-size:.88rem;">${g.percent}%</span>
                </div>
                <div style="height:10px;background:rgba(255,255,255,0.12);border-radius:6px;overflow:hidden;">
                    <div style="height:100%;width:${(g.percent / maxVal) * 100}%;background:${g.color || '#FF9933'};border-radius:6px;transition:width .6s ease;"></div>
                </div>
                <div style="font-size:.75rem;color:#94a3b8;margin-top:.2rem;font-weight:500;">${g.count ? '~' + Number(g.count).toLocaleString('en-IN') + ' people' : ''}</div>
            </div>`).join('')
            : `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:1rem;text-align:center;">
                <div class="loading-spinner" style="margin:0 auto 0.5rem;"></div>
                <p style="color:#94a3b8;font-size:.85rem;margin:0;">Loading breakdown from AI...</p>
               </div>`;

        // ── News items ───────────────────────────────────────────
        const newsItems = news.length > 0
            ? news.map((h, i) => `
                <div style="display:flex;gap:.6rem;margin-bottom:.9rem;align-items:flex-start;">
                    <span style="background:#FF9933;color:#000;font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0;margin-top:2px;">${i + 1}</span>
                    <p style="margin:0;font-size:.83rem;color:#e2e8f0;line-height:1.55;">${h}</p>
                </div>`).join('')
            : `<p style="color:#94a3b8;font-size:.85rem;">No recent news found for this district.</p>`;

        // ── Build full panel HTML ────────────────────────────────
        document.getElementById('up-dist-content').innerHTML = `

            <!-- Political Leadership -->
            <div class="up-dist-section">
                <div class="up-dist-section-title">🏛️ Political Leadership</div>
                <div style="background:rgba(10,10,20,0.85);border:1.5px solid rgba(255,153,51,0.35);border-radius:12px;padding:1.1rem;">
                    <div style="font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:.45rem;line-height:1.4;">
                        ${leader.name && !leader.name.includes('Representative')
                            ? leader.name
                            : '<span style="color:#94a3b8;font-style:italic;font-size:.95rem;">Being fetched from AI...</span>'}
                    </div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;">
                        <span style="background:#FF9933;color:#000;font-weight:800;border-radius:10px;padding:3px 12px;font-size:.78rem;">${leader.designation || 'MLA'}</span>
                        <span style="background:#166534;color:#bbf7d0;font-weight:700;border-radius:10px;padding:3px 12px;font-size:.78rem;">${leader.party || 'N/A'}</span>
                        ${leader.since ? `<span style="background:#1e3a5f;color:#93c5fd;font-weight:700;border-radius:10px;padding:3px 12px;font-size:.78rem;">Since ${leader.since}</span>` : ''}
                    </div>
                    ${leader.note && !leader.note.includes('database') && !leader.note.includes('available') ? `<div style="font-size:.82rem;color:#e2e8f0;border-top:1px solid rgba(255,255,255,0.12);padding-top:.55rem;margin-top:.35rem;line-height:1.6;">${leader.note}</div>` : ''}
                    <div style="font-size:.72rem;color:#64748b;margin-top:.45rem;font-weight:500;">Source: ${d.source || 'AI Analysis'}</div>
                </div>
            </div>

            <!-- Population Overview -->
            <div class="up-dist-section">
                <div class="up-dist-section-title">👥 Population Overview</div>
                ${popSection}
            </div>

            <!-- Demographics -->
            <div class="up-dist-section">
                <div class="up-dist-section-title">📊 Demographics</div>
                ${demoBars}
                ${demo.length > 0 ? `<div style="font-size:.7rem;color:#64748b;margin-top:.5rem;font-style:italic;">Source: ${d.source || 'Census 2011 + AI'}</div>` : ''}
            </div>

            <!-- Top Headlines -->
            <div class="up-dist-section">
                <div class="up-dist-section-title">📰 Top 5 Latest Headlines</div>
                ${newsItems}
                ${news.length > 0 ? `<div style="font-size:.7rem;color:#64748b;margin-top:.3rem;">Source: Google News RSS (Real-time)</div>` : ''}
            </div>
        `;

        document.getElementById('up-dist-loader').style.display = 'none';
        document.getElementById('up-dist-content').style.display = 'block';
    }

    // ── 8. Expose initUPMap globally for script.js to call ─────────
    window._initUPMap = async function () {
        const mapDiv = document.getElementById('up-district-map');
        if (!mapDiv) return;
        if (mapDiv.querySelector('svg')) return;

        const loader = document.getElementById('up-map-loader');
        if (loader) loader.innerHTML = `
            <div class="loading-spinner"></div>
            <p style="color:var(--text-muted);margin-top:1rem;">Fetching UP district boundaries...</p>
        `;

        try {
            const res = await fetch('/api/up/geo');
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            const geo = await res.json();
            if (geo.error) throw new Error(geo.error);
            if (!geo.features || geo.features.length === 0) throw new Error('No district data');
            renderUPMap(geo);
        } catch (e) {
            console.error('[UP MAP] Failed to load GeoJSON:', e.message);
            if (loader) loader.innerHTML = `
                <div style="text-align:center;padding:2rem;">
                    <p style="color:var(--negative);font-size:1rem;margin-bottom:1rem;">⚠️ Could not load map data</p>
                    <p style="color:var(--text-muted);font-size:.85rem;">${e.message}</p>
                    <button onclick="window._initUPMap()" style="margin-top:1rem;background:var(--primary);color:#000;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;">Retry</button>
                </div>`;
        }
    };

    // ── 9. Init nav + tab on DOM ready ───────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        injectNavLink();
        injectTabSection();
    });

})();
