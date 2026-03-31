'use strict';

// ─── Dev flags ────────────────────────────────────────────────────────────────
const DEV_RESET_ON_LOAD = false;
const DEV_VERBOSE = false;

// ─── Event bus ────────────────────────────────────────────────────────────────
const _listeners = {};

function on(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
}

function off(event, cb) {
  if (!_listeners[event]) return;
  _listeners[event] = _listeners[event].filter(fn => fn !== cb);
}

function dispatch(event, payload) {
  if (DEV_VERBOSE) console.log(`[event] ${event}`, payload);
  const handlers = [...(_listeners[event] || []), ...(_listeners['*'] || [])];
  handlers.forEach(fn => fn(payload, event));
}

// ─── State ────────────────────────────────────────────────────────────────────
const gameState = {
  sessionId: null,
  isBooted: false,
  isLoading: false,
  currentCase: null,
  currentCheckpoint: 0,
  caseTitle: '',
  scores: {
    empathy: 0,
    compliance: 0,
    sabotage: 0,
    detection: 0,
  },
  flags: {
    paradoxTriggered: false,
    fullChainCompleted: false,
    auditorFragmentFound: false,
    redactionModeActive: false,
    notepadGateCleared: false,
    autoCloseTriggered: false,
    vossUnlocked: false,
    caseResolved: false,
  },
  loadedFragments: [],
  activeFragmentId: null,
  matrix: {
    nodes: [],
    connections: [],
    paradoxPairs: [],
  },
  notepadEntries: [],
  redactedFragments: [],
  completedEndings: [],
  vossCallHistory: [],
  statusQueue: [],
  currentStatus: 'SYSTEM READY.',
};

// ─── Score management ─────────────────────────────────────────────────────────
function applyScoreDelta(delta) {
  for (const [key, val] of Object.entries(delta)) {
    if (!(key in gameState.scores)) continue;
    gameState.scores[key] = Math.max(0, gameState.scores[key] + val);
  }
  if (gameState.scores.detection >= 10) {
    gameState.scores.detection = 10;
    dispatch('detection:max', { scores: { ...gameState.scores } });
  }
  checkDetectionThreshold();
}

const _firedDetectionEvents = new Set();

