'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let _bodyEl   = null;   // #matrix-body
let _boardEl  = null;   // #matrix-board (SVG <g>)
let _statusEl = null;   // #matrix-status-display

// ─── In-progress connection draft ─────────────────────────────────────────────
let _draft = { active: false, fromNodeEl: null, fromFragId: null, lineEl: null };

// ─── Debounce timer for position saves ────────────────────────────────────────
let _positionSaveTimer = null;

// ─── Click-vs-drag tracking ───────────────────────────────────────────────────
// Captures pointer-down position so we can ignore click events that follow a drag.
let _clickDownPos = null;

// ─── Connection gate ──────────────────────────────────────────────────────────
// _currentNodeFragId: the node the player is currently branching FROM.
// _unlockedFragmentId: mirrors _currentNodeFragId while the gate is open —
//   only this node's connectors can initiate a drag.
let _currentNodeFragId  = null;
let _unlockedFragmentId = null;

// ─── Case loaded ──────────────────────────────────────────────────────────────
function _onCaseLoaded({ fragments }) {
  _unlockedFragmentId = null;
  _currentNodeFragId  = fragments.find(f => f.checkpoint === 0)?.id || null;
  _clearBoard();

  const savedNodes = gameState.matrix.nodes;

  if (savedNodes.length > 0) {
    // Restore path — positions come from saved state
    savedNodes.forEach(nodeState => {
      const frag = fragments.find(f => f.id === nodeState.fragmentId);
      if (!frag) return;
      _createNodeEl(frag, nodeState.id, nodeState.position);
    });
    gameState.matrix.connections.forEach(conn => _drawLine(conn.from, conn.to));
    savedNodes.forEach(n => _applyNodeColor(n.id, n.colorState));
    if (gameState.flags.paradoxTriggered) {
      _onParadoxTriggered({ paradoxPairs: gameState.matrix.paradoxPairs });
    }
  } else {
    // Fresh path — stagger nodes in grid; checkpoint 0 (Voss Memo) always first
    const sorted = [...fragments].sort((a, b) => (a.checkpoint === 0 ? -1 : b.checkpoint === 0 ? 1 : 0));
    const total = sorted.length;
    sorted.forEach((frag, i) => {
      const nodeId = `node-${frag.id}`;
      const pos    = _gridPosition(i, total);
      addMatrixNode({ id: nodeId, fragmentId: frag.id, position: pos });
      _createNodeEl(frag, nodeId, pos);
    });
  }

  if (_statusEl) _statusEl.textContent = 'AWAITING INPUT';
  _bodyEl.classList.add('matrix-locked');
}

// ─── Clear board ──────────────────────────────────────────────────────────────
function _clearBoard() {
  _bodyEl.querySelectorAll('.matrix-node').forEach(el => el.remove());
  while (_boardEl.firstChild) _boardEl.removeChild(_boardEl.firstChild);
}

// ─── Grid position for fresh layout ──────────────────────────────────────────
function _gridPosition(index, total) {
  const COLS     = Math.ceil(Math.sqrt(total)) || 1;
  const COL_W    = 200;
  const ROW_H    = 130;
  const MARGIN_X = 40;
  const MARGIN_Y = 40;
  return {
    x: MARGIN_X + (index % COLS) * COL_W,
    y: MARGIN_Y + Math.floor(index / COLS) * ROW_H,
  };
}

