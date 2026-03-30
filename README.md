# SUBJECT
### A Memory Audit

> *"More human than human."*

Inspired by the fragmented narrative of **Memento** and the existential atmosphere of **Blade Runner 2049**, Null Hypothesis is a high-stakes investigation game where the player acts as a **Memory Auditor** — reconstructing broken memory fragments to determine if a subject is Human or Sim.

The ultimate horror? The subject being analyzed is you.

---

## The Premise

You are an employee of a megacorporation. Your job is to audit memory logs and render verdicts. As each case progresses, the clues become personal. The serial number on someone's neck starts to look familiar. The biological impossibility in the evidence starts to feel close to home.

The game shifts from detective mystery to survival puzzle without you noticing the moment it happens.

Inspired by Blade runner 2049, Memento, and Detroit: Becoming human.

---

## How It's Played

The game is played entirely through a **brutalist data terminal** — no movement, no inventory, no traditional UI. Three panes, one screen.

| Pane | Name | Function |
|------|------|----------|
| Left | The Viewmaster | Browse fragmented memory clips and still images |
| Center | The Brain | Drag-and-drop Logic Matrix — connect fragments with verified anchors |
| Right | The Witness | Your notepad — tag clues, track evidence, redact if you dare |

### Core Mechanics

**Sensory Anchors** — details embedded in fragments (a car colour, a timestamp, a song) that serve as the logical glue between nodes. You cannot connect Fragment A to Fragment B without a valid shared anchor.

**Retrocausal Logic** — you often begin with the result and must justify the cause. The timeline is yours to reconstruct.

**The Redaction Mechanic** — in the late game, you can cross out incriminating clues from your notepad to protect a subject. Every redaction raises your System Detection score. Get caught and the corporation knows.

---

## The Cases

Each case is a self-contained audit with its own subject, story, and 8 possible endings.

| # | Case | Subject | Central Question |
|---|------|---------|-----------------|
| 01 | **The Broken Hand** | A security guard | Did he lie about his location — or is it something worse? |
| 02 | **The Composer** | A musician | Did she plagiarize a dead man's work — or was he never dead? |
| 03 | **The Witness** | A tribunal testifier | Are the contradictions in her memory human error or Sim degradation? |
| 04 | **The Lover** | Two people | One is human. One is a Sim. Can you tell which is which — and does it matter? |
| 05 | **The Architect** | A city planner | Did he approve a building he knew would collapse — or was he the last person who tried to stop it? |

---

## The Endings

Your verdict is determined by two tracked scores across the audit:

- **Compliance Score** — logical precision, efficient processing, corporate loyalty
- **Empathy Score** — humanizing data, protecting subjects, emotional reasoning

Each case has **8 unique endings**. There are **40 endings total** across all 5 cases.

| Ending | Identity | Condition | Outcome |
|--------|----------|-----------|---------|
| The Savior | Auditor | High Empathy | You exonerate the subject. You remain a cog. |
| The Executioner | Auditor | High Compliance | You retire the subject. You are promoted. |
| The Tragedy | Subject | High Compliance | You logically prove you are a Sim. You are retired. |
| The Awakening | Subject | High Sabotage | You delete your footprint. You escape into the city. |
| The Martyr | Subject | Data Overload | You delete the corporate database — and yourself. |
| The Loop | Trapped | Paradox | Your memory is wiped. The game restarts. |
| The Symbiote | Digital | Data Merge | You lose your body. You become the city's OS. |
| The Mercenary | Auditor | Fabricated Data | You frame an innocent for a corporate payout. |

Completing all 8 endings in a single case unlocks a fully unredacted **Audit File** — a piece of lore that recontextualises everything you just played.

---

## Tech Stack

- **HTML / CSS / JavaScript** — vanilla, no framework
- **Interact.js** — drag-and-drop for the Logic Matrix
- **Tone.js** — procedural ambient synth audio, reactive to game state
- **localStorage** — persistent save state across sessions

---

## File Structure

```
null-hypothesis/
│
├── index.html
├── style/
│   ├── tokens.css
│   ├── terminal.css
│   └── components.css
│
├── js/
│   ├── gameState.js
│   ├── caseLoader.js
│   ├── anchorSystem.js
│   ├── matrix.js
│   ├── notepad.js
│   ├── viewmaster.js
│   ├── endingTracker.js
│   └── audioEngine.js
│
├── cases/
│   ├── broken-hand.json
│   └── ...
│
├── endings/
│   ├── savior.html
│   ├── executioner.html
│   └── ... (8 total)
│
└── assets/
    ├── audio/
    └── img/
```

---

## Development Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| 00 | Repo setup, gameState, CSS tokens | Weeks 1–2 |
| 01 | Terminal shell — 3-pane layout, CRT effects | Weeks 2–5 |
| 02 | Core mechanics — Notepad, Matrix, Anchor System | Weeks 5–9 |
| 03 | Case 01: The Broken Hand — full playable case | Weeks 9–12 |
| 04 | Ending engine — scoring, redaction, 8 endings | Weeks 12–14 |
| 05 | Audio & atmosphere — synth, SFX, rain | Weeks 14–16 |
| 06 | Polish, playtesting, deploy | Weeks 16–18 |

---

## Visual Style

- **4:3 aspect ratio** CRT monitor inside a dark, rain-soaked office
- Brutalist UI — phosphor green on black, high-contrast stills, mechanical typography
- **Audio:** lo-fi synth drones, mechanical typing, rain on glass, detection alarms

---

*AUDITCORP INTERNAL // DOCUMENT CLASS: PUBLIC // SUBJECT v0.1*