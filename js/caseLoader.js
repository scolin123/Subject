'use strict';

// ─── Case ID → JSON path ──────────────────────────────────────────────────────
const CASE_FILES = {
  'case-01': 'cases/broken-hand.json',
  'case-02': 'cases/the-lover.json',
  'case-03': 'cases/the-fixer.json',
  'case-04': 'cases/the-echo.json',
  'case-05': 'cases/the-listener.json',
};

// ─── Active case data (full JSON, kept in memory) ─────────────────────────────
let _caseData = null;

// ─── Condition check ──────────────────────────────────────────────────────────
// Returns true if a conditional fragment's score requirements are met.
function meetsCondition(fragment) {
  if (!fragment.conditional || !fragment.condition_score) return true;
  return Object.entries(fragment.condition_score).every(
    ([key, min]) => (gameState.scores[key] ?? 0) >= min
  );
}

// ─── Build fragment pool ──────────────────────────────────────────────────────
// Mandatory fragments always included; conditional ones checked at load time.
function _buildFragmentPool(caseJson) {
  return caseJson.fragments.filter(f => !f.conditional || meetsCondition(f));
}

// ─── Load a case by ID ────────────────────────────────────────────────────────
async function loadCase(caseId) {
  const file = CASE_FILES[caseId];
  if (!file) {
    pushStatus(`ERROR: UNKNOWN CASE ID — ${caseId}`);
    return;
  }

  gameState.isLoading = true;

  let caseJson;
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    caseJson = await res.json();
  } catch (err) {
    console.error('[caseLoader] fetch failed:', err);
    pushStatus('ERROR: CASE FILE UNAVAILABLE.');
    gameState.isLoading = false;
    return;
  }

  // Cache full case data
  _caseData = caseJson;

  // Populate gameState
  gameState.loadedFragments     = _buildFragmentPool(caseJson);
  gameState.matrix.paradoxPairs = caseJson.paradox_pairs || [];
  gameState.currentCase         = caseId;
  gameState.caseTitle           = caseJson.title || caseId;
  gameState.isLoading           = false;

  // Update status bar case ID display
  const caseIdEl = document.getElementById('status-case-id');
  if (caseIdEl) caseIdEl.textContent = caseJson.id.toUpperCase();

  // Give checkpoint/prompt data to notepad module
  if (typeof setCaseData === 'function') setCaseData(caseJson);

  // Notify all other modules
  dispatch('case:loaded', { caseData: caseJson, fragments: gameState.loadedFragments });
  pushStatus(`CASE LOADED // ${caseJson.title.toUpperCase()}`);
}

// ─── Restore case on save:loaded ──────────────────────────────────────────────
// gameState is already hydrated at this point; we just need the JSON back.
function _onSaveLoaded() {
  if (gameState.currentCase) {
    loadCase(gameState.currentCase);
  }
}

// ─── Route a chosen fragment to viewmaster ────────────────────────────────────
function _onPromptSelected({ fragmentId }) {
  if (!_caseData) return;

  const fragment = _caseData.fragments.find(f => f.id === fragmentId);
  if (!fragment) {
    pushStatus('ERROR: FRAGMENT NOT FOUND.');
    return;
  }

  // Re-check condition (scores may have changed since load)
  if (fragment.conditional && !meetsCondition(fragment)) {
    pushStatus('ACCESS DENIED — CONDITION NOT MET.');
    return;
  }

  gameState.activeFragmentId = fragmentId;
  dispatch('fragment:load', { fragment });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initCaseLoader() {
  on('case:selected',   ({ caseId }) => loadCase(caseId));
  on('save:loaded',     _onSaveLoaded);
  on('prompt:selected', _onPromptSelected);
}

// ─── Expose ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  loadCase,
  meetsCondition,
});

document.addEventListener('DOMContentLoaded', initCaseLoader);
