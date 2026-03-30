# MECHANICS
### Subject — System Design Document

> This document covers the mechanical systems not defined in CHECKPOINTS.md. Reference this alongside CHECKPOINTS.md when building the core JS modules. Together they constitute the full technical design of the game.

---

## The Three Panes

The entire game is played through a single terminal screen divided into three panes. No navigation, no menus, no separate pages. Everything is injected into this shell.

| Pane | ID | Module | Primary Function |
|------|----|--------|-----------------|
| Left | `#viewmaster` | viewmaster.js | Displays the current fragment — image, document, or audio log |
| Center | `#matrix` | matrix.js | The Logic Matrix — drag-and-drop node board |
| Right | `#witness` | notepad.js | The player's notepad — freeform text entry and redaction tool |

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

The right pane is a freeform text editor. The player writes whatever they want. There are no prompts inside the notepad itself — it is a blank field with a typewriter font and a subtle paper texture.

### Notepad Gate

The notepad gate prevents the player from advancing to the next checkpoint until a minimum entry has been made. This is the primary mechanic for ensuring note-taking.

```javascript
function checkNotepadGate() {
  const entry = document.getElementById('notepad-input').value.trim();
  const meetsMinimum = entry.length >= 20;
  document.getElementById('advance-btn').disabled = !meetsMinimum;
}
```

The advance button is greyed out and non-functional until 20 characters are present. No explanation is given in the UI. The in-world justification is the status bar message that appears when the player tries to advance too early:

*"NOTATION INCOMPLETE — DIRECTOR VOSS REQUIRES OPERATOR LOG BEFORE PROCEEDING."*

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

In the late game — available from checkpoint 3 onward — a redaction tool becomes available in the notepad pane. It appears as a small button labelled **REDACT** with no explanation of what it does.

Clicking REDACT enters redaction mode. In redaction mode the player can click on any saved notepad entry or any fragment card in the matrix to strike it through with a thick black bar — visually identical to a physical document redaction.

**What redaction actually does:**

- Striking through a notepad entry: removes that entry from the next API sentiment call. The score delta from that checkpoint is not reversed — only future reads are affected.
- Striking through a fragment card: removes that fragment from the active connection pool. It cannot be connected to other nodes until the redaction is lifted.
- Each redaction increments Sabotage by 1 and Detection by 1.
- Redacting a fragment that has already been flagged by the system increments Detection by 2 instead of 1.

**Detection consequences:**

| Detection Score | Event |
|----------------|-------|
| 3 | Status bar flickers briefly. Voss sends a memo: *"Operator log discrepancies noted. Ensure complete notation."* |
| 5 | The terminal screen dims slightly. Audio: a low, sustained tone beneath the ambience. |
| 7 | Voss sends a second memo: *"System irregularities detected in your audit file. Corporate review initiated."* |
| 9 | The REDACT button disappears. No further redactions are possible. |
| 10 | The case auto-closes. Ending resolves immediately from current score state — no checkpoint 5 prompt. |

Detection reaching 10 before the player finishes the case is the only forced ending trigger in the game. It does not guarantee a specific ending — it just resolves whatever the current scores produce, which at high sabotage is likely The Awakening or The Mercenary.

### Lifting a Redaction

The player can un-redact an entry or fragment by clicking it again in redaction mode. Sabotage and Detection scores already accumulated do not decrease. This means redacting and immediately un-redacting something still costs the player score — there is no take-back.

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
| Notepad gate | Director Voss's mandatory notation protocol |
| Hidden prompts | Deeper system access unlocked by audit clearance level |
| Score tracking | AuditCorp's internal operator performance metrics |
| Detection counter | Corporate compliance monitoring system |
| Fragment pool updates | Evidence queue managed by the case management system |
| Paradox state | Logical integrity check built into the audit framework |
| The advance button | Standard audit workflow — each step requires sign-off |

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
| Notepad gate cleared | Single mechanical key click |
| Valid matrix connection | Soft confirmation tone |
| Invalid connection attempt | Short negative tone |
| Paradox triggered | Rising dissonant chord — sustained until resolved |
| Redaction made | Pen scratch SFX |
| Detection 3 | Secondary low tone enters the ambience mix |
| Detection 5 | Ambience shifts — drone becomes slightly higher and more tense |
| Detection 7 | Third tone layer enters — three-note unresolved chord |
| Ending reached | All ambient audio cuts — ending-specific audio plays |
| Case 00 boot | Silence. Then a single tone, warmer than anything heard before. |

Audio layers are managed by Tone.js. All drones and tension music are generated procedurally — no audio files required for ambience. Only SFX (typing, static, pen scratch) use audio files.

---

*SUBJECT — MECHANICS.md // System design for all core modules // Complete*