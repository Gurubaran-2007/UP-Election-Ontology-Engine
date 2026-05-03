const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const zlib = require('zlib');

// ── Helper: fetch a URL using Node https/http (reliable, SSL-tolerant) ──────
function httpsGet(urlStr, acceptHeader) {
    return new Promise((resolve, reject) => {
        const maxRedirects = 8;
        let redirectCount = 0;

        function doRequest(currentUrl) {
            const parsed = new URL(currentUrl);
            const isHttps = parsed.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (isHttps ? 443 : 80),
                path: parsed.pathname + (parsed.search || ''),
                method: 'GET',
                rejectUnauthorized: false,   // bypass SSL cert issues
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': acceptHeader || 'text/html,application/xhtml+xml,*/*;q=0.8',
                    'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
                    'Accept-Encoding': 'gzip, deflate',
                    'Referer': 'https://myneta.info',
                    'Connection': 'keep-alive'
                }
            };

            const reqObj = lib.request(options, (upstream) => {
                // Follow redirects
                if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
                    if (redirectCount++ >= maxRedirects) return reject(new Error('Too many redirects'));
                    const next = upstream.headers.location.startsWith('http')
                        ? upstream.headers.location
                        : `${parsed.protocol}//${parsed.hostname}${upstream.headers.location}`;
                    upstream.resume(); // drain
                    return doRequest(next);
                }

                const contentType = upstream.headers['content-type'] || 'text/html';
                const encoding = upstream.headers['content-encoding'] || '';
                const chunks = [];

                upstream.on('data', c => chunks.push(c));
                upstream.on('error', reject);
                upstream.on('end', () => {
                    const raw = Buffer.concat(chunks);

                    // Decompress if needed
                    const decompress = encoding === 'gzip'
                        ? cb => zlib.gunzip(raw, cb)
                        : encoding === 'deflate'
                        ? cb => zlib.inflate(raw, cb)
                        : null;

                    if (decompress) {
                        decompress((err, decoded) => {
                            if (err) return reject(err);
                            resolve({ contentType, data: decoded, binary: isBinaryType(contentType) });
                        });
                    } else {
                        resolve({ contentType, data: raw, binary: isBinaryType(contentType) });
                    }
                });
            });

            reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('Request timed out')); });
            reqObj.on('error', reject);
            reqObj.end();
        }

        doRequest(urlStr);
    });
}

function isBinaryType(ct) {
    return !ct.includes('text/') && !ct.includes('javascript') && !ct.includes('json') && !ct.includes('xml');
}

// ============================================================
// Myneta.info Web Proxy — Full asset rewrite + ad removal
// ============================================================
const MYNETA_BASE = 'https://myneta.info';

router.get('/', async (req, res) => { await proxyMyneta('/', req, res); });

router.get('/*', async (req, res) => {
    const subPath = '/' + req.params[0];
    const query   = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
    await proxyMyneta(subPath + query, req, res);
});

async function proxyMyneta(urlPath, req, res) {
    const targetUrl = MYNETA_BASE + urlPath;
    const serverBase = req.protocol + '://' + req.get('host');
    const proxyRoot  = serverBase + '/proxy/myneta';
    console.log(`[PROXY] ${targetUrl}`);

    // Strip security headers so iframe renders freely
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Type-Options');

    try {
        const rawBody = await httpsGet(targetUrl, req.headers['accept']);
        const contentType = rawBody.contentType || 'text/html';

        // ── Binary assets: images, fonts, etc. — send raw buffer ──
        if (rawBody.binary) {
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(rawBody.data); 
        }

        // Convert Buffer to string for text content
        let body = rawBody.data.toString('utf-8');

        if (contentType.includes('text/html')) {
            const MYNETA = 'https://myneta.info';

            // ── Step 1: Assets (images, scripts, CSS) → Proxy ──
            // Rewrite src="..." and <link href="..."> to go through proxy
            body = body.replace(/\b(src|data-src|data-href)=(["'])\/((?!\/)[^"']*)(["'])/gi,
                (m, attr, q1, path, q2) => `${attr}=${q1}${proxyRoot}/${path}${q2}`);
            body = body.replace(/<link[^>]+href=(["'])\/((?!\/)[^"']*)(["'])/gi,
                (m, q1, path, q2) => m.replace(`/${path}`, `${proxyRoot}/${path}`));

            // ── Step 2: Links and Forms → Real Site ──
            // Rewrite href="/..." for <a> tags to absolute real URLs
            body = body.replace(/<a\b([^>]*?\bhref=(["']))\/((?!\/)[^"']*)(["'])/gi,
                (m, start, q1, path, q2) => `<a${start}${MYNETA}/${path}${q2} target="_blank" rel="noopener noreferrer"`);
            
            // Fix absolute links too
            body = body.replace(/href=(["'])https?:\/\/myneta\.info\/([^"']*)(["'])/gi,
                (m, q1, path, q2) => `href=${q1}${MYNETA}/${path}${q2} target="_blank" rel="noopener noreferrer"`);

            // Rewrite form actions to real site
            body = body.replace(/<form\b([^>]*?\baction=(["']))\/((?!\/)[^"']*)(["'])/gi,
                (m, start, q1, path, q2) => `<form${start}${MYNETA}/${path}${q2} target="_blank"`);

            // ── Step 3: Handle srcset and url() ──
            body = body.replace(/srcset=(["'])([^"']+)(["'])/gi, (m, q1, srcset, q2) => {
                const rw = srcset.split(',').map(part => {
                    const pieces = part.trim().split(/\s+/);
                    if (pieces[0].startsWith('/')) return proxyRoot + pieces[0] + (pieces[1] ? ' ' + pieces[1] : '');
                    return part.trim();
                }).join(', ');
                return `srcset=${q1}${rw}${q2}`;
            });
            body = body.replace(/url\((['"]?)\/((?!\/)[^)'"]*)\1\)/gi, (m, q, p) => `url(${q}${proxyRoot}/${p}${q})`);

            // ── Step 4: Remove ad scripts ──
            body = body.replace(/<script[^>]*(googlesyndication|doubleclick|adservice|pagead|adnxs|amazon-adsystem|googletagmanager|outbrain|taboola|criteo)[^>]*>[\s\S]*?<\/script>/gi, '');
            body = body.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');

            // ── Step 5: Inject ultimate navigation interceptor ──
            const injection = `
<style>
  .modal,.modal-backdrop,#donateModal,[id*="donat" i],.adsbygoogle,.popup { display:none!important; }
  body { overflow:auto!important; }
</style>
<script>
(function(){
  var REAL_BASE = 'https://myneta.info';
  var PROXY_BASE = '${proxyRoot}';

  function toReal(u) {
    if(!u || typeof u !== 'string' || u.startsWith('#') || u.startsWith('javascript')) return u;
    if(u.indexOf(PROXY_BASE) === 0) u = u.replace(PROXY_BASE, '');
    if(u.startsWith('/')) u = REAL_BASE + u;
    else if(!u.startsWith('http')) u = REAL_BASE + '/' + u;
    return u;
  }

  // 1. Force all <a> to _blank and real URL
  function fix() {
    document.querySelectorAll('a').forEach(function(a){
      var href = a.getAttribute('href');
      if(href && !href.startsWith('http') && !href.startsWith('#')) {
        a.href = toReal(href);
        a.target = '_blank';
      }
    });
    // 2. Fix dropdowns (select onchange)
    document.querySelectorAll('select[onchange*="location"]').forEach(function(s){
      var oc = s.getAttribute('onchange');
      if(oc && !oc.includes('window.open')) {
         // Wrap the location change in window.open
         s.setAttribute('onchange', oc.replace(/location\\s*=\\s*([^;]+)/g, 'window.open(toReal($1), "_blank")'));
      }
    });
  }
  
  // 3. Global click interceptor (Capture phase)
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if(a && a.href && a.href.indexOf(REAL_BASE) !== -1) {
      e.stopPropagation(); // prevent site JS from interfering
      // target="_blank" is already set by fix()
    }
  }, true);

  // 4. Global submit interceptor
  document.addEventListener('submit', function(e){
    var f = e.target;
    f.action = toReal(f.getAttribute('action'));
    f.target = '_blank';
  }, true);

  // 5. Hijack window.open
  var _open = window.open;
  window.open = function(url, name, features) {
    return _open(toReal(url), '_blank', features);
  };

  // Kill ads/modals
  function kill(){
    document.querySelectorAll('.modal,.modal-backdrop,[id*="donat" i],.adsbygoogle,.popup').forEach(function(el){
      el.style.display='none';
    });
    if(document.body){ document.body.classList.remove('modal-open'); document.body.style.overflow='auto'; }
  }
  document.addEventListener('DOMContentLoaded', kill);
  [500,1500,3000].forEach(function(t){ setTimeout(kill,t); });
  
  setInterval(fix, 1000);
  fix();
})();
</script>`;

            if (/<head>/i.test(body)) {
                body = body.replace(/<head>/i, '<head>' + injection);
            } else {
                body = injection + body;
            }

            res.set('Content-Type', 'text/html; charset=utf-8');

        } else if (contentType.includes('text/css')) {
            body = body.replace(/https?:\/\/myneta\.info/gi, proxyRoot);
            body = body.replace(/url\((['"]?)\/((?!\/)[^)'"]*)\1\)/gi, (m, q, p) => `url(${q}${proxyRoot}/${p}${q})`);
            res.set('Content-Type', contentType);
        } else {
            // JS and everything else
            body = body.replace(/https?:\/\/myneta\.info/gi, proxyRoot);
            res.set('Content-Type', contentType);
        }

        res.set('Cache-Control', 'no-store');
        res.send(body);

    } catch (err) {
        console.error('[PROXY] Error:', err.message);
        res.status(502).send(`<html><body style="font-family:sans-serif;background:#05080f;color:#f8fafc;text-align:center;padding:4rem;">
            <h2 style="color:#ef4444;">⚠️ Could not reach Myneta.info</h2>
            <p style="color:#94a3b8;">${err.message}</p>
            <a href="/proxy/myneta" style="color:#FF9933;margin-right:1rem;">🔄 Retry</a>
            <a href="https://myneta.info" target="_blank" style="color:#60a5fa;">↗ Open directly</a>
        </body></html>`);
    }
}

module.exports = router;
