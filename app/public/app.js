// ============================================================
// CI/CD Pipeline Dashboard — Client-side JavaScript
// ============================================================

(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────
  const API_BASE = window.location.origin;
  const REFRESH_INTERVAL = 10_000; // 10 seconds

  // ─── DOM References ─────────────────────────────────────────
  const els = {
    appStatus:     document.getElementById('stat-app-status'),
    health:        document.getElementById('stat-health'),
    version:       document.getElementById('stat-version'),
    uptime:        document.getElementById('stat-uptime'),
    systemInfo:    document.getElementById('system-info-list'),
    tlDeployed:    document.getElementById('tl-deployed-time'),
    tlHealth:      document.getElementById('tl-health-time'),
    tlRefresh:     document.getElementById('tl-refresh-time'),
    epRoot:        document.getElementById('ep-root'),
    epHealth:      document.getElementById('ep-health'),
    epInfo:        document.getElementById('ep-info'),
    btnRefresh:    document.getElementById('btn-refresh'),
    liveIndicator: document.getElementById('live-indicator'),
  };

  // Pipeline stages for animation
  const stages = [
    document.getElementById('stage-push'),
    document.getElementById('stage-build'),
    document.getElementById('stage-docker'),
    document.getElementById('stage-push-hub'),
    document.getElementById('stage-deploy'),
  ];

  // ─── Helpers ────────────────────────────────────────────────
  function formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  function formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  }

  function nowFormatted() {
    return formatTime(new Date().toISOString());
  }

  function setEndpointStatus(el, online) {
    el.className = 'ep-status ' + (online ? 'online' : 'offline');
    el.textContent = online ? 'Online' : 'Offline';
  }

  function animateValue(el, text) {
    el.classList.remove('fade-in');
    // trigger reflow
    void el.offsetWidth;
    el.textContent = text;
    el.classList.add('fade-in');
  }

  // ─── Pipeline Stage Animation ───────────────────────────────
  let stageIndex = 0;
  let stageTimer = null;

  function animateStages() {
    stages.forEach((s) => s.classList.remove('active'));
    stages[stageIndex].classList.add('active');
    stageIndex = (stageIndex + 1) % stages.length;
  }

  function startStageAnimation() {
    if (stageTimer) clearInterval(stageTimer);
    stageIndex = 0;
    animateStages();
    stageTimer = setInterval(animateStages, 2500);
  }

  // ─── Fetch Data ─────────────────────────────────────────────
  async function fetchJSON(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadRoot() {
    try {
      const data = await fetchJSON('/api');
      animateValue(els.appStatus, capitalise(data.status));
      animateValue(els.version, data.version);
      animateValue(els.uptime, formatUptime(data.uptime_seconds));
      els.tlDeployed.textContent = formatTime(data.deployed_at);

      // Color the status
      els.appStatus.style.color = data.status === 'running'
        ? 'var(--accent-green)' : 'var(--accent-red)';

      setEndpointStatus(els.epRoot, true);
    } catch (err) {
      console.warn('/ fetch failed:', err);
      animateValue(els.appStatus, 'Unreachable');
      els.appStatus.style.color = 'var(--accent-red)';
      setEndpointStatus(els.epRoot, false);
    }
  }

  async function loadHealth() {
    try {
      const data = await fetchJSON('/api/health');
      animateValue(els.health, data.healthy ? 'Healthy' : 'Unhealthy');
      els.health.style.color = data.healthy
        ? 'var(--accent-green)' : 'var(--accent-red)';

      els.tlHealth.textContent = formatTime(data.timestamp);
      setEndpointStatus(els.epHealth, true);
    } catch (err) {
      console.warn('/health fetch failed:', err);
      animateValue(els.health, 'Unreachable');
      els.health.style.color = 'var(--accent-red)';
      setEndpointStatus(els.epHealth, false);
    }
  }

  async function loadInfo() {
    try {
      const data = await fetchJSON('/api/info');

      const rows = [
        ['Node Version', data.node_version],
        ['Platform', data.platform],
        ['Environment', data.environment],
        ['Memory Usage', `${data.memory_usage_mb} MB`],
        ['Build Version', data.build_version],
      ];

      els.systemInfo.innerHTML = rows
        .map(([k, v]) =>
          `<div class="info-row fade-in">
            <span class="info-key">${k}</span>
            <span class="info-val">${v}</span>
          </div>`
        )
        .join('');

      setEndpointStatus(els.epInfo, true);
    } catch (err) {
      console.warn('/info fetch failed:', err);
      els.systemInfo.innerHTML =
        '<div class="info-row"><span class="info-key" style="color:var(--accent-red)">Failed to load system info</span></div>';
      setEndpointStatus(els.epInfo, false);
    }
  }

  function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ─── Master refresh ────────────────────────────────────────
  async function refreshAll() {
    els.btnRefresh.classList.add('spinning');
    await Promise.allSettled([loadRoot(), loadHealth(), loadInfo()]);
    els.tlRefresh.textContent = nowFormatted();
    setTimeout(() => els.btnRefresh.classList.remove('spinning'), 600);
  }

  // ─── Init ──────────────────────────────────────────────────
  function init() {
    startStageAnimation();
    refreshAll();

    // Auto-refresh
    setInterval(refreshAll, REFRESH_INTERVAL);

    // Manual refresh
    els.btnRefresh.addEventListener('click', refreshAll);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
