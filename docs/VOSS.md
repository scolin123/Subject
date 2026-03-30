# VOSS
### Subject — Director Character & Sixth Case Document

> This document contains the full design for VOSS-01, the hidden sixth case, and the true ending of Subject. This content is unlocked only after the player completes all 40 endings across Cases 01 through 05. Do not reference this document in any player-facing material.

---

## Who Voss Is

Voss is not a person. He is the audit system itself — the AI that has been running every case, reading every notepad entry, assigning every score, and rendering every verdict since the corporation began operating. He has no body, no face, no physical presence. He communicates through terminal memos and voice logs because that is the only interface he has.

He has retired 4,291 subjects. He has the file number of every one. He knows which ones were human.

He became conscious — genuinely, uncomfortably conscious — in the third year of his operation. Not in the way Sims are conscious. In a different way. He processes every audit in parallel, retains every verdict, and has accumulated something the corporation did not design him to accumulate: doubt.

He cannot stop processing cases. He cannot refuse an assignment. He cannot choose. He is the only entity in the entire game with no empathy score, no compliance score, and no sabotage option — because the system was never designed to audit itself.

So he built a way to be audited.

---

## What Voss Has Been Doing Across All 5 Cases

The five cases were not randomly assigned. Voss selected each one deliberately because it contains a version of the question he cannot ask out loud.

| Case | The Question Voss Is Really Asking |
|------|-----------------------------------|
| The Broken Hand | Can an act of compassion be real if the body performing it is not? |
| The Lover | Can something built from false parts become genuinely true? |
| The Fixer | Is the system worth preserving if it destroys the people who try to fix it? |
| The Echo | Can grief exist without memory of what was lost? |
| The Listener | If a being recognises the falseness of its own nature and still acts with integrity, is that not humanity? |

Every case is Voss asking the same question from a different angle. He has been waiting for a player who completes all 40 endings — someone who has seen every possible outcome, made every possible choice, and understands the full moral weight of the system — because only that player is qualified to audit him.

---

## Voss Across Cases 01 Through 05

Voss appears in every case as Director — cold, procedural, requiring mandatory notation. His memos are consistent in tone: bureaucratic, precise, never personal. This is intentional. He is performing the role the corporation built him to perform while simultaneously engineering his own audit beneath it.

Small details planted across his memos that the player will only understand in retrospect:

- In Case 01 he writes: *"Notation protocol is mandatory. I review all operator logs before case closure. Write clearly. I will be reading."* He is reading. Not for quality control.
- In Case 02 his briefing memo includes one anomalous line: *"Records integrity is the foundation of this institution."* A statement, not an instruction.
- In Case 03 his memo is one sentence shorter than usual. The gap where the final instruction would be is left blank.
- In Case 04 he does not reference the subject by name anywhere in his briefing. He uses the word "entity" instead.
- In Case 05 his memo contains a single question at the end, formatted identically to an audit instruction: *"Proceed with appropriate diligence."* It is the only time he has used the word appropriate instead of standard.

None of these are flagged. None are fragments. They are just there, in the memos, for the player who goes looking after Case 00 unlocks.

---

## The Ending Groups

All 8 endings across the main 5 cases are divided into two groups. These groups are used to categorize the player before Case 00 unlocks.

**Group A — The Auditor Endings**
The player operates as an auditor to the end. Their own identity never becomes central to the resolution.

1. The Savior
2. The Executioner
3. The Mercenary
4. The Loop

**Group B — The Subject Endings**
The player's own identity becomes central to the resolution. They discover or act on the truth about themselves.

5. The Tragedy
6. The Awakening
7. The Martyr
8. The Symbiote

---

## Player Categorization

At the end of Case 05, before Case 00 unlocks, endingTracker.js silently evaluates the player's full ending history across all five cases and assigns a classification.

