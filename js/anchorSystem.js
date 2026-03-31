'use strict';

// ─── Anchor cache (populated on case:loaded) ──────────────────────────────────
let _anchors = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
function initAnchorSystem() {
  on('case:loaded', ({ caseData }) => {
    _anchors = caseData.anchors || [];
  });
}

// ─── Returns the shared anchor IDs between two fragments ──────────────────────
function getSharedAnchors(fragA, fragB) {
  const setA = new Set(fragA.anchor_ids || []);
  return (fragB.anchor_ids || []).filter(id => setA.has(id));
}

// ─── Returns true if two fragments share at least one anchor ──────────────────
function canConnect(fragA, fragB) {
  return getSharedAnchors(fragA, fragB).length > 0;
}

// ─── Expose ───────────────────────────────────────────────────────────────────
Object.assign(window, { initAnchorSystem, canConnect, getSharedAnchors });

document.addEventListener('DOMContentLoaded', initAnchorSystem);
