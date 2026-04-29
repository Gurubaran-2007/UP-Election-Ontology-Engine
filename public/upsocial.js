// ============================================================
// UP SOCIAL MEDIA MODULE
// ============================================================

(function () {

    const NEWS_API_KEY = 'pub_55a94899cf9a4c72b211d2348be9e955';
    // Use exact phrase "uttar pradesh" + category filter to ensure UP-only news
    const NEWS_API_URL = `https://newsdata.io/api/1/news?apikey=${NEWS_API_KEY}&q=%22uttar+pradesh%22&country=in&language=en,hi&size=10`;

    // Indian news channels with YouTube @handles for dynamic live stream resolution
    const TV_CHANNELS = [
        { code: 'IN', name: 'Aaj Tak',         desc: 'Hindi · #1 live news India',          handle: 'aajtak',          color: '#e63946' },
        { code: 'IN', name: 'NDTV India',       desc: 'Hindi · National · UP coverage',      handle: 'NDTVIndia',       color: '#457b9d' },
        { code: 'IN', name: 'ABP News',         desc: 'Hindi · Politics · Ground reports',   handle: 'abpnewsabhitak',  color: '#2a9d8f' },
        { code: 'IN', name: 'Zee News',         desc: 'Hindi · Breaking · UP focus',         handle: 'zeenews',         color: '#6a0572' },
        { code: 'IN', name: 'India TV',         desc: 'Hindi · Live breaking news',          handle: 'IndiaTV',         color: '#f4a261' },
        { code: 'IN', name: 'TV9 Bharatvarsh',  desc: 'Hindi · UP & Bihar · Ground news',    handle: 'tv9bharatvarsh',  color: '#e9c46a' },
        { code: 'IN', name: 'News18 India',     desc: 'Hindi/English · National coverage',   handle: 'News18India',     color: '#264653' },
        { code: 'IN', name: 'Republic Bharat',  desc: 'Hindi · Debates · Investigative',     handle: 'RepublicBharat',  color: '#8338ec' },
        { code: 'IN', name: 'NDTV 24x7',        desc: 'English · India · International',     handle: 'ndtv',            color: '#3a86ff' },
        { code: 'IN', name: 'DD News',          desc: 'Hindi/English · Official Govt news',  handle: 'DDNewsofficial',  color: '#fb5607' },
    ];

    // ── 1. Inject Nav Link ──────────────────────────────────────────
    function injectNavLink() {
        if (document.querySelector('[data-target="up-social-tab"]')) return;
        const aiLink = [...document.querySelectorAll('.tab-link')]
            .find(l => l.dataset.target === 'ai-search-tab');
        if (aiLink) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-target="up-social-tab" class="tab-link">UP Social Media</a>`;
            aiLink.closest('li').insertAdjacentElement('afterend', li);
        }
    }

    // ── 2. Inject Tab Section ───────────────────────────────────────
    function injectTabSection() {
        if (document.getElementById('up-social-tab')) return;
        const section = document.createElement('section');
        section.id = 'up-social-tab';
        section.className = 'tab-content fade-in';
        section.style.display = 'none';
        section.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden;">

            <!-- Header -->
            <div style="padding:1.5rem 2rem;background:linear-gradient(135deg,rgba(255,153,51,.12),rgba(59,130,246,.08));border-bottom:1px solid var(--border);">
                <h2 style="margin:0;font-size:1.8rem;">📱 UP Social Media</h2>
                <p style="margin:.3rem 0 0;color:#94a3b8;font-size:.9rem;">Real-time Uttar Pradesh news and live TV channels</p>
            </div>

            <!-- Sub-tab bar -->
            <div style="display:flex;justify-content:center;gap:0;padding:1.2rem;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border);">
                <button id="soc-tab-news" class="soc-subtab active-subtab" onclick="window._socSwitchTab('news')">📰 UP News</button>
                <button id="soc-tab-tv"   class="soc-subtab"              onclick="window._socSwitchTab('tv')">📺 UP Live News TV</button>
            </div>

            <!-- UP News Panel -->
            <div id="soc-news-panel" style="padding:1.5rem 2rem;min-height:60vh;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;">
                    <span style="font-size:.8rem;color:#94a3b8;">Powered by Newsdata.io · Auto-refreshes every 5 min · UP-specific news only</span>
                    <span id="soc-news-timer" style="font-size:.78rem;color:#60a5fa;"></span>
                </div>
                <div id="soc-news-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.2rem;">
                    <div style="grid-column:1/-1;text-align:center;padding:3rem 0;">
                        <div class="loading-spinner"></div>
                        <p style="color:#94a3b8;margin-top:1rem;">Fetching latest UP news...</p>
                    </div>
                </div>
            </div>

            <!-- UP Live TV Panel -->
            <div id="soc-tv-panel" style="display:none;padding:1.5rem 2rem;min-height:60vh;">

                <!-- Live Player -->
                <div id="soc-tv-player-wrap" style="display:none;margin-bottom:1.8rem;border-radius:12px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:rgba(0,0,0,0.7);border-bottom:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex;align-items:center;gap:.6rem;">
                            <span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;animation:pulse-dot 1.2s infinite;"></span>
                            <span id="soc-tv-playing-name" style="font-weight:700;color:#FF9933;font-size:.95rem;"></span>
                        </div>
                        <button onclick="window._socClosePlayer()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:4px 14px;border-radius:6px;cursor:pointer;font-size:.8rem;transition:background .2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕ Close</button>
                    </div>
                    <div style="position:relative;padding-bottom:56.25%;height:0;">
                        <iframe id="soc-tv-iframe"
                            style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen referrerpolicy="strict-origin-when-cross-origin">
                        </iframe>
                    </div>
                </div>

                <p style="color:#94a3b8;font-size:.82rem;margin-bottom:1rem;">Click any channel to watch its live stream. Stream is fetched fresh from YouTube each time.</p>

                <!-- Channel Grid -->
                <div id="soc-tv-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem;"></div>
            </div>

        </div>`;
        document.querySelector('.content-area').appendChild(section);
        buildTVGrid();
    }

    // ── 3. Sub-tab switching ────────────────────────────────────────
    window._socSwitchTab = function (tab) {
        document.getElementById('soc-news-panel').style.display = tab === 'news' ? 'block' : 'none';
        document.getElementById('soc-tv-panel').style.display   = tab === 'tv'   ? 'block' : 'none';
        document.getElementById('soc-tab-news').classList.toggle('active-subtab', tab === 'news');
        document.getElementById('soc-tab-tv').classList.toggle('active-subtab',   tab === 'tv');
    };

    // ── 4. Fetch UP News ───────────────────────────────────────────
    async function fetchUPNews() {
        const grid = document.getElementById('soc-news-grid');
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 0;"><div class="loading-spinner"></div><p style="color:#94a3b8;margin-top:1rem;">Fetching UP news...</p></div>`;

        try {
            const res  = await fetch(NEWS_API_URL);
            const data = await res.json();

            if (data.status !== 'success' || !data.results || data.results.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#94a3b8;">No UP news found at the moment. Try again shortly.</div>`;
                return;
            }

            grid.innerHTML = data.results.map((item) => {
                const ago  = timeAgo(item.pubDate);
                const img  = item.image_url
                    ? `<img src="${item.image_url}" alt="" style="width:100%;height:155px;object-fit:cover;border-radius:8px 8px 0 0;" onerror="this.style.display='none'">`
                    : `<div style="width:100%;height:5px;background:linear-gradient(90deg,#FF9933,#138808,#000080);border-radius:8px 8px 0 0;"></div>`;
                const desc = (item.description || '').replace(/<[^>]*>/g, '').slice(0, 110);

                return `
                <div class="soc-news-card" onclick="window.open('${item.link}','_blank')">
                    ${img}
                    <div style="padding:.9rem;flex:1;display:flex;flex-direction:column;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.45rem;">
                            <span style="font-size:.68rem;color:#FF9933;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">${item.source_id || 'News'}</span>
                            <span style="font-size:.68rem;color:#64748b;">${ago}</span>
                        </div>
                        <h4 style="margin:0 0 .4rem;font-size:.88rem;color:#f1f5f9;line-height:1.45;font-weight:600;">${item.title}</h4>
                        ${desc ? `<p style="margin:0;font-size:.77rem;color:#94a3b8;line-height:1.5;flex:1;">${desc}${desc.length >= 110 ? '...' : ''}</p>` : ''}
                        <div style="margin-top:.7rem;text-align:right;">
                            <span style="font-size:.72rem;color:#3b82f6;font-weight:600;">Read More →</span>
                        </div>
                    </div>
                </div>`;
            }).join('');

            const timer = document.getElementById('soc-news-timer');
            if (timer) timer.textContent = `Updated: ${new Date().toLocaleTimeString('en-IN')}`;

        } catch (err) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#ef4444;">Failed to fetch news: ${err.message}<br><button onclick="fetchUPNews()" style="margin-top:1rem;background:#FF9933;color:#000;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-weight:600;">Retry</button></div>`;
        }
    }

    // ── 5. Time ago helper ─────────────────────────────────────────
    function timeAgo(dateStr) {
        if (!dateStr) return '';
        try {
            const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
            if (diff < 1)    return 'Just now';
            if (diff < 60)   return `${diff}m ago`;
            if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
            return `${Math.floor(diff/1440)}d ago`;
        } catch { return ''; }
    }

    // ── 6. Build TV Channel Grid ────────────────────────────────────
    function buildTVGrid() {
        const grid = document.getElementById('soc-tv-grid');
        if (!grid) return;
        grid.innerHTML = TV_CHANNELS.map((ch, i) => `
            <div class="soc-tv-card" id="soc-tv-card-${i}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.6rem;">
                    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                        <span style="font-size:.62rem;font-weight:700;color:#94a3b8;background:rgba(255,255,255,.07);padding:2px 7px;border-radius:4px;">${ch.code}</span>
                        <span style="font-size:.9rem;font-weight:700;color:#f1f5f9;">${ch.name}</span>
                    </div>
                    <span style="font-size:.6rem;color:#ef4444;font-weight:700;display:flex;align-items:center;gap:3px;white-space:nowrap;margin-top:2px;">
                        <span style="width:6px;height:6px;background:#ef4444;border-radius:50%;display:inline-block;animation:pulse-dot 1.2s infinite;"></span>LIVE
                    </span>
                </div>
                <div style="width:100%;height:3px;border-radius:2px;background:${ch.color};margin-bottom:.65rem;opacity:.75;"></div>
                <p style="margin:0 0 .9rem;font-size:.77rem;color:#94a3b8;line-height:1.4;">${ch.desc}</p>
                <button id="soc-watch-btn-${i}"
                    onclick="window._socWatchChannel(${i})"
                    style="width:100%;padding:.5rem;background:rgba(255,153,51,.12);border:1px solid rgba(255,153,51,.35);color:#FF9933;border-radius:6px;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.4rem;transition:background .2s;"
                    onmouseover="this.style.background='rgba(255,153,51,.28)'" onmouseout="this.style.background='rgba(255,153,51,.12)'">
                    ▶ WATCH
                </button>
            </div>`).join('');
    }

    // ── 7. Watch a channel — fetch live video ID from server ────────
    window._socWatchChannel = async function (i) {
        const ch  = TV_CHANNELS[i];
        const btn = document.getElementById(`soc-watch-btn-${i}`);

        // Show loading state on button
        if (btn) { btn.textContent = '⏳ Loading...'; btn.disabled = true; }

        try {
            const res  = await fetch(`/api/up/channel-live/${encodeURIComponent(ch.handle)}`);
            const data = await res.json();

            if (btn) { btn.innerHTML = '▶ WATCH'; btn.disabled = false; }

            if (data.videoId) {
                // Embed the live stream
                const wrap   = document.getElementById('soc-tv-player-wrap');
                const iframe = document.getElementById('soc-tv-iframe');
                const nameEl = document.getElementById('soc-tv-playing-name');

                nameEl.textContent = `LIVE — ${ch.name}`;
                iframe.src = data.embedUrl;
                wrap.style.display = 'block';
                wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

            } else {
                // Channel is not live right now — show "Open on YouTube" option
                showNotLiveMessage(ch, data.channelUrl, i);
            }

        } catch (e) {
            if (btn) { btn.innerHTML = '▶ WATCH'; btn.disabled = false; }
            showNotLiveMessage(ch, `https://www.youtube.com/@${ch.handle}/live`, i);
        }
    };

    function showNotLiveMessage(ch, channelUrl, i) {
        const card = document.getElementById(`soc-tv-card-${i}`);
        if (!card) return;
        // Show toast-like message inside card
        const msg = document.createElement('div');
        msg.style.cssText = 'margin-top:.6rem;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:.6rem;font-size:.75rem;color:#fca5a5;text-align:center;';
        msg.innerHTML = `Not live right now. <a href="${channelUrl}" target="_blank" style="color:#FF9933;font-weight:700;text-decoration:none;">Open on YouTube →</a>`;
        // Remove existing message if any
        const existing = card.querySelector('.not-live-msg');
        if (existing) existing.remove();
        msg.className = 'not-live-msg';
        card.appendChild(msg);
        setTimeout(() => msg.remove(), 8000);
    }

    // ── 8. Close player ─────────────────────────────────────────────
    window._socClosePlayer = function () {
        document.getElementById('soc-tv-iframe').src = '';
        document.getElementById('soc-tv-player-wrap').style.display = 'none';
    };

    // ── 9. Hook into tab switch ─────────────────────────────────────
    let _newsLoaded = false;
    document.addEventListener('click', e => {
        if (e.target.closest('[data-target="up-social-tab"]') && !_newsLoaded) {
            _newsLoaded = true;
            fetchUPNews();
            setInterval(fetchUPNews, 5 * 60 * 1000); // auto-refresh every 5 min
        }
    });

    // ── 10. Init on DOM ready ───────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        injectNavLink();
        injectTabSection();
    });

})();