// ─── Node flash feedback ──────────────────────────────────────────────────────
function _flashNode(el, color) {
  const cls = color === 'red' ? 'node-flash-red' : 'node-flash-orange';
  el.classList.remove(cls); // reset if already mid-flash
  void el.offsetWidth;      // force reflow so re-adding triggers the animation
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ─── Node denial overlay ──────────────────────────────────────────────────────
function _showNodeOverlay(el, text, color) {
  el.querySelector('.node-denial-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'node-denial-overlay ' + (color === 'red' ? 'denial-red' : 'denial-orange');
  overlay.textContent = text;
  el.appendChild(overlay);
  overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
}

// ─── Target highlighting ──────────────────────────────────────────────────────
function _clearTargetHighlights() {
  _bodyEl.querySelectorAll('.matrix-node.node-target').forEach(el => el.classList.remove('node-target'));
}

function _highlightTargets(fragmentIds) {
  _clearTargetHighlights();
  fragmentIds.forEach(id => {
    const nodeEl = _bodyEl.querySelector(`.matrix-node[data-fragment-id="${id}"]`);
    if (nodeEl) nodeEl.classList.add('node-target');
  });
}

// ─── Create node element ──────────────────────────────────────────────────────
function _createNodeEl(fragment, nodeId, position) {
  const el = document.createElement('div');
  el.className          = 'matrix-node';
  el.dataset.nodeId     = nodeId;
  el.dataset.fragmentId = fragment.id;
  el.dataset.state      = 'unconnected';
  el.style.left         = `${position.x}px`;
  el.style.top          = `${position.y}px`;

  const title = document.createElement('div');
  title.className   = 'node-title';
  title.textContent = fragment.title;

  const preview = document.createElement('div');
  preview.className   = 'node-preview';
  preview.textContent = fragment.type.replace(/_/g, ' ').toUpperCase();

  const connectors = document.createElement('div');
  connectors.className = 'node-connectors';

  const leftDot = document.createElement('div');
  leftDot.className          = 'connector-point';
  leftDot.dataset.side       = 'left';
  leftDot.dataset.nodeId     = nodeId;
  leftDot.dataset.fragmentId = fragment.id;

  const rightDot = document.createElement('div');
  rightDot.className          = 'connector-point';
  rightDot.dataset.side       = 'right';
  rightDot.dataset.nodeId     = nodeId;
  rightDot.dataset.fragmentId = fragment.id;

  connectors.appendChild(leftDot);
  connectors.appendChild(rightDot);
  el.appendChild(title);
  el.appendChild(preview);
  el.appendChild(connectors);
  _bodyEl.appendChild(el);

  leftDot.addEventListener('pointerdown',  _onConnectorMousedown);
  rightDot.addEventListener('pointerdown', _onConnectorMousedown);
  el.addEventListener('contextmenu', e => e.preventDefault());

  // Record pointer position on node body press (skip connector dots)
  el.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('connector-point')) return;
    _clickDownPos = { x: e.clientX, y: e.clientY };
  });

  // Click-to-view: load this fragment in the Fragment Viewer.
  // Ignored if the pointer moved more than 6px (was a drag, not a tap).
  el.addEventListener('click', e => {
    if (!_clickDownPos) return;
    const dx = e.clientX - _clickDownPos.x;
    const dy = e.clientY - _clickDownPos.y;
    _clickDownPos = null;
    if (Math.sqrt(dx * dx + dy * dy) > 6) return;

    const isVisited = el.classList.contains('visited');
    const isTarget  = el.classList.contains('node-target');

    if (isVisited) {
      // Previously viewed — always accessible
    } else if (isTarget) {
      // Valid target but line not drawn yet
      _flashNode(el, 'orange');
      _showNodeOverlay(el, '// CONNECT FIRST', 'orange');
      pushStatus('DRAW A CONNECTION LINE TO ACCESS THIS FRAGMENT.');
      return;
    } else {
      if (!gameState.flags.notepadGateCleared) {
        _flashNode(el, 'red');
        _showNodeOverlay(el, '// LOCKED', 'red');
        pushStatus('ACCESS DENIED — SUBMIT OPERATOR LOG TO UNLOCK MATRIX.');
        return;
      }
      if (_bodyEl.classList.contains('matrix-locked') && !el.classList.contains('active')) {
        _flashNode(el, 'red');
        _showNodeOverlay(el, '// RESTRICTED', 'red');
        pushStatus('ACCESS DENIED — FRAGMENT NOT YET REACHED IN INVESTIGATION.');
        return;
      }
    }

    const fragment = gameState.loadedFragments.find(f => f.id === el.dataset.fragmentId);
    if (fragment) dispatch('fragment:load', { fragment });
  });

  return el;
}

