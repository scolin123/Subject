'use strict';

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

// ─── Status bar ───────────────────────────────────────────────────────────────
function initStatusBar() {
  const textEl   = document.getElementById('status-text');
  const caseIdEl = document.getElementById('status-case-id');
  if (!textEl) return;

  let _clearTimer = null;

  on('status:queued', ({ message, duration }) => {
    textEl.textContent = message;
    clearTimeout(_clearTimer);
    if (duration > 0) {
      _clearTimer = setTimeout(() => {
        textEl.textContent = gameState.currentStatus;
      }, duration);
    }
  });

  // Keep a stable "idle" message so the timer can restore it
  on('*', (payload, event) => {
    if (event === 'case:loaded' && payload.caseData) {
      gameState.currentStatus = `CASE // ${payload.caseData.id.toUpperCase()}`;
      caseIdEl && (caseIdEl.textContent = payload.caseData.id.toUpperCase());
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function boot() {
  // Initialise state — loadSave handles both new and returning
  const hasSave    = Boolean(localStorage.getItem('subject-save'));
  const isReturning = hasSave && !DEV_RESET_ON_LOAD;

  initStatusBar();
  loadSave(); // dispatches 'save:loaded' or 'game:init'

  await runBootSequence(isReturning);

  gameState.isBooted = true;
  pushStatus('SYSTEM READY.');
  wirePolaroids();
}

document.addEventListener('DOMContentLoaded', boot);
