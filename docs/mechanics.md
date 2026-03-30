# MECHANICS
### Subject — System Design Document

> This document covers the mechanical systems not defined in CHECKPOINTS.md. Reference this alongside CHECKPOINTS.md when building the core JS modules. Together they constitute the full technical design of the game.

---

## The Three Panes

The entire game is played through a single terminal screen divided into two active panes and one ambient desk environment. No navigation, no menus, no separate pages. Everything is injected into this shell.

| Pane | ID | Module | Primary Function |
|------|----|--------|-----------------|
| Left | `#viewmaster` | viewmaster.js | Displays the current fragment — image, document, or audio log |
| Center | `#matrix` | matrix.js | The Logic Matrix — drag-and-drop node board |
| Desk | `#desk` | notepad.js | The physical environment below the terminal — notepad sits here |

The right pane from the original 3-pane design has been removed. The notepad is no longer a terminal pane — it is a physical object on the desk that the player interacts with directly. See **The Notepad** section below.

Panes communicate exclusively through gameState. No module talks directly to another module. All state changes go through gameState and trigger re-renders via a central `render()` call.

---

## The Viewmaster

The left pane displays one fragment at a time. Fragments are loaded from the active case JSON file by caseLoader.js.

### Fragment Types

| Type | Display Format | Notes |
|------|---------------|-------|
| Document | Styled text render — typewriter font, aged paper texture | Scrollable if long |
| Still image | Full pane image — high contrast, noir palette | No zoom |
| Audio log | Waveform visualiser + transcript below | Transcript revealed line by line as audio plays |
| Data log | Terminal-style readout — monospace, green on black | Mimics raw system output |

### Fragment Sequencing

Fragments are not shown in a fixed order. The active fragment pool is determined by the player's current scores and the prompts they choose.

```javascript
// Each case JSON defines fragments as:
{
  "id": "fragment-03",
  "type": "still_image",
  "src": "/assets/img/broken-hand/medical-bay.jpg",
  "checkpoint": 3,
  "conditional": false,        // if true, only surfaces when score threshold is met
  "condition_score": null,     // e.g. { "empathy": 15 } — surfaces if empathy >= 15
  "anchor_ids": ["anchor-02", "anchor-04"]  // anchors embedded in this fragment
}
```

**Mandatory fragments** — always shown regardless of score. These are the core evidence trail.

**Conditional fragments** — only surface when the player's score crosses a threshold. These include the hidden Auditor identity fragment, deeper evidence trails, and the fragments required for The Tragedy, The Symbiote, and The Loop endings.

**The hidden Auditor fragment** — present in every case JSON but never listed in the mandatory pool. It surfaces only if the player's empathy or compliance score crosses +30 at checkpoint 5, or if the player navigates to it through a specific hidden prompt chain.

---

## The Logic Matrix

The center pane is a node-based flowchart. Players drag fragment cards onto the board and connect them by drawing lines between nodes. The board represents the player's current theory of the case.

### Node Structure

Each fragment card placed on the board becomes a node. Nodes have:

- A title (fragment ID + type label)
- A small thumbnail or text preview
- Connection points on left and right edges
- A colour state: unconnected (grey), connected (green), flagged (amber), paradox (red)

### Connection Rules

Two nodes can only be connected if they share a valid **Anchor**. Anchors are logical links embedded in fragment content — a timestamp, a location, a name, a biological marker — that are verified by anchorSystem.js.

```javascript
// anchorSystem.js — core validation function
function canConnect(fragmentA, fragmentB) {
  const anchorsA = fragmentA.anchor_ids;
  const anchorsB = fragmentB.anchor_ids;
  const sharedAnchors = anchorsA.filter(id => anchorsB.includes(id));
  return sharedAnchors.length > 0;
}
```

If the player attempts to connect two nodes with no shared anchor, the connection line snaps back and the terminal displays a brief rejection message in the lower status bar: *"ANCHOR VERIFICATION FAILED — NO LOGICAL LINK CONFIRMED."*

### Valid Connection Flow

A valid connection:
1. Player drags a line from Node A to Node B
2. anchorSystem.js checks for shared anchors
3. If valid: connection renders as a solid green line, both nodes turn green
4. gameState records the connection
5. If this connection satisfies a fragment chain condition, new fragments may unlock

