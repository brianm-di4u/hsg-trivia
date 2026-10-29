# Trivia question audit — instructions for one batch

You are auditing one batch of multiple-choice trivia questions about Hot Springs, Arkansas, for an
open-source browser trivia game. Today is 2026-10-28. Your batch file is `batch-N.json` in this folder
(each question has id, category, difficulty, era, question, answer, wrong[3], explanation, source,
sourceUrl, confidence; some have `"_flagged": true`).

**Read-only:** everything under `C:\Video Game Projects\` is read-only for you. Write ONLY your
result file `batch-N.result.json` in this folder. Do not edit any other file.

## Why this audit exists
A 30-question sample fact-check needed fixes on 37% of questions. Answers were mostly right, but
**explanations often added facts the source does not state**. Weak sources: anything marked
"(via search)", HMdb and PressReader pages (often blocked), thin hotsprings.org blog posts, and
2025–26 events worded as if they had already happened when the source only previewed them.

## For every question
1. **Fetch the sourceUrl** (WebFetch). Questions sharing a URL: fetch once, check them all.
   Ask WebFetch a targeted prompt listing the specific facts you need to confirm (numbers, dates,
   names) and ask for exact quotes.
2. If the page is blocked/empty/404, try in order: the same page on another mirror (e.g. `www.` vs bare
   host, the Wikipedia article title search), the research corpus (`C:\Video Game Projects\research\*.md`
   and `research\research_notes\Hot Springs Arkansas game research\*.md` — these carry inline source
   links; a fact there tagged "(via search summary)"/"(snippet)" is weak), then ONE WebSearch for an
   alternative reputable source (NPS, Encyclopedia of Arkansas, Wikipedia, newspaper) and fetch it.
   If you verify via a different page, **replace `source` and `sourceUrl`** with the page you actually
   read (source format: `"Publisher: Page title"`, drop any "(via search)" tag once you have fetched it).
3. **Answer:** must match the source. If it is wrong, fix it or drop the question.
4. **Distractors (`wrong`):** none may be arguably true. Watch for: a disputed/conflicting value
   (e.g. Oaklawn 1904 vs 1905, gambling ended 1964 vs 1967, 47 vs 43 springs), a second correct
   name, an "about" range that overlaps the answer. Replace a bad distractor with a plausible but
   clearly false one of the same type.
5. **Explanation:** keep ONLY what the source states. Remove or rewrite any added fact the source
   does not say. One or two short sentences, ≤ 200 chars. It may restate the answer in context.
   Never introduce a fact you did not see in the fetched source.
6. **Time wording:** for events in 2025–2026, the source must report them as having happened. If the
   source only previews/announces it, reword to "was scheduled to"/"was announced"/"billed as" in
   the question and answer, or drop it.
7. **Confidence flags:** keep `confirmed` only if a fetched page states the fact. `summary` = only a
   search summary supports it (you could not read a page that states it). `claim` = the fact is a
   promotional/self-described claim ("billed as", "oldest", "first", company counts) — the question
   wording must attribute it (e.g. "What does X bill itself as…", "According to…"). Set the flag
   honestly. `summary` items should usually be re-verified to `confirmed` or dropped.
8. **Flagged ids (`_flagged: true`):** these must be re-verified against a page you actually fetched,
   or dropped. Be strict.
9. **Drop** a question when: the fact cannot be confirmed from any fetched page, the source
   contradicts it and no clean fix exists, it names a minor/current student, or the item hinges on a
   disputed value with no fair wording. Prefer fixing over dropping when a fetched source supports a fix.
10. Light copy-edits are welcome (clarity, "Hot Springs'" context) but do not churn wording needlessly.

## Output: `batch-N.result.json`
A JSON array with **one record per question in the batch, in batch order**:
```json
{
  "id": "hs-0017",
  "action": "keep" | "edit" | "drop",
  "set": { "explanation": "…", "wrong": ["…","…","…"], "source": "…", "sourceUrl": "…", "confidence": "confirmed" },
  "method": "fetched sourceUrl" | "fetched alternative: <url>" | "corpus only: <file>" | "unreachable",
  "note": "≤ 160 chars: what you checked and what changed and why (quote key evidence briefly)"
}
```
- `set` contains only fields you changed (omit for keep/drop). Valid fields: question, answer, wrong,
  explanation, source, sourceUrl, confidence, difficulty, era.
- Every record needs `method` and `note`, including keeps.
- Write the file incrementally (e.g. after each URL group) so progress survives interruption; the
  final file must be valid JSON containing all ids in the batch.

When done, reply with: counts of keep/edit/drop, and a list of the drops with one-line reasons.