function checkDetectionThreshold() {
  const d = gameState.scores.detection;
  for (const threshold of [3, 5, 7, 9, 10]) {
    if (d >= threshold && !_firedDetectionEvents.has(threshold)) {
      _firedDetectionEvents.add(threshold);
      dispatch(`detection:${threshold}`, { detection: d });
    }
  }
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function pushStatus(message, duration = 4000) {
  gameState.statusQueue.push({ message, duration });
  dispatch('status:queued', { message, duration });
}

// ─── Notepad ──────────────────────────────────────────────────────────────────
function commitNotepadEntry(text) {
  const entry = {
    text,
    checkpoint: gameState.currentCheckpoint,
    timestamp: Date.now(),
    scores_at_time: { ...gameState.scores },
    redacted: false,
  };
  gameState.notepadEntries.push(entry);
  saveToLocalStorage();
  dispatch('notepad:entryCommitted', { entry, index: gameState.notepadEntries.length - 1 });
}

function toggleNotepadRedaction(index) {
  const entry = gameState.notepadEntries[index];
  if (!entry) return;
  entry.redacted = !entry.redacted;
  applyScoreDelta({ sabotage: 1, detection: 1 });
  saveToLocalStorage();
  dispatch('notepad:redactionToggled', { index, redacted: entry.redacted });
}

// ─── Fragment redaction ───────────────────────────────────────────────────────
function toggleFragmentRedaction(fragmentId) {
  const fragment = gameState.loadedFragments.find(f => f.id === fragmentId);
  const detectionCost = (fragment && fragment.flagged) ? 2 : 1;

  const idx = gameState.redactedFragments.indexOf(fragmentId);
  if (idx === -1) {
    gameState.redactedFragments.push(fragmentId);
  } else {
    gameState.redactedFragments.splice(idx, 1);
  }
  // Cost applies both on redact and unredact — no take-back
  applyScoreDelta({ sabotage: 1, detection: detectionCost });
  saveToLocalStorage();
  dispatch('fragment:redactionToggled', { fragmentId, redacted: idx === -1 });
}

// ─── Matrix ───────────────────────────────────────────────────────────────────
function addMatrixConnection(connection) {
  gameState.matrix.connections.push({
    from: connection.from,
    to: connection.to,
    anchorIds: connection.anchorIds || [],
    valid: true,
  });
  checkFullChain();
  checkParadox();
  saveToLocalStorage();
  dispatch('matrix:connectionAdded', { connection });
}

function removeMatrixConnection(fromId, toId) {
  gameState.matrix.connections = gameState.matrix.connections.filter(
    c => !(c.from === fromId && c.to === toId)
  );
  checkParadox();
  checkFullChain();
  saveToLocalStorage();
  dispatch('matrix:connectionRemoved', { fromId, toId });
}

function addMatrixNode(node) {
  const exists = gameState.matrix.nodes.find(n => n.id === node.id);
  if (exists) return;
  gameState.matrix.nodes.push({
    id: node.id,
    fragmentId: node.fragmentId,
    position: node.position,
    colorState: 'unconnected',
  });
  dispatch('matrix:nodeAdded', { node });
}

function updateNodePosition(nodeId, position) {
  const node = gameState.matrix.nodes.find(n => n.id === nodeId);
  if (node) node.position = position;
  // Caller is responsible for debouncing save/dispatch
}

function setNodeColor(nodeId, colorState) {
  const node = gameState.matrix.nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.colorState = colorState;
  dispatch('matrix:nodeColorChanged', { nodeId, colorState });
}

function checkParadox() {
  const paradoxPairs = gameState.matrix.paradoxPairs || [];
  const connectedIds = new Set(
    gameState.matrix.connections.flatMap(c => [c.from, c.to])
  );
  let paradoxFound = false;
  for (const pair of paradoxPairs) {
    if (connectedIds.has(pair[0]) && connectedIds.has(pair[1])) {
      paradoxFound = true;
      break;
    }
  }
  if (paradoxFound && !gameState.flags.paradoxTriggered) {
    gameState.flags.paradoxTriggered = true;
    dispatch('paradox:triggered', { paradoxPairs });
  } else if (!paradoxFound && gameState.flags.paradoxTriggered) {
    gameState.flags.paradoxTriggered = false;
    dispatch('paradox:resolved', {});
  }
}

function checkFullChain() {
  const fragmentIds = gameState.loadedFragments.map(f => f.id);
  if (fragmentIds.length === 0) return;
  const connectedIds = new Set(
    gameState.matrix.connections.flatMap(c => [c.from, c.to])
  );
  const allConnected = fragmentIds.every(id => connectedIds.has(id));
  if (allConnected && !gameState.flags.fullChainCompleted) {
    gameState.flags.fullChainCompleted = true;
    dispatch('chain:completed', { fragmentIds });
  }
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function advanceCheckpoint() {
  if (gameState.currentCheckpoint >= 5) return;
  gameState.currentCheckpoint++;
  gameState.flags.notepadGateCleared = false;
  saveToLocalStorage();
  dispatch('checkpoint:advanced', { checkpoint: gameState.currentCheckpoint });
}

// ─── Endings ──────────────────────────────────────────────────────────────────
function recordEnding(endingId) {
  gameState.flags.caseResolved = true;
  const record = {
    endingId,
    timestamp: Date.now(),
    finalScores: { ...gameState.scores },
  };
  gameState.completedEndings.push(record);
  saveToLocalStorage();
  dispatch('ending:reached', { endingId, record });
}

// ─── Persistence ──────────────────────────────────────────────────────────────
const SAVE_KEY = 'subject-save';

function saveToLocalStorage() {
  try {
    const data = {
      currentCase: gameState.currentCase,
      currentCheckpoint: gameState.currentCheckpoint,
      caseTitle: gameState.caseTitle,
      scores: { ...gameState.scores },
      flags: { ...gameState.flags },
      completedEndings: [...gameState.completedEndings],
      notepadEntries: [...gameState.notepadEntries],
      matrixConnections: [...gameState.matrix.connections],
      matrixNodes: [...gameState.matrix.nodes],
      redactedFragments: [...gameState.redactedFragments],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[gameState] saveToLocalStorage failed:', e);
  }
}

function loadSave() {
  if (DEV_RESET_ON_LOAD) {
    if (DEV_VERBOSE) console.log('[gameState] DEV_RESET_ON_LOAD active — skipping load.');
    initNewGame();
    return;
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { initNewGame(); return; }
    const data = JSON.parse(raw);
    Object.assign(gameState.scores, data.scores || {});
    Object.assign(gameState.flags, data.flags || {});
    gameState.currentCase        = data.currentCase        ?? gameState.currentCase;
    gameState.currentCheckpoint  = data.currentCheckpoint  ?? 0;
    gameState.caseTitle          = data.caseTitle          ?? '';
    gameState.completedEndings   = data.completedEndings   ?? [];
    gameState.notepadEntries     = data.notepadEntries     ?? [];
    gameState.matrix.connections = data.matrixConnections  ?? [];
    gameState.matrix.nodes       = data.matrixNodes        ?? [];
    gameState.redactedFragments  = data.redactedFragments  ?? [];
    dispatch('save:loaded', { data });
  } catch (e) {
    console.warn('[gameState] loadSave failed — starting new game:', e);
    initNewGame();
  }
}

function initNewGame() {
  gameState.sessionId         = crypto.randomUUID();
  gameState.isBooted          = false;
  gameState.isLoading         = false;
  gameState.currentCase       = null;
  gameState.currentCheckpoint = 0;
  gameState.caseTitle         = '';
  gameState.scores            = { empathy: 0, compliance: 0, sabotage: 0, detection: 0 };
  gameState.flags             = {
    paradoxTriggered:    false,
    fullChainCompleted:  false,
    auditorFragmentFound: false,
    redactionModeActive: false,
    notepadGateCleared:  false,
    autoCloseTriggered:  false,
    vossUnlocked:        false,
    caseResolved:        false,
  };
  gameState.loadedFragments   = [];
  gameState.activeFragmentId  = null;
  gameState.matrix            = { nodes: [], connections: [], paradoxPairs: [] };
  gameState.notepadEntries    = [];
  gameState.redactedFragments = [];
  gameState.completedEndings  = [];
  gameState.vossCallHistory   = [];
  gameState.statusQueue       = [];
  gameState.currentStatus     = 'SYSTEM READY.';
  _firedDetectionEvents.clear();
  dispatch('game:init', { sessionId: gameState.sessionId });
}

// ─── Expose on window for cross-module access ─────────────────────────────────
Object.assign(window, {
  gameState,
  DEV_RESET_ON_LOAD,
  on,
  off,
  dispatch,
  applyScoreDelta,
  checkDetectionThreshold,
  pushStatus,
  commitNotepadEntry,
  toggleNotepadRedaction,
  toggleFragmentRedaction,
  addMatrixConnection,
  removeMatrixConnection,
  addMatrixNode,
  updateNodePosition,
  setNodeColor,
  checkParadox,
  checkFullChain,
  advanceCheckpoint,
  recordEnding,
  saveToLocalStorage,
  loadSave,
  initNewGame,
});