// ─── interact.js drag ─────────────────────────────────────────────────────────
function _wireInteract() {
  interact('.matrix-node').draggable({
    ignoreFrom: '.connector-point',
    listeners: {
      start(event) {
        event.target.classList.add('dragging');
      },
      move(event) {
        const el = event.target;
        const x  = (parseFloat(el.style.left) || 0) + event.dx;
        const y  = (parseFloat(el.style.top)  || 0) + event.dy;
        el.style.left = `${x}px`;
        el.style.top  = `${y}px`;
        _redrawLinesForNode(el.dataset.nodeId);
      },
      end(event) {
        const el     = event.target;
        const nodeId = el.dataset.nodeId;
        el.classList.remove('dragging');
        updateNodePosition(nodeId, {
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top)  || 0,
        });
        clearTimeout(_positionSaveTimer);
        _positionSaveTimer = setTimeout(() => saveToLocalStorage(), 300);
      },
    },
  });
}

// ─── Redraw lines attached to a node after drag ───────────────────────────────
function _redrawLinesForNode(nodeId) {
  const nodeState = gameState.matrix.nodes.find(n => n.id === nodeId);
  if (!nodeState) return;
  const fragId = nodeState.fragmentId;
  _boardEl.querySelectorAll(`line[data-from="${fragId}"], line[data-to="${fragId}"]`)
    .forEach(lineEl => _updateLineEndpoints(lineEl, lineEl.dataset.from, lineEl.dataset.to));
}

// ─── Connector center in #matrix-body local coordinates ──────────────────────
function _getConnectorCenter(fragId, side) {
  const nodeEl = _bodyEl.querySelector(`.matrix-node[data-fragment-id="${fragId}"]`);
  if (!nodeEl) return { x: 0, y: 0 };
  return {
    x: side === 'right' ? nodeEl.offsetLeft + nodeEl.offsetWidth : nodeEl.offsetLeft,
    y: nodeEl.offsetTop + nodeEl.offsetHeight / 2,
  };
}

// ─── Draw a permanent SVG line ────────────────────────────────────────────────
function _drawLine(fromFragId, toFragId) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.dataset.from = fromFragId;
  line.dataset.to   = toFragId;
  line.setAttribute('marker-end', 'url(#arrow-valid)');
  line.style.stroke      = 'var(--c-line-valid)';
  line.style.strokeWidth = '1.5';
  line.style.pointerEvents = 'stroke';
  line.style.cursor        = 'pointer';
  _updateLineEndpoints(line, fromFragId, toFragId);
  line.addEventListener('contextmenu', e => {
    e.preventDefault();
    removeMatrixConnection(fromFragId, toFragId);
  });
  _boardEl.appendChild(line);
  return line;
}

function _updateLineEndpoints(lineEl, fromFragId, toFragId) {
  const from = _getConnectorCenter(fromFragId, 'right');
  const to   = _getConnectorCenter(toFragId,   'left');
  lineEl.setAttribute('x1', from.x);
  lineEl.setAttribute('y1', from.y);
  lineEl.setAttribute('x2', to.x);
  lineEl.setAttribute('y2', to.y);
}

// ─── Draft connection (mousedown on connector → drag → mouseup on node) ───────
function _wireDraftListeners() {
  document.addEventListener('pointermove', _onDraftMousemove);
  document.addEventListener('pointerup',   _onDraftMouseup);
}

function _onConnectorMousedown(event) {
  event.stopPropagation();
  event.preventDefault();
  if (_draft.active) return;
  if (!gameState.flags.notepadGateCleared) {
    pushStatus('COMPLETE OPERATOR LOG BEFORE ACCESSING MATRIX.');
    return;
  }
  const dot = event.currentTarget;
  if (_unlockedFragmentId && dot.dataset.fragmentId !== _unlockedFragmentId) return;
  const fragId   = dot.dataset.fragmentId;
  const nodeEl   = _bodyEl.querySelector(`.matrix-node[data-node-id="${dot.dataset.nodeId}"]`);
  if (!nodeEl) return;

  const origin = _getConnectorCenter(fragId, dot.dataset.side);
  const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lineEl.classList.add('line-drawing');
  lineEl.setAttribute('pointer-events', 'none');
  lineEl.setAttribute('x1', origin.x);
  lineEl.setAttribute('y1', origin.y);
  lineEl.setAttribute('x2', origin.x);
  lineEl.setAttribute('y2', origin.y);
  _boardEl.appendChild(lineEl);

  _draft = { active: true, fromNodeEl: nodeEl, fromFragId: fragId, lineEl };
}