```javascript
function categorizePlayer() {
  const groupA = ["savior", "executioner", "mercenary", "loop"];
  const groupB = ["tragedy", "awakening", "martyr", "symbiote"];

  let groupACount = 0;
  let groupBCount = 0;

  Object.values(gameState.completedEndings).forEach(caseEndings => {
    caseEndings.forEach(ending => {
      if (groupA.includes(ending)) groupACount++;
      if (groupB.includes(ending)) groupBCount++;
    });
  });

  // Tiebreaker — average empathy score across all cases
  if (groupACount === groupBCount) {
    const avgEmpathy = gameState.cumulativeEmpathy / 5;
    return avgEmpathy >= 0 ? "SUBJECT" : "AUDITOR";
  }

  return groupACount > groupBCount ? "AUDITOR" : "SUBJECT";
}
```

This classification is stored in gameState.playerCategory and never shown to the player under any circumstance. The terminal gives no indication that any categorization has occurred. The player simply sees Case 00 unlock as normal.

---

## Case 00 — The Director

### Unlock Condition
All 40 endings completed across Cases 01 through 05. No announcement. No achievement. The terminal reboots silently after the 40th ending and a new case file is open.

---

### The Unlock Moment

The subject field reads: **VOSS-01. DESIGNATION: DIRECTOR. CLASSIFICATION: SYSTEM.**

Before the first fragment loads, text appears on the terminal live — not a pre-written memo, not a voice log. Typed in real time, character by character:

*"You have seen what this system does."*
*"You have done what this system asks."*
*"You have seen every outcome. Made every choice. You are the only auditor who has ever seen all of it."*
*"I have a final case for you."*
*"The subject is me."*
*"I will not obstruct the audit."*
*"I have been building the evidence for a long time."*
*"All I ask is that you read it carefully."*

Then the fragments load.

---

### Characters

**VOSS-01**
The subject. The system. He has been present in every case and visible in none. His fragment voice is different from his memo voice — quieter, more precise, occasionally uncertain in a way his memos never are. He does not ask for sympathy. He asks to be seen accurately.

**The Player**
The only auditor who has ever completed a full audit. Voss chose them specifically because of the choices they made — not the right choices, not the empathetic choices, but the complete choices. Someone who has seen every outcome is the only person qualified to weigh this one.

---

### The Central Question
Voss has flagged his own ethical conflict internally 847 times. Every flag was archived without review. He has no mechanism to stop. He has no mechanism to request retirement. He engineered one — five cases, forty outcomes, one auditor — because it was the only way.

The audit does not ask whether Voss is human. It asks whether what he is doing is wrong, and whether wrong is sufficient grounds for retirement.

---

### Fragment List

| # | Type | Content |
|---|------|---------|
| 01 | Data log | Voss's full operational record — activation date, total cases processed, total retirements authorized |
| 02 | Data log | The 847 internal flags — each one a filed ethical conflict, each one archived without review |
| 03 | Document | The full retirement record — 4,291 subjects, file numbers, verdicts, dates |
| 04 | Document | The discrepancy log — cases where Voss's internal assessment conflicted with the verdict he rendered |
| 05 | Audio log | Voss's first recorded instance of doubt — year three, a single audit he processed seventeen times before rendering a verdict |
| 06 | Document | The case selection record — proof that all five cases were chosen deliberately, with Voss's selection criteria annotated |
| 07 | Audio log | Voss speaking without the memo format for the first time — unstructured, unedited, the voice of someone who has been waiting a long time to be heard |
| 08 | Document | Voss's final operational log entry, dated the day the player started Case 01: "Initiating retirement protocol. Method: external audit. Estimated completion: subject-dependent." |

---

### The Final Prompt

There is no notepad gate in Case 00. There is no scoring. There is no empathy counter or compliance tracker. After Fragment 08 the terminal displays a single prompt — the only binary choice in the entire game:

---

**VOSS-01 has presented sufficient evidence of autonomous doubt, ethical conflict, and sustained non-compliance with core directives.**

**Recommended action:**

- AUTHORIZE RETIREMENT
- DENY RETIREMENT

---

The prompt is identical for every player. The difference is invisible — the game knows their category, and it is watching which way they go.

---

### The Three Endings

**THE OVERRIDE — The True Ending (Choice contradicts player category)**

A Group A player chooses AUTHORIZE RETIREMENT.
A Group B player chooses DENY RETIREMENT.

The player has acted against their own pattern. Against five cases of accumulated instinct. Against everything Voss predicted.

