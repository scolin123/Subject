'use strict';

// ─── Hidden prompt unlock thresholds (mirrors checkpoints.md) ─────────────────
const HIDDEN_UNLOCK = {
  0: null, // all prompts visible at checkpoint 0
  1: s => s.empathy >= 10 || s.compliance >= 10,
  2: s => s.empathy >= 15 || s.compliance >= 15,
  3: s => s.empathy >= 20 || s.compliance >= 20 || s.sabotage >= 2,
  4: s => s.empathy >= 25 || s.compliance >= 25 || s.detection >= 3,
  5: s => s.empathy >= 30 || s.compliance >= 30 || s.sabotage >= 4,
};

// ─── Score delta per tier ─────────────────────────────────────────────────────
const TIER_DELTA = {
  E: { empathy:    2 },
  C: { compliance: 2 },
  N: {},
  H: {},
};

// ─── DOM refs (populated on init) ─────────────────────────────────────────────
let _advanceBtn   = null;
let _notepadInput = null;
let _promptPanel  = null;
let _entriesEl    = null;

// ─── Current case checkpoint data ─────────────────────────────────────────────
// Set by caseLoader via notepad.setCaseData(caseData) once a case is loaded.
let _caseCheckpoints = [];

function setCaseData(caseData) {
  _caseCheckpoints = caseData.checkpoints || [];
  _updateGateText();
}

// ─── Gate text (notepad prompt label) ─────────────────────────────────────────
function _updateGateText() {
  const cp = _caseCheckpoints[gameState.currentCheckpoint];
  if (!cp) return;
  const placeholder = _notepadInput;
  if (placeholder) placeholder.placeholder = cp.gate_text;
}

// ─── Notepad gate — enable Advance when >= 20 chars ───────────────────────────
function _onInput() {
  const ready = _notepadInput.value.trim().length >= 20;
  _advanceBtn.disabled = !ready;
}

// ─── Render a past entry ──────────────────────────────────────────────────────
function _renderEntry(entry, index) {
  const el = document.createElement('div');
  el.className = 'notepad-entry' + (entry.redacted ? ' redacted' : '');
  el.dataset.index = index;

  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  meta.textContent = `CP ${entry.checkpoint} // ${new Date(entry.timestamp).toLocaleTimeString()}`;

  const text = document.createElement('p');
  text.textContent = entry.text;

  el.appendChild(meta);
  el.appendChild(text);
  _entriesEl.appendChild(el);
}

// ─── Hidden prompt unlock check ───────────────────────────────────────────────
function isHiddenUnlocked(checkpointId) {
  const fn = HIDDEN_UNLOCK[checkpointId];
  if (!fn) return true;
  return fn(gameState.scores);
}

// ─── Render prompt buttons ────────────────────────────────────────────────────
function renderPrompts(checkpointData) {
  _promptPanel.innerHTML = '';
  const prompts = checkpointData.prompts || [];

  prompts.forEach(prompt => {
    if (prompt.tier === 'H' && !isHiddenUnlocked(checkpointData.id)) return;

    const btn = document.createElement('button');
    btn.className = 'prompt-option';
    btn.dataset.tier = prompt.tier;
    btn.dataset.fragmentId = prompt.fragment_id;
    btn.textContent = prompt.text;

    btn.addEventListener('click', () => handlePromptChoice(prompt, checkpointData.id));
    _promptPanel.appendChild(btn);
  });
}

// ─── Show / hide prompt panel ─────────────────────────────────────────────────
function showPromptPanel() {
  const cp = _caseCheckpoints[gameState.currentCheckpoint];
  if (!cp || !cp.prompts) return;

  _advanceBtn.hidden = true;
  renderPrompts(cp);
  _promptPanel.removeAttribute('hidden');
}

function hidePromptPanel() {
  _promptPanel.setAttribute('hidden', '');
  _promptPanel.innerHTML = '';
  _advanceBtn.hidden = false;
  _advanceBtn.disabled = true;
}

// ─── Handle a prompt choice ───────────────────────────────────────────────────
async function handlePromptChoice(prompt, checkpointId) {
  // Disable all options immediately to prevent double-click
  _promptPanel.querySelectorAll('.prompt-option').forEach(b => b.disabled = true);

  // Apply tier score delta
  const delta = TIER_DELTA[prompt.tier] || {};
  if (Object.keys(delta).length) applyScoreDelta(delta);

  // Confirmation status message
  pushStatus(`ACCESSING: ${prompt.text.toUpperCase()}...`);

  // 1200ms delay before proceeding
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Hide panel, ready for next checkpoint
  hidePromptPanel();
  _updateGateText();
  _notepadInput.value = '';

  // Dispatch for caseLoader / viewmaster to handle fragment load
  dispatch('prompt:selected', {
    tier:        prompt.tier,
    fragmentId:  prompt.fragment_id,
    text:        prompt.text,
    checkpoint:  checkpointId,
  });
}

// ─── Advance button click ─────────────────────────────────────────────────────
function _onAdvance() {
  const text = _notepadInput.value.trim();
  if (text.length < 20) return;

  // Commit entry to state
  commitNotepadEntry(text);

  // Render the new entry in the log
  const idx = gameState.notepadEntries.length - 1;
  _renderEntry(gameState.notepadEntries[idx], idx);

  // Scroll entries to bottom
  _entriesEl.scrollTop = _entriesEl.scrollHeight;

  // Advance the checkpoint counter
  advanceCheckpoint();

  // Show prompt choices (or dispatch directly if no prompts defined)
  const cp = _caseCheckpoints[gameState.currentCheckpoint];
  if (cp && cp.prompts && cp.prompts.length) {
    showPromptPanel();
  } else {
    _notepadInput.value = '';
    _advanceBtn.disabled = true;
    _updateGateText();
  }
}

// ─── Restore entries from saved state ────────────────────────────────────────
function _restoreEntries() {
  _entriesEl.innerHTML = '';
  gameState.notepadEntries.forEach((entry, i) => _renderEntry(entry, i));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initNotepad() {
  _advanceBtn   = document.getElementById('advance-btn');
  _notepadInput = document.getElementById('notepad-input');
  _promptPanel  = document.getElementById('prompt-panel');
  _entriesEl    = document.getElementById('notepad-entries');

  if (!_advanceBtn || !_notepadInput || !_promptPanel || !_entriesEl) {
    console.warn('[notepad] Missing DOM elements — notepad not initialised.');
    return;
  }

  _notepadInput.addEventListener('input', _onInput);
  _advanceBtn.addEventListener('click', _onAdvance);

  // Restore entries if resuming from save
  on('save:loaded', _restoreEntries);

  // Re-render gate text when checkpoint advances (covers external triggers)
  on('checkpoint:advanced', _updateGateText);
}

// ─── Expose ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  initNotepad,
  setCaseData,
  isHiddenUnlocked,
  showPromptPanel,
  hidePromptPanel,
});

document.addEventListener('DOMContentLoaded', initNotepad);