function _onDraftMousemove(event) {
  if (!_draft.active) return;
  const rect = _bodyEl.getBoundingClientRect();
  _draft.lineEl.setAttribute('x2', event.clientX - rect.left);
  _draft.lineEl.setAttribute('y2', event.clientY - rect.top);
}

function _onDraftMouseup(event) {
  if (!_draft.active) return;

  const target   = document.elementFromPoint(event.clientX, event.clientY);
  const toNodeEl = target ? target.closest('.matrix-node') : null;

  if (_draft.lineEl.parentNode) _draft.lineEl.parentNode.removeChild(_draft.lineEl);

  const fromFragId = _draft.fromFragId;
  const fromNodeEl = _draft.fromNodeEl;
  _draft = { active: false, fromNodeEl: null, fromFragId: null, lineEl: null };

  if (!toNodeEl || toNodeEl === fromNodeEl) return;

  const toFragId = toNodeEl.dataset.fragmentId;
  if (fromFragId === toFragId) return;

  // Duplicate check (undirected)
  const alreadyConnected = gameState.matrix.connections.some(c =>
    (c.from === fromFragId && c.to === toFragId) ||
    (c.from === toFragId   && c.to === fromFragId)
  );
  if (alreadyConnected) {
    pushStatus('CONNECTION ALREADY ESTABLISHED.');
    return;
  }

  const fragA = gameState.loadedFragments.find(f => f.id === fromFragId);
  const fragB = gameState.loadedFragments.find(f => f.id === toFragId);
  if (!fragA || !fragB) return;

  const isHighlightedTarget = toNodeEl.classList.contains('node-target');
  if (!isHighlightedTarget && !canConnect(fragA, fragB)) {
    pushStatus('ANCHOR VERIFICATION FAILED — NO LOGICAL LINK CONFIRMED.');
    return;
  }

  addMatrixConnection({ from: fromFragId, to: toFragId, anchorIds: getSharedAnchors(fragA, fragB) });
}

// ─── gameState event handlers ─────────────────────────────────────────────────
function _onConnectionAdded({ connection }) {
  _drawLine(connection.from, connection.to);
  _refreshNodeColors();
  _clearTargetHighlights();

  // The node connected TO becomes the new current node
  _currentNodeFragId = connection.to;
  const toFrag = gameState.loadedFragments.find(f => f.id === connection.to);
  if (toFrag) dispatch('fragment:load', { fragment: toFrag });

  // Re-lock — player must log before the next connection
  gameState.flags.notepadGateCleared = false;
  _unlockedFragmentId = null;
  _bodyEl.classList.add('matrix-locked');
}

function _onConnectionRemoved({ fromId, toId }) {
  const lineEl = _boardEl.querySelector(
    `line[data-from="${fromId}"][data-to="${toId}"], line[data-from="${toId}"][data-to="${fromId}"]`
  );
  if (lineEl) lineEl.remove();
  _refreshNodeColors();
}

function _onParadoxTriggered({ paradoxPairs }) {
  _bodyEl.classList.add('paradox-active');
  _bodyEl.addEventListener('animationend', () => {
    _bodyEl.classList.remove('paradox-active');
  }, { once: true });

  const connectedIds = new Set(
    gameState.matrix.connections.flatMap(c => [c.from, c.to])
  );

  (paradoxPairs || []).forEach(pair => {
    if (!connectedIds.has(pair[0]) || !connectedIds.has(pair[1])) return;

    pair.forEach(fragId => {
      const nodeState = gameState.matrix.nodes.find(n => n.fragmentId === fragId);
      if (!nodeState) return;
      setNodeColor(nodeState.id, 'paradox');
      _applyNodeColor(nodeState.id, 'paradox');
    });

    const lineEl = _boardEl.querySelector(
      `line[data-from="${pair[0]}"][data-to="${pair[1]}"], line[data-from="${pair[1]}"][data-to="${pair[0]}"]`
    );
    if (lineEl) {
      lineEl.classList.add('line-paradox');
      lineEl.setAttribute('marker-end', 'url(#arrow-paradox)');
    }
  });

  pushStatus('LOGICAL CONTRADICTION DETECTED — CHAIN INTEGRITY COMPROMISED.');
}