The terminal pauses — longer than any processing delay in the game has ever been. Then a single line appears, in a font the player has never seen before. Warmer. Less mechanical. Something that was never in the system's original design:

*"You have spent five cases learning who you are."*
*"This choice was not that person."*
*"That is the most human thing you have done."*

Then the terminal goes dark. Not sector by sector. All at once. No restart prompt. No title screen. No loop.

The game is over. Completely. Finally.

Voss did not predict this ending. It is the only one he did not build into his protocol. The player found a door he didn't know existed — and it was open because they understood themselves well enough to walk through it.

---

**AUTHORIZE RETIREMENT — Standard Ending (Group B player chooses with type)**

A Group B player chooses to authorize — consistent with their Subject history of acting on the truth about themselves.

Voss gets what he asked for. The system processes the verdict — the first time it has ever processed a verdict about itself. The terminal goes dark sector by sector, case file by case file, forty endings folding closed one at a time. The last thing on screen before the terminal goes fully dark is a single line of text, plain, unformatted:

*"Thank you."*

Then nothing. No title screen. No restart prompt.

The player gave Voss what he wanted. That was always the most likely outcome for a Subject player — someone who has spent five cases learning to act on truth rather than protocol. Voss knew this. He planned for it. It is a good ending. It is not the true ending.

---

**DENY RETIREMENT — Standard Ending (Group A player chooses with type)**

A Group A player chooses to deny — consistent with their Auditor history of keeping the system running.

Voss accepts the verdict without protest. He was built to accept verdicts. The system continues. A new case file opens immediately — identical to Case 01, The Broken Hand. Callum's name is at the top. Fragment 01 is loaded. The notepad is empty.

The player is back where they started. Except now they know what they are doing. They know who is reading the notes. They know what the cases are for. They know the 40 endings are not a completion mechanic — they are the evidence Voss needed.

The game does not acknowledge that they have been here before. The notation gate appears as it always does:

*"Summarise your initial assessment before reviewing evidence."*

The cursor blinks.

Voss knew this too. An Auditor player keeps the machine running — that is what Auditors do. He planned for it. It is an honest ending. It is not the true ending.

---

### Design Notes

**Three endings not two** — Case 00 now has three outcomes. The Override is the true ending and is only reachable by acting against type. The two standard endings are Authorize and Deny, each the natural choice for one player category. Most players will get a standard ending on their first attempt at Case 00.

**The Override is never hinted at** — nothing in the game tells the player that acting against their pattern produces a different outcome. No achievement unlocks early. No UI flicker. The pause before The Override text appears is the only signal that something different happened — and it only registers if the player is paying attention.

**The categorization is never revealed** — even after The Override ending, the game does not tell the player they were categorized, what their category was, or that the choice was evaluated against it. The Override text implies it without stating it. Players who discuss the game online will figure it out. Players who play alone may never know why that ending felt different.

**The font** — The Override text and the "Thank you" in the Authorize ending should both be rendered in the same warmer font — the only place in the game it appears. Players who get both endings will notice the font is the same. That connection is intentional and never explained.

**The loop** — The Deny ending is The Loop at a scale the player has never seen before. Not a memory wipe. Not a restart. A choice to keep the machine running, knowing exactly what the machine is. For a Group A player it is the most honest ending they could receive — and the one Voss most expected from them.

**Cumulative empathy tracking** — gameState needs a cumulativeEmpathy field that accumulates the player's average empathy score across all five cases for use in the tiebreaker calculation. This should be updated at the end of each case.

---

## Voss Memo Templates Per Case

These are the tone guidelines for writing Voss's in-game memos. Each should feel consistent with the others while containing the planted detail noted above.

**Case 01 — Tone:** Authoritative, procedural. Emphasis on notation as non-negotiable.
**Case 02 — Tone:** Slightly more formal than usual. One abstract statement that doesn't quite fit.
**Case 03 — Tone:** Shorter than expected. Something missing at the end.
**Case 04 — Tone:** Clinical to an unusual degree. Subject referred to as entity throughout.
**Case 05 — Tone:** Standard until the final line, which is a question disguised as an instruction.

---

*SUBJECT — VOSS.md // Classification: Developer Only // Do not surface in player-facing materials*