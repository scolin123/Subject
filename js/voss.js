'use strict';

// ─── Voss Memo ────────────────────────────────────────────────────────────────

function _onVossMemoTrigger({ fragment }) {
  if (!fragment) return;
  dispatch('fragment:load', { fragment });
  autoAdvanceVoss();
}

function initVoss() {
  on('voss:memo:trigger', _onVossMemoTrigger);
}

document.addEventListener('DOMContentLoaded', initVoss);