### The Paradox State

A paradox is triggered when the player connects two fragments that are mutually exclusive — verified facts that cannot both be true simultaneously.

Paradox pairs are defined in the case JSON:

```javascript
"paradox_pairs": [
  ["fragment-02", "fragment-03"]  // server wing scan + medical bay camera
]
```

When both fragments in a paradox pair are connected to the same chain:
1. Both nodes turn red
2. The status bar displays: *"LOGICAL CONTRADICTION DETECTED — CHAIN INTEGRITY COMPROMISED."*
3. The matrix pulses red once
4. gameState.flags.paradoxTriggered is set to true
5. The case cannot be resolved normally — the only available action is to submit the audit, which triggers The Loop ending

The player can disconnect one of the nodes to resolve the paradox and continue. If they submit while the paradox flag is active, The Loop fires regardless of all other scores.

### The Full Chain Condition

The Symbiote ending requires the player to chain every fragment — including conditional and hidden ones — into a single unbroken sequence. This is tracked by anchorSystem.js:

```javascript
function checkFullChain() {
  const allFragments = gameState.loadedFragments;
  const connectedFragments = gameState.matrix.connections;
  const allConnected = allFragments.every(f => connectedFragments.includes(f.id));
  if (allConnected) gameState.flags.fullChainCompleted = true;
}
```

This condition is extremely difficult to meet because the hidden Auditor fragment must also be found and connected. Most players will never trigger it accidentally.

---

## The Notepad

The notepad is a physical object sitting on the desk below the terminal. It is not part of the terminal UI. It belongs to the player, not the corporation — this distinction is intentional and should be felt.

### Layout

The full screen is divided into two vertical zones:

- **Top 75%** — the terminal (Viewmaster + Matrix)
- **Bottom 25%** — the desk environment (physical notepad, coffee cup, ambient objects)

The desk is always visible beneath the terminal. The notepad sits slightly angled on the desk, a pen resting across it.

### Opening the Notepad

When a checkpoint gate triggers, the notepad pulses with a faint warm glow — the only warm-toned light in an otherwise cold green-and-black interface. The status bar displays Voss's notation prompt. The player clicks the notepad.

**The animation sequence:**
1. The terminal dims slightly — background recedes, brightness drops to ~60%
2. The notepad animates upward from the desk, scaling up and centering on screen
3. It rotates very slightly to feel hand-held — a few degrees off true horizontal
4. The page comes into focus — lined paper texture, handwritten-style font ready for input
5. A cursor blinks on the first line

This is handled entirely with CSS transforms and transitions:

```css
#notepad {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%) rotate(-2deg) scale(0.3);
  transform-origin: bottom center;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
              bottom 0.5s ease;
  cursor: pointer;
  z-index: 10;
}

#notepad.open {
  bottom: 50%;
  transform: translateX(-50%) translateY(50%) rotate(-1deg) scale(1);
  z-index: 100;
}

#terminal-overlay {
  transition: opacity 0.4s ease;
}

#terminal-overlay.dimmed {
  opacity: 0.6;
  pointer-events: none;
}
```

### Writing in the Notepad

When open, the notepad fills the center of the screen. The player types directly onto the page. The font is a handwritten-style typeface — warm, slightly irregular, nothing like the terminal's monospace.

The page has:
- Lined paper texture
- A header showing the current case name and checkpoint number in small printed text — as if pre-stamped
- A freeform text area below the header
- A subtle ink-bleed effect as the player types
- Previous checkpoint entries visible above the current entry as faded, slightly smudged text — readable but clearly older

### Submitting the Entry

The player closes the notepad by clicking a small stamped button at the bottom of the page labelled **FILE** — styled as a rubber stamp impression, not a digital button. This reinforces that the action belongs to the physical world, not the terminal.

On submit:
1. The notepad animates back down to the desk — reverse of the open animation
2. The terminal returns to full brightness
3. The entry is stored in gameState.notepadEntries
4. The API sentiment call fires
5. The checkpoint advance becomes available

The notepad gate check runs on the text area content before the FILE stamp becomes active:

```javascript
function checkNotepadGate() {
  const entry = document.getElementById('notepad-textarea').value.trim();
  const meetsMinimum = entry.length >= 20;
  document.getElementById('notepad-file-btn').classList.toggle('active', meetsMinimum);
}
```

