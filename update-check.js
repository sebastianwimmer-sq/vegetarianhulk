// vegetarianhulk Update-Check — fetch version.json + zeige Banner bei Update
// v31.10 Bugfix Combo A+B:
//   A: Pulse-Animation entfernt + Session-only statt 5min-Polling
//   B: Preview-URL-Disable (CF-Pages-Preview triggert keine Banner)
(function vegetarianhulkUpdateCheck() {
  if (typeof window === 'undefined') return;

  // === Option B: Skip Update-Check auf CF-Pages-Preview-URLs ===
  // Verhindert Banner-Spam während Sprint-Iterations (Preview-Deploys
  // ändern version.json ständig, Production-User sollen nicht beeinflusst sein).
  if (window.location.hostname.includes('preview.pages.dev')) return;

  const STORAGE_KEY = 'vegetarianhulk_lastSeenVersion';
  const SESSION_KEY = 'vegetarianhulk_updateBannerDismissed';
  let bannerShown = false;

  // === Option A.2: Session-only — wenn Banner in dieser Session schon
  // dismissed wurde, nicht mehr zeigen (auch nicht bei Cross-Page-Nav)
  function isDismissedThisSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; }
    catch(e) { return false; }
  }
  function markDismissedThisSession() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch(e) {}
  }

  function showBanner(newVersion) {
    if (bannerShown || isDismissedThisSession()) return;
    bannerShown = true;

    if (!document.getElementById('vhUpdateBannerStyles')) {
      const s = document.createElement('style');
      s.id = 'vhUpdateBannerStyles';
      // === Option A.1: NUR vhBnrSlide (initial entry) — vhBnrPulse-Animation entfernt
      s.textContent = '@keyframes vhBnrSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(s);
    }

    const banner = document.createElement('div');
    banner.id = 'vegetarianhulkUpdateBanner';
    // === Animation: nur slide-in, kein infinite-pulse mehr
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px 16px;background:linear-gradient(135deg,#2d6a3e,#1f4d2c);color:#f7efde;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(45,106,62,.4);animation:vhBnrSlide .35s cubic-bezier(.16,1,.3,1);padding-top:max(12px,env(safe-area-inset-top))';
    banner.innerHTML = '<div style="flex:1;display:flex;align-items:center;gap:8px"><span style="font-size:18px">🌱</span><span><b>Neue Version</b><span style="opacity:.75;margin-left:6px">— tap zum Reload</span></span></div><button id="vhUpdateReload" style="background:rgba(247,239,222,.95);color:#1f4d2c;border:0;padding:8px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px">Reload →</button><button id="vhUpdateDismiss" style="background:transparent;border:0;color:#f7efde;font-size:20px;cursor:pointer;padding:0 6px;line-height:1;font-weight:900">×</button>';
    document.body.appendChild(banner);

    document.getElementById('vhUpdateReload').onclick = () => {
      try { localStorage.setItem(STORAGE_KEY, newVersion); } catch(e) {}
      window.location.reload();
    };
    document.getElementById('vhUpdateDismiss').onclick = () => {
      try { localStorage.setItem(STORAGE_KEY, newVersion); } catch(e) {}
      markDismissedThisSession();
      banner.style.animation = 'vhBnrSlide .3s cubic-bezier(.16,1,.3,1) reverse';
      setTimeout(() => banner.remove(), 300);
    };
  }

  function checkVersion() {
    fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j || !j.v) return;
        let lastSeen = '';
        try { lastSeen = localStorage.getItem(STORAGE_KEY) || ''; } catch(e) {}
        if (!lastSeen) {
          // first-visit: set baseline, no banner
          try { localStorage.setItem(STORAGE_KEY, j.v); } catch(e) {}
          return;
        }
        if (lastSeen !== j.v) {
          showBanner(j.v);
        }
      })
      .catch(()=>{});
  }

  // === Option A.2: 1× pro Page-Load, KEIN setInterval-Polling mehr
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setTimeout(checkVersion, 1500); });
  } else {
    setTimeout(checkVersion, 1500);
  }
})();
