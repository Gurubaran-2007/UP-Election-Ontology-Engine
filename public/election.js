// ============================================================
// NATIONAL ELECTION WATCH — Myneta.info embedded via proxy
// ============================================================

(function () {

    // ── 1. Inject nav link below UP Social Media ───────────────────
    function injectNavLink() {
        if (document.querySelector('[data-target="election-watch-tab"]')) return;
        const socLink = [...document.querySelectorAll('.tab-link')]
            .find(l => l.dataset.target === 'up-social-tab');
        const aiLink  = [...document.querySelectorAll('.tab-link')]
            .find(l => l.dataset.target === 'ai-search-tab');
        const anchor  = socLink || aiLink;
        if (anchor) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-target="election-watch-tab" class="tab-link">National Election Watch</a>`;
            anchor.closest('li').insertAdjacentElement('afterend', li);
        }
    }

    // ── 2. Inject tab section ──────────────────────────────────────
    function injectTabSection() {
        if (document.getElementById('election-watch-tab')) return;
        const section = document.createElement('section');
        section.id = 'election-watch-tab';
        section.className = 'tab-content fade-in';
        section.style.display = 'none';
        section.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden;height:calc(100vh - 80px);display:flex;flex-direction:column;">

            <!-- Header bar -->
            <div style="padding:.8rem 1.5rem;background:linear-gradient(135deg,rgba(255,153,51,.12),rgba(59,130,246,.08));border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                <div>
                    <h2 style="margin:0;font-size:1.4rem;">🗳️ National Election Watch</h2>
                    <p style="margin:0;color:#94a3b8;font-size:.78rem;">Powered by Myneta.info — Candidate & election data for India</p>
                </div>
                <div style="display:flex;gap:.6rem;align-items:center;">
                    <button onclick="document.getElementById('myneta-iframe').src='/proxy/myneta'"
                        style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#e2e8f0;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:.78rem;transition:background .2s;"
                        onmouseover="this.style.background='rgba(255,255,255,.14)'" onmouseout="this.style.background='rgba(255,255,255,.07)'">
                        🔄 Reload
                    </button>
                    <button onclick="window.open('https://myneta.info','_blank')"
                        style="background:rgba(255,153,51,.12);border:1px solid rgba(255,153,51,.35);color:#FF9933;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600;transition:background .2s;"
                        onmouseover="this.style.background='rgba(255,153,51,.25)'" onmouseout="this.style.background='rgba(255,153,51,.12)'">
                        ↗ Open Full Site
                    </button>
                </div>
            </div>

            <!-- Iframe loader overlay -->
            <div id="myneta-loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:10;pointer-events:none;">
                <div class="loading-spinner"></div>
                <p style="color:#94a3b8;margin-top:1rem;font-size:.9rem;">Loading Myneta.info...</p>
            </div>

            <!-- Embedded Myneta site via proxy -->
            <iframe
                id="myneta-iframe"
                src="/proxy/myneta"
                style="flex:1;width:100%;border:none;background:#fff;"
                onload="document.getElementById('myneta-loader').style.display='none';"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                title="National Election Watch — Myneta.info">
            </iframe>
        </div>`;

        document.querySelector('.content-area').appendChild(section);
    }

    // ── 3. Init on DOM ready ───────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        injectNavLink();
        injectTabSection();
    });

})();
