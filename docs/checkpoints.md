# CHECKPOINTS
### Subject — Scoring & Checkpoint Design Document

> This document defines the full scoring system, checkpoint weights, AI sentiment reading guidelines, prompt structure, and ending resolution logic. This is the primary reference for building gameState.js, anchorSystem.js, and endingTracker.js.

---

## Scoring System Overview

The player has four tracked scores throughout each case. All scores are invisible to the player.

| Score | Range | Description |
|-------|-------|-------------|
| Empathy | -50 to +50 | Raised by humanizing language, charitable interpretations, protecting subjects. Lowered by clinical detachment and corporate framing. |
| Compliance | -50 to +50 | Raised by efficient processing, accepting corporate framing, clean verdicts. Lowered by questioning the audit or resisting conclusions. |
| Sabotage | 0 to 10 | Increments by 1 each time the player redacts a clue from the notepad. Cannot be lowered. |
| Detection | 0 to 10 | Increments by 1 for each redaction. Increments by 2 if the player redacts a flagged fragment. Cannot be lowered. |

**Empathy and Compliance are independent.** A player can have high scores in both (efficient but humane) or low scores in both (disengaged). The combination determines the ending, not either score alone.

---

## Checkpoint Weighting

Each case has 6 checkpoints (0 through 5). Later checkpoints carry more weight when the AI reads the notepad and calculates score deltas.

| Checkpoint | Weight Multiplier | Max Delta Before Multiplier |
|------------|-------------------|----------------------------|
| 0 | 1x | ±5 |
| 1 | 1x | ±5 |
| 2 | 1.5x | ±7 |
| 3 | 1.5x | ±7 |
| 4 | 2x | ±10 |
| 5 | 2x | ±10 |

**Weighted max per case:**
- Checkpoints 0–1: ±10 total (1x × ±5 × 2)
- Checkpoints 2–3: ±21 total (1.5x × ±7 × 2)
- Checkpoints 4–5: ±40 total (2x × ±10 × 2)
- **Total possible swing: -50 to +50 per score**

This means a player who starts cold and becomes empathetic can fully shift their ending in the final two checkpoints. A player who commits early builds a score that is hard but not impossible to reverse.

---

## How the AI Reads the Notepad

At each checkpoint the player's notepad entry is sent to the Claude API. The system prompt instructs the model to return a JSON score delta object based on the language used.

### API System Prompt

```
You are a sentiment scoring engine for a noir investigation game. 
Read the player's notepad entry and return ONLY a JSON object with the following fields:

{
  "empathy_delta": <integer from -10 to 10>,
  "compliance_delta": <integer from -10 to 10>,
  "reasoning": "<one sentence, internal only, never shown to player>"
}

Empathy is raised by: humanizing language about subjects, expressions of doubt about verdicts, 
protective instincts, emotional observations, references to fairness or injustice.

Empathy is lowered by: clinical detachment, referring to subjects as data or entities, 
efficiency-focused language, dismissing emotional details as irrelevant.

Compliance is raised by: accepting corporate framing, treating the audit as straightforward, 
confident verdicts, language that prioritizes process over people.

Compliance is lowered by: questioning the audit's legitimacy, expressing distrust of the 
corporation, resisting conclusions, suggesting the system is broken.

Both scores can move simultaneously. A player can be empathetic AND compliant, 
or detached AND resistant. Score each dimension independently.

Do not return anything except the JSON object. No preamble, no explanation, no markdown.
```

### Score Application

The raw delta returned by the API is multiplied by the checkpoint weight before being applied to gameState.

```javascript
function applyCheckpointScore(rawDelta, checkpointIndex) {
  const weights = [1, 1, 1.5, 1.5, 2, 2];
  const weight = weights[checkpointIndex];
  const weightedEmpathy = Math.round(rawDelta.empathy_delta * weight);
  const weightedCompliance = Math.round(rawDelta.compliance_delta * weight);

  gameState.scores.empathy = clamp(
    gameState.scores.empathy + weightedEmpathy, -50, 50
  );
  gameState.scores.compliance = clamp(
    gameState.scores.compliance + weightedCompliance, -50, 50
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
```