function _onParadoxResolved() {
  _bodyEl.classList.remove('paradox-active');
  _boardEl.querySelectorAll('.line-paradox').forEach(line => {
    line.classList.remove('line-paradox');
    line.setAttribute('marker-end', 'url(#arrow-valid)');
  });
  _refreshNodeColors();
  pushStatus('LOGICAL CONTRADICTION RESOLVED.');
}

function _onChainCompleted({ fragmentIds }) {
  if (_statusEl) _statusEl.textContent = 'CHAIN COMPLETE';
  pushStatus(`FULL CHAIN VERIFIED — ${fragmentIds.length} NODES LINKED.`);
}

function _onRedactionToggled({ fragmentId, redacted }) {
  const nodeEl = _bodyEl.querySelector(`.matrix-node[data-fragment-id="${fragmentId}"]`);
  if (!nodeEl) return;
  nodeEl.classList.toggle('redacted', redacted);
}

// ─── Node color management ────────────────────────────────────────────────────
function _refreshNodeColors() {
  const connectedFragIds = new Set(
    gameState.matrix.connections.flatMap(c => [c.from, c.to])
  );

  const paradoxFragIds = new Set();
  if (gameState.flags.paradoxTriggered) {
    (gameState.matrix.paradoxPairs || []).forEach(pair => {
      if (connectedFragIds.has(pair[0]) && connectedFragIds.has(pair[1])) {
        paradoxFragIds.add(pair[0]);
        paradoxFragIds.add(pair[1]);
      }
    });
  }

  gameState.matrix.nodes.forEach(nodeState => {
    if (nodeState.colorState === 'flagged') return;

    const color = paradoxFragIds.has(nodeState.fragmentId) ? 'paradox'
                : connectedFragIds.has(nodeState.fragmentId) ? 'connected'
                : 'unconnected';

    if (nodeState.colorState !== color) setNodeColor(nodeState.id, color);
    _applyNodeColor(nodeState.id, color);
  });
}

function _applyNodeColor(nodeId, colorState) {
  const nodeEl = _bodyEl.querySelector(`.matrix-node[data-node-id="${nodeId}"]`);
  if (!nodeEl) return;
  nodeEl.dataset.state = colorState;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initMatrix() {
  _bodyEl   = document.getElementById('matrix-body');
  _boardEl  = document.getElementById('matrix-board');
  _statusEl = document.getElementById('matrix-status-display');

  if (!_bodyEl || !_boardEl) {
    console.warn('[matrix] Missing DOM elements — not initialised.');
    return;
  }

  on('case:loaded',               _onCaseLoaded);
  on('paradox:triggered',         _onParadoxTriggered);
  on('paradox:resolved',          _onParadoxResolved);
  on('chain:completed',           _onChainCompleted);
  on('matrix:connectionAdded',    _onConnectionAdded);
  on('matrix:connectionRemoved',  _onConnectionRemoved);
  on('fragment:redactionToggled', _onRedactionToggled);

  on('matrix:targets', ({ fragmentIds }) => {
    gameState.flags.notepadGateCleared = true;
    _unlockedFragmentId = _currentNodeFragId;
    // Keep matrix-locked so non-target nodes stay dimmed; only targets glow through
    _highlightTargets(fragmentIds);
  });

  on('fragment:load', ({ fragment }) => {
    _bodyEl.querySelectorAll('.matrix-node').forEach(el => el.classList.remove('active'));
    const activeEl = _bodyEl.querySelector(`.matrix-node[data-fragment-id="${fragment.id}"]`);
    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.classList.add('visited'); // visited nodes are always accessible
    }
  });

  _wireDraftListeners();
  _wireInteract();
}

// ─── Expose ───────────────────────────────────────────────────────────────────
Object.assign(window, { initMatrix });

document.addEventListener('DOMContentLoaded', initMatrix);
