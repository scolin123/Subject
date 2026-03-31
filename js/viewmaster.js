'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let _contentEl   = null;
let _controlsEl  = null;
let _idDisplayEl = null;

// ─── Active audio timers (cleared on fragment change) ─────────────────────────
let _audioTimers = [];

// ─── Fragment history (for prev / next navigation) ────────────────────────────
let _history = [];
let _cursor  = -1;

// ─── Renderers ────────────────────────────────────────────────────────────────

function _renderDocument(fragment) {
  const el = document.createElement('div');
  el.className = 'fragment-document';

  // Double newline = paragraph break; single newline = line break within para
  fragment.content.split(/\n\n+/).forEach(block => {
    const p = document.createElement('p');
    block.split('\n').forEach((line, i) => {
      if (i > 0) p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode(line));
    });
    el.appendChild(p);
  });
  return el;
}

function _renderDatalog(fragment) {
  const el = document.createElement('div');
  el.className = 'fragment-datalog';
  el.textContent = fragment.content;
  return el;
}

function _renderImage(fragment) {
  const wrap = document.createElement('div');

  const img = document.createElement('img');
  img.className = 'fragment-image';
  img.src = fragment.src;
  img.alt = fragment.title;
  wrap.appendChild(img);

  // Caption from content field if present
  if (fragment.content) {
    const caption = document.createElement('div');
    caption.className = 'fragment-datalog';
    caption.style.marginTop = 'var(--space-3)';
    caption.textContent = fragment.content;
    wrap.appendChild(caption);
  }
  return wrap;
}

function _renderAudio(fragment) {
  const el = document.createElement('div');
  el.className = 'fragment-audio';

  // Static waveform placeholder
  const waveform = document.createElement('canvas');
  waveform.className = 'audio-waveform';
  el.appendChild(waveform);

  // Transcript with timed line reveal
  if (fragment.transcript && fragment.transcript.length) {
    const transcriptEl = document.createElement('div');
    transcriptEl.className = 'audio-transcript';

    fragment.transcript.forEach((text, i) => {
      const line = document.createElement('p');
      line.textContent = text;
      transcriptEl.appendChild(line);
      _audioTimers.push(setTimeout(() => line.classList.add('line-revealed'), 600 + i * 800));
    });

    el.appendChild(transcriptEl);
  }

  // Let audioEngine handle playback
  dispatch('audio:play', { src: fragment.src, fragmentId: fragment.id });
  return el;
}

// ─── Build full fragment element ──────────────────────────────────────────────

function _buildFragmentEl(fragment) {
  const wrapper = document.createElement('div');
  wrapper.className = 'fragment-wrapper';
  wrapper.dataset.fragmentId = fragment.id;

  const tag = document.createElement('span');
  tag.className = 'fragment-type-tag';
  tag.textContent = fragment.type.replace(/_/g, ' ');
  wrapper.appendChild(tag);

  let body;
  switch (fragment.type) {
    case 'document':    body = _renderDocument(fragment); break;
    case 'datalog':     body = _renderDatalog(fragment);  break;
    case 'still_image': body = _renderImage(fragment);    break;
    case 'audio':       body = _renderAudio(fragment);    break;
    default:
      body = document.createElement('div');
      body.className = 'fragment-datalog';
      body.textContent = fragment.content || '[NO CONTENT]';
  }
  wrapper.appendChild(body);
  return wrapper;
}

// ─── Display a fragment with enter transition ─────────────────────────────────

function _showFragment(fragment) {
  const existing = _contentEl.firstElementChild;

  const _display = () => {
    _audioTimers.forEach(clearTimeout);
    _audioTimers = [];
    _contentEl.innerHTML = '';

    const el = _buildFragmentEl(fragment);
    el.classList.add('fragment-enter');
    _contentEl.appendChild(el);

    void el.offsetWidth; // force reflow so transition fires
    el.classList.add('fragment-enter-active');

    if (_idDisplayEl) _idDisplayEl.textContent = fragment.id.toUpperCase();
  };

  if (existing) {
    existing.style.transition = 'opacity 0.15s ease';
    existing.style.opacity = '0';
    setTimeout(_display, 150);
  } else {
    _display();
  }
}

// ─── Navigation controls ──────────────────────────────────────────────────────

function _updateControls() {
  if (!_controlsEl) return;
  _controlsEl.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'frag-nav-btn';
  prevBtn.textContent = '← PREV';
  prevBtn.disabled = _cursor <= 0;
  prevBtn.addEventListener('click', () => {
    _cursor--;
    _showFragment(_history[_cursor]);
    _updateControls();
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'frag-nav-btn';
  nextBtn.textContent = 'NEXT →';
  nextBtn.disabled = _cursor >= _history.length - 1;
  nextBtn.addEventListener('click', () => {
    _cursor++;
    _showFragment(_history[_cursor]);
    _updateControls();
  });

  const counter = document.createElement('span');
  counter.style.cssText = [
    'font-size: var(--text-2xs)',
    'color: var(--c-phosphor-mute)',
    'letter-spacing: var(--tracking-wide)',
    'margin-left: auto',
    'align-self: center',
  ].join(';');
  counter.textContent = _history.length ? `${_cursor + 1} / ${_history.length}` : '';

  _controlsEl.appendChild(prevBtn);
  _controlsEl.appendChild(nextBtn);
  _controlsEl.appendChild(counter);
}

// ─── Handle incoming fragment load ───────────────────────────────────────────

function _onFragmentLoad({ fragment }) {
  // Navigating back then choosing a new path: drop forward history
  _history = _history.slice(0, _cursor + 1);
  _history.push(fragment);
  _cursor = _history.length - 1;

  _showFragment(fragment);
  _updateControls();
}

// ─── Idle / waiting state ─────────────────────────────────────────────────────

function _showIdle(caseTitle) {
  _contentEl.innerHTML = '';

  const el = document.createElement('div');
  el.style.cssText = [
    'padding: var(--space-5)',
    'color: var(--c-phosphor-mute)',
    'font-family: var(--font-terminal)',
    'font-size: var(--text-xs)',
    'letter-spacing: var(--tracking-wide)',
  ].join(';');
  el.textContent = caseTitle
    ? `// ${caseTitle.toUpperCase()} — AWAITING FIRST NOTATION`
    : '// AWAITING FRAGMENT';

  _contentEl.appendChild(el);
  if (_idDisplayEl) _idDisplayEl.textContent = '—';
  _updateControls();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initViewmaster() {
  _contentEl   = document.getElementById('viewmaster-content');
  _controlsEl  = document.getElementById('viewmaster-controls');
  _idDisplayEl = document.getElementById('fragment-id-display');

  if (!_contentEl) {
    console.warn('[viewmaster] Missing DOM elements — not initialised.');
    return;
  }

  on('fragment:load', _onFragmentLoad);

  on('case:loaded', ({ caseData }) => {
    _history = [];
    _cursor  = -1;
    _showIdle(caseData.title);
  });
}

// ─── Expose ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  initViewmaster,
});

document.addEventListener('DOMContentLoaded', initViewmaster);