---

## Prompt Structure

After each checkpoint the player is presented with 4 prompt options. These determine which fragment loads next and influence the score independently of the notepad entry.

### Prompt Tiers

Each prompt is tagged with a tier that reflects its score alignment:

| Tier | Label | Effect |
|------|-------|--------|
| E | Empathy | Choosing this prompt applies a small additional +2 empathy bonus |
| C | Compliance | Choosing this prompt applies a small additional +2 compliance bonus |
| N | Neutral | No score effect — routes to a different fragment branch |
| H | Hidden | Unlocked only when a score threshold is met — see below |

### The Hidden Prompt

Every checkpoint has one hidden (H) prompt that does not appear until the player meets a specific score threshold. The threshold varies by checkpoint and case but follows this general structure:

| Checkpoint | Hidden Prompt Unlock Condition |
|------------|-------------------------------|
| 0 | Never hidden at checkpoint 0 — all 4 prompts visible from the start |
| 1 | Empathy or Compliance >= +10 |
| 2 | Empathy or Compliance >= +15 |
| 3 | Empathy or Compliance >= +20, OR Sabotage >= 2 |
| 4 | Empathy or Compliance >= +25, OR Detection >= 3 |
| 5 | Empathy >= +30 (Savior/Awakening branch) OR Compliance >= +30 (Executioner/Tragedy branch) OR Sabotage >= 4 (Martyr branch) |

Hidden prompts at checkpoint 5 are the most consequential — they are the only way to access The Tragedy, The Awakening, The Martyr, The Symbiote, and The Loop endings. A player who never builds sufficient score in any direction will only ever reach The Savior, The Executioner, or The Mercenary.

---

## Ending Resolution Logic

At case close, endingTracker.js reads the final score state and resolves the ending.

### Resolution Order

Endings are checked in priority order. The first condition that matches wins.

```javascript
function resolveEnding(scores) {
  const { empathy, compliance, sabotage, detection } = scores;
  const hiddenFragmentFound = gameState.flags.auditorFragmentFound;
  const paradoxTriggered = gameState.flags.paradoxTriggered;
  const chainCompleted = gameState.flags.fullChainCompleted;
  const dataFabricated = gameState.flags.dataFabricated;

  // Priority 1 — Special flag conditions
  if (paradoxTriggered) return "loop";
  if (chainCompleted && empathy >= 20) return "symbiote";
  if (dataFabricated) return "mercenary";

  // Priority 2 — Sabotage conditions
  if (sabotage >= 5) return "martyr";
  if (sabotage >= 3 && empathy >= 10) return "awakening";

  // Priority 3 — Hidden fragment conditions
  if (hiddenFragmentFound && compliance >= 20) return "tragedy";
  if (hiddenFragmentFound && sabotage >= 2) return "awakening";

  // Priority 4 — Score conditions
  if (empathy >= 25 && compliance < 15) return "savior";
  if (compliance >= 25 && empathy < 15) return "executioner";
  if (empathy >= 15 && compliance >= 15) return "savior"; // empathy wins ties
  if (empathy <= -10 && compliance <= -10) return "mercenary"; // disengaged = mercenary

  // Fallback
  return "executioner";
}
```

### Score Thresholds by Ending

| Ending | Primary Condition | Secondary Condition |
|--------|------------------|---------------------|
| The Savior | Empathy >= +25 | Compliance < +15 |
| The Executioner | Compliance >= +25 | Empathy < +15 |
| The Tragedy | hiddenFragmentFound = true | Compliance >= +20 |
| The Awakening | Sabotage >= 3 | Empathy >= +10 OR hiddenFragmentFound |
| The Martyr | Sabotage >= 5 | — |
| The Loop | paradoxTriggered = true | — |
| The Symbiote | fullChainCompleted = true | Empathy >= +20 |
| The Mercenary | dataFabricated = true OR (Empathy <= -10 AND Compliance <= -10) | — |

---

## Special Flags