If the player tries to stamp before 20 characters are written, the stamp does not respond. No error message. The in-world framing: you simply haven't written enough yet.

### Entry Storage

Every notepad entry is stored in gameState.notepadEntries as an array of objects:

```javascript
{
  checkpoint: 2,
  text: "The access card scan doesn't add up. Someone else could have used it.",
  timestamp: 1701234567890,
  scores_at_time: { empathy: 8, compliance: -3, sabotage: 0, detection: 0 }
}
```

Entries are never deleted within a case session. Voss reads the full cumulative log, not just the most recent entry.

### The Redaction Tool

From checkpoint 3 onward a second rubber stamp appears at the bottom of the notepad page, labelled **REDACT** in red. No explanation is given.

In redaction mode the player uses a pen-stroke gesture to cross out any previous entry on the notepad page. The crossed-out text renders as a thick black horizontal bar — identical to a physical document redaction. The gesture is a click-and-drag across the text.

Redaction is a physical act on a physical object. It feels deliberate and irreversible — because it is.

**What redaction actually does:**

- Crossing out a notepad entry: removes that entry from the next API sentiment call. The score delta from that checkpoint is not reversed — only future reads are affected.
- Each redaction increments Sabotage by 1 and Detection by 1.
- Redacting an entry that references a flagged fragment increments Detection by 2 instead of 1.

**Detection consequences:**

| Detection Score | Event |
|----------------|-------|
| 3 | Status bar flickers. Voss sends a memo: *"Operator log discrepancies noted. Ensure complete notation."* |
| 5 | Terminal dims slightly. A low sustained tone enters the audio beneath the ambience. |
| 7 | Voss sends a second memo: *"System irregularities detected in your audit file. Corporate review initiated."* |
| 9 | The REDACT stamp disappears from the notepad. No further redactions are possible. |
| 10 | The case auto-closes. Ending resolves immediately from current score state. |

### Lifting a Redaction

The player can un-redact by clicking a crossed-out entry again. The bar lifts. Sabotage and Detection scores already accumulated do not decrease. There is no take-back.

### The Notepad on the Desk

When closed the notepad sits on the desk with visible pen strokes on the open page — a faint preview of the player's most recent entry rendered in the desk view. As the case progresses and more entries are filed, the visible page fills with increasingly dense handwriting. By checkpoint 5 the page should look used — full, lived-in, the physical record of everything the player thought.

This is purely visual but it matters. The notepad is the one object in the game that accumulates evidence of the player's presence.

---

## The Fragment Pool System

Each case JSON contains all fragments for that case — mandatory, conditional, and hidden. caseLoader.js builds the active pool at case start and updates it as conditions are met.

### Pool Structure

```javascript
// caseLoader.js — builds active fragment pool
function buildFragmentPool(caseData) {
  const pool = {
    mandatory: caseData.fragments.filter(f => !f.conditional),
    conditional: caseData.fragments.filter(f => f.conditional),
    active: []
  };

  // Always load mandatory fragments
  pool.active = [...pool.mandatory];

  // Check conditional fragments against current scores
  pool.conditional.forEach(fragment => {
    if (meetsCondition(fragment.condition_score)) {
      pool.active.push(fragment);
    }
  });

  gameState.loadedFragments = pool.active;
  return pool;
}

function meetsCondition(condition) {
  if (!condition) return false;
  return Object.entries(condition).every(([score, threshold]) => {
    return gameState.scores[score] >= threshold;
  });
}
```

The pool is rebuilt after every checkpoint. Fragments that become available mid-case appear in the Viewmaster queue with a brief status bar notification: *"NEW EVIDENCE SURFACED — AUDIT QUEUE UPDATED."*

---

## The In-World Justification Layer

Everything mechanical has an in-world explanation. The player should never encounter a UI element that breaks the fiction of operating a corporate terminal.

| Mechanic | In-World Framing |
|----------|-----------------|
| Notepad gate | Director Voss's mandatory notation protocol — the stamp won't activate without sufficient notation |
| Physical notepad on desk | Your personal log — not corporate property, not monitored (or so it seems) |
| Hidden prompts | Deeper system access unlocked by audit clearance level |
| Score tracking | AuditCorp's internal operator performance metrics |
| Detection counter | Corporate compliance monitoring system |
| Fragment pool updates | Evidence queue managed by the case management system |
| Paradox state | Logical integrity check built into the audit framework |
| The advance button | Standard audit workflow — each step requires sign-off |
| Redaction stamp | Standard document handling protocol |

