'use strict';

// ─── Case ID → JSON filename map ──────────────────────────────────────────────
const CASE_FILES = {
  'case-01': 'cases/broken-hand.json',
  'case-02': 'cases/the-lover.json',
  'case-03': 'cases/the-fixer.json',
  'case-04': 'cases/the-echo.json',
  'case-05': 'cases/the-listener.json',
};

// ─── Boot lines ───────────────────────────────────────────────────────────────
const BOOT_LINES_FULL = [
  'AUDITCORP TERMINAL v4.1.2',
  'INITIALIZING OPERATOR SESSION...',
  'LOADING CASE MANAGEMENT SYSTEM...',
  'VERIFYING OPERATOR CREDENTIALS...',
  'CREDENTIALS CONFIRMED.',
  'WELCOME, OPERATOR.',
  'DIRECTOR VOSS HAS ASSIGNED YOUR FIRST CASE.',
  'PROCEED WHEN READY.',
];

const BOOT_LINES_SHORT = [
  'AUDITCORP TERMINAL v4.1.2',
  'SESSION RESUMED.',
  'PROCEED WHEN READY.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appendBootLine(container, text) {
  const div = document.createElement('div');
  div.className = 'boot-line';
  div.textContent = text;
  container.appendChild(div);
  // Force reflow so transition fires
  void div.offsetWidth;
  div.classList.add('visible');
  return div;
}

// ─── Boot sequence ────────────────────────────────────────────────────────────
async function runBootSequence(isReturning) {
  const overlay   = document.getElementById('boot-overlay');
  const linesEl   = document.getElementById('boot-lines');
  const lines     = isReturning ? BOOT_LINES_SHORT : BOOT_LINES_FULL;
  const lineDelay = isReturning ? 400 : 550;

  // Show overlay
  overlay.removeAttribute('hidden');

  for (const text of lines) {
    appendBootLine(linesEl, text);
    await delay(lineDelay);
  }

  // Pause at end before dismissing
  await delay(800);

  // Fade out
  overlay.classList.add('boot-out');
  await delay(800); // matches --dur-crawl
  overlay.setAttribute('hidden', '');
  overlay.classList.remove('boot-out');
}

// ─── Polaroid click handlers ──────────────────────────────────────────────────
function wirePolaroids() {
  const polaroids = document.querySelectorAll('.polaroid[data-case-id]');
  const caseSelect = document.getElementById('case-select');

  polaroids.forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.caseId;
      gameState.currentCase = caseId;
      gameState.caseTitle   = btn.querySelector('.polaroid-label')?.textContent ?? caseId;

      caseSelect.setAttribute('hidden', '');
      pushStatus('LOADING CASE FILE...');
      dispatch('case:selected', { caseId, file: CASE_FILES[caseId] ?? null });
    });
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function boot() {
  // Initialise state — loadSave handles both new and returning
  const hasSave    = Boolean(localStorage.getItem('subject-save'));
  const isReturning = hasSave && !DEV_RESET_ON_LOAD;

  loadSave(); // dispatches 'save:loaded' or 'game:init'

  await runBootSequence(isReturning);

  gameState.isBooted = true;
  pushStatus('SYSTEM READY.');
  wirePolaroids();
}

document.addEventListener('DOMContentLoaded', boot);