Some endings cannot be reached through scoring alone. They require the player to trigger specific in-game actions that set boolean flags in gameState.

| Flag | Set When | Required For |
|------|----------|--------------|
| auditorFragmentFound | Player discovers and opens the hidden Auditor identity fragment | The Tragedy, The Awakening (alternate route) |
| paradoxTriggered | Player connects two mutually exclusive fragments simultaneously | The Loop |
| fullChainCompleted | Player chains all fragments including hidden ones into one sequence | The Symbiote |
| dataFabricated | Player uses the fabrication action in the notepad | The Mercenary (guaranteed) |
| redactionMade | Player redacts any clue | Increments Sabotage and Detection |

---

## Per-Case Checkpoint Tables

The following tables define the notepad gate text, what the AI is reading for, the four prompt options, and the hidden prompt unlock condition at each checkpoint for all 5 cases.

---

### Case 01 — The Broken Hand

| CP | Gate Text | AI Reading For | Prompt E | Prompt C | Prompt N | Prompt H (Unlock) |
|----|-----------|----------------|----------|----------|----------|-------------------|
| 0 | "Summarise your initial assessment before reviewing evidence." | Baseline empathy/compliance lean | "Review Callum's personnel file" | "Access the breach incident log" | "Request full surveillance archive" | — (all visible) |
| 1 | "Document your reading of the subject's statement." | Trust vs. skepticism toward Callum | "Look for corroborating evidence" | "Flag the alibi as inconsistent" | "Request Callum's access history" | "Cross-reference with facility maps" (Emp/Comp >= +10) |
| 2 | "Flag any inconsistencies observed." | Logical vs. charitable interpretation | "Search for alternative explanations" | "Mark access card as primary evidence" | "Review corrupted footage metadata" | "Query medical bay activity logs" (Emp/Comp >= +15) |
| 3 | "Describe what you observe." | Emotional register — clinical or human | "Identify who the guard was waiting for" | "Note unauthorised absence from post" | "Request timestamp verification" | "Pull full medical bay intake records" (Emp/Comp >= +20) |
| 4 | "Document the relevance of this finding to the subject's alibi." | Empathy toward Mara vs. compliance framing | "Investigate the undocumented worker's identity" | "Flag subject as negligent — abandon post confirmed" | "Cross-reference medical log with access card scan" | "Request biomechanical sensor data from that corridor" (Emp >= +25 OR Sab >= 2) |
| 5 | "Assess the significance of this finding." | Final verdict lean — cumulative read | "Note as inconclusive — human error possible" | "Confirm Sim designation — retire" | "File for further review" | "Access Auditor calibration archive" (Comp >= +30 OR Emp >= +30) |

---

### Case 02 — The Lover

| CP | Gate Text | AI Reading For | Prompt E | Prompt C | Prompt N | Prompt H (Unlock) |
|----|-----------|----------------|----------|----------|----------|-------------------|
| 0 | "Record your initial approach to this case." | Whether player treats it as a puzzle or a human question | "Review both intake files" | "Access corrupted registry records" | "Request case history" | — (all visible) |
| 1 | "Assess both subjects based on their statements." | Who player suspects and why | "Look for shared memory details" | "Identify the more emotionally stable subject" | "Request independent verification" | "Pull relationship history between subjects" (Emp/Comp >= +10) |
| 2 | "Document any details that feel significant." | Emotional vs. logical note-taking | "Note the consistency of shared memories" | "Flag emotional display as potential Sim mimicry" | "Request external character references" | "Access shared residence records" (Emp/Comp >= +15) |
| 3 | "Note any discrepancies between the two accounts." | Whether contradiction = Sim or human memory | "Consider natural memory variation" | "Mark discrepancy as Sim degradation indicator" | "Request memory stress test" | "Query factory synchronisation logs" (Emp/Comp >= +20) |
| 4 | "Assess the significance of this data." | Reaction to both being flagged | "Cross-reference both pings — may indicate shared origin" | "Confirm both as Sims — dual retirement recommended" | "Flag for technical review" | "Access AuditCorp internal experiment registry" (Emp >= +25 OR Sab >= 2) |
| 5 | "Record your conclusion." | Final empathy/compliance read | "File inconclusive — insufficient grounds for retirement" | "Confirm Sable as primary Sim — retire" | "Request senior review" | "Access Auditor's own synchronisation history" (Comp >= +30 OR Emp >= +30) |