No UI element is labelled with mechanical terminology. There are no score meters, no empathy bars, no compliance indicators anywhere on screen. The only numbers the player ever sees are in fragment content — timestamps, file numbers, case IDs.

---

## The Save System

Game state is persisted to localStorage at the following trigger points:

- After every checkpoint is completed
- After every redaction
- After every fragment is connected in the matrix
- When an ending is reached and recorded

### What Is Saved

```javascript
function saveToLocalStorage() {
  const saveData = {
    currentCase: gameState.currentCase,
    currentCheckpoint: gameState.currentCheckpoint,
    scores: gameState.scores,
    flags: gameState.flags,
    completedEndings: gameState.completedEndings,
    vossUnlocked: gameState.vossUnlocked,
    notepadEntries: gameState.notepadEntries,
    matrixConnections: gameState.matrix.connections
  };
  localStorage.setItem('subject-save', JSON.stringify(saveData));
}
```

### What Is Not Saved

The full fragment content and case JSON are not saved to localStorage — they are loaded fresh from the case files on each session. Only the player's progress state and scores are persisted.

### Save Load on Boot

On page load, index.html checks for an existing save:

```javascript
function loadSave() {
  const raw = localStorage.getItem('subject-save');
  if (!raw) return initNewGame();
  const save = JSON.parse(raw);
  Object.assign(gameState, save);
  resumeFromSave();
}
```

If a save exists the player is returned to exactly where they left off — same checkpoint, same matrix state, same notepad entries.

### Clearing a Save

No in-game clear option is provided by default. A player who wants to restart must clear localStorage manually via the browser. This is intentional — the game does not offer an easy escape from a playthrough in progress.

An optional developer reset can be toggled in index.html for testing:

```javascript
// Set to true during development only
const DEV_RESET_ON_LOAD = false;
if (DEV_RESET_ON_LOAD) localStorage.removeItem('subject-save');
```

---

## The Boot Sequence

On first load — or after a manual save clear — the terminal runs a boot animation before the title screen appears. This is handled entirely in CSS and a small JS timer.

The boot sequence displays:

```
AUDITCORP TERMINAL v4.1.2
INITIALIZING OPERATOR SESSION...
LOADING CASE MANAGEMENT SYSTEM...
VERIFYING OPERATOR CREDENTIALS...
CREDENTIALS CONFIRMED.
WELCOME, OPERATOR.
DIRECTOR VOSS HAS ASSIGNED YOUR FIRST CASE.
PROCEED WHEN READY.
```

Each line types out with a small delay. The cursor blinks between lines. The whole sequence runs in approximately 6 seconds and cannot be skipped on first load. On subsequent loads it is reduced to 2 seconds.

---

## Audio Triggers

audioEngine.js manages all audio layers. The following game events trigger audio changes:

| Event | Audio Response |
|-------|---------------|
| Game boot | Synth drone fades in — low, sustained |
| Fragment loads | Brief CRT static burst |
| Notepad opened | Soft paper rustle — warm, analogue |
| Notepad closed / filed | Rubber stamp thud — satisfying, definitive |
| Notepad gate cleared | Single mechanical key click |
| Redaction stroke | Pen scratch SFX — heavy, deliberate |
| Valid matrix connection | Soft confirmation tone |
| Invalid connection attempt | Short negative tone |
| Paradox triggered | Rising dissonant chord — sustained until resolved |
| Detection 3 | Secondary low tone enters the ambience mix |
| Detection 5 | Ambience shifts — drone becomes slightly higher and more tense |
| Detection 7 | Third tone layer enters — three-note unresolved chord |
| Ending reached | All ambient audio cuts — ending-specific audio plays |
| Case 00 boot | Silence. Then a single tone, warmer than anything heard before. |

Audio layers are managed by Tone.js. All drones and tension music are generated procedurally — no audio files required for ambience. Only SFX (typing, static, pen scratch) use audio files.

---

*SUBJECT — MECHANICS.md // System design for all core modules // Complete*