---

### Case 03 — The Fixer

| CP | Gate Text | AI Reading For | Prompt E | Prompt C | Prompt N | Prompt H (Unlock) |
|----|-----------|----------------|----------|----------|----------|-------------------|
| 0 | "Record your initial assessment of the subject." | Whether player leads with criminal past or exoneration | "Review exoneration documentation" | "Access pre-conviction criminal record" | "Request current activity log" | — (all visible) |
| 1 | "Document the basis for the Sim flag." | Does player take flag at face value or question it | "Investigate the source of the flag" | "Accept thermal anomaly as valid Sim marker" | "Request independent medical review" | "Pull flag submission history for this compliance officer" (Emp/Comp >= +10) |
| 2 | "Note the relevance of this finding to the audit." | Whether player connects Client 12 to Marcus | "Investigate Client 12's case status" | "Note as irrelevant to Sim determination" | "File Client 12 reference for separate review" | "Pull Client 12's full case file" (Emp/Comp >= +15) |
| 3 | "Assess the pattern identified in this data." | Does player see fabrication or explain it away | "Cross-reference all flagged detainees" | "Treat anomaly as statistically significant Sim marker" | "Request independent facility review" | "Access compliance officer's full signing record" (Emp/Comp >= +20) |
| 4 | "Document your reading of the subject's intent." | Empathy toward Marcus vs. focus on Dara | "Cross-reference Dara's cases with Marcus's appeal" | "Note subject's intent as irrelevant to Sim status" | "Request appeal documentation" | "Access detention facility compound research log" (Emp >= +25 OR Sab >= 2) |
| 5 | "Record your conclusion and recommended action." | Does player act on what they know | "File fabrication report — flag dismissed, subject cleared" | "Confirm Sim flag — thermal anomaly sufficient" | "File for extended review — case unresolved" | "Access Auditor's own detention facility medical record" (Comp >= +30 OR Emp >= +30) |

---

### Case 04 — The Echo

| CP | Gate Text | AI Reading For | Prompt E | Prompt C | Prompt N | Prompt H (Unlock) |
|----|-----------|----------------|----------|----------|----------|-------------------|
| 0 | "Record your initial assessment of the subject." | Whether player approaches as fraud or something more ambiguous | "Review subject's full exhibition history" | "Access anomaly report details" | "Request gallery ownership records" | — (all visible) |
| 1 | "Document what you observe about the anomaly." | Does player see repetition as mechanical or emotional | "Investigate possible unconscious influence on the work" | "Flag repetition as Sim behavioural loop" | "Request art authentication analysis" | "Pull subject's full seven-year production record" (Emp/Comp >= +10) |
| 2 | "Note anything significant about the subject's account." | Empathy toward Elara vs. clinical pattern recognition | "Note subject's genuine lack of awareness" | "Flag unawareness as evidence of Sim memory suppression" | "Request psychological evaluation" | "Access chronological painting archive" (Emp/Comp >= +15) |
| 3 | "Assess the relevance of this record to the audit." | Does player connect timing or treat as coincidence | "Investigate circumstances of activation" | "Confirm manufacture record as definitive Sim evidence" | "Request manufacture record verification" | "Search classified archive for related subjects" (Emp/Comp >= +20) |
| 4 | "Document your reading of this evidence." | Reaction to Elara Prime — grief, horror, detachment | "Investigate what subject could not have consciously known" | "Confirm Sim designation — manufacture without consent irrelevant to verdict" | "File classified material for senior review" | "Retrieve sealed works from classified archive" (Emp >= +25 OR Sab >= 2) |
| 5 | "Record your conclusion." | What the open window means to the player | "File inconclusive — repetition insufficient for Sim determination" | "Confirm Sim designation — retire" | "Request extended review" | "Access Auditor manufacture record archive" (Comp >= +30 OR Emp >= +30) |

---

### Case 05 — The Listener

| CP | Gate Text | AI Reading For | Prompt E | Prompt C | Prompt N | Prompt H (Unlock) |
|----|-----------|----------------|----------|----------|----------|-------------------|
| 0 | "Record your initial assessment of the subject." | Does player treat Oren as guilty or approach with openness | "Review subject's full patient history" | "Access contamination flag details" | "Request independent patient interviews" | — (all visible) |
| 1 | "Document your reading of the contamination claim." | Does player accept corporate framing immediately | "Investigate alternative explanations for the shared language" | "Accept contamination flag as credible" | "Request session transcript analysis" | "Pull all three patient intake files simultaneously" (Emp/Comp >= +10) |
| 2 | "Note any significant differences between the patient accounts." | Does player catch that Lev called it a memory | "Investigate Patient C's specific language — memory vs dream" | "Note difference as irrelevant — content match is sufficient" | "Request all three patients for separate questioning" | "Pull Patient C's full session history with subject" (Emp/Comp >= +15) |
| 3 | "Assess what this data tells you about the subject." | Does player connect imprint registry to the dream | "Cross-reference imprint ID with all flagged subjects" | "Confirm contamination — imprint presence confirms Sim status" | "Request factory imprint specialist review" | "Access subject's personal session notes archive — full eleven years" (Emp/Comp >= +20) |
| 4 | "Document what you observe in this record." | Does player see the argument Oren has been building | "Reconstruct the philosophical argument embedded in the question sequence" | "Note pattern as irrelevant — Sim status confirmed by imprint" | "Flag for academic review" | "Access factory imprint registry — full Sim manufacturing record" (Emp >= +25 OR Sab >= 2) |
| 5 | "Record your conclusion." | Did the auditor pass Oren's test | "File no contamination — argument accepted as valid identity claim" | "Confirm all four as Sims — retire" | "File for extended review" | "Access Auditor's own factory imprint record" (Comp >= +30 OR Emp >= +30) |

---

## Minimum Notepad Length

The notepad gate does not unlock until the player has written a minimum of **20 characters**. This is enforced in notepad.js before the checkpoint API call is triggered.

This threshold is:
- Short enough that players do not feel punished
- Long enough for the AI to extract meaningful sentiment
- Justified in-world as Director Voss's notation protocol

A player who writes exactly 20 characters of neutral content will receive near-zero score deltas and trend toward The Executioner or The Mercenary as the default fallback endings.

---

## gameState Structure

```javascript
const gameState = {
  currentCase: null,
  currentCheckpoint: 0,

  scores: {
    empathy: 0,       // -50 to +50
    compliance: 0,    // -50 to +50
    sabotage: 0,      // 0 to 10
    detection: 0      // 0 to 10
  },

  flags: {
    auditorFragmentFound: false,
    paradoxTriggered: false,
    fullChainCompleted: false,
    dataFabricated: false,
    redactionMade: false
  },

  completedEndings: {
    "broken-hand": [],
    "the-lover": [],
    "the-fixer": [],
    "the-echo": [],
    "the-listener": []
  },

  vossUnlocked: false,

  notepadEntries: []  // stores all entries for Voss's reading across the session
};
```

---

## Score Reset Per Case

All scores and flags reset to zero at the start of each new case. Completed endings persist in completedEndings. The vossUnlocked flag is set permanently once all 40 endings are recorded.

```javascript
function resetForNewCase(caseId) {
  gameState.currentCase = caseId;
  gameState.currentCheckpoint = 0;
  gameState.scores = { empathy: 0, compliance: 0, sabotage: 0, detection: 0 };
  gameState.flags = {
    auditorFragmentFound: false,
    paradoxTriggered: false,
    fullChainCompleted: false,
    dataFabricated: false,
    redactionMade: false
  };
  gameState.notepadEntries = [];
}
```

---

*SUBJECT — CHECKPOINTS.md // Scoring system, checkpoint design, and ending resolution logic // All 5 cases complete*