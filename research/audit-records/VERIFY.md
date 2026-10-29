# Second-pass verification — instructions for one verify batch

You are an independent second-pass fact checker for a Hot Springs, Arkansas trivia game. Today is
2026-10-28. A first audit already edited these questions. A 40-question sample found ~10% still had
problems, almost all of one kind: **the explanation adds a detail the source page does not state**
(an extra date, a race name, "every year", a superlative), plus the occasional distractor that is
arguably also correct.

Your batch is `verify-N.json` in this folder (questions with id, question, answer, wrong[3],
explanation, source, sourceUrl, confidence). Everything under `C:\Video Game Projects\` is read-only.
Write ONLY `verify-N.result.json` in this folder.

For each question:
1. Fetch the sourceUrl (WebFetch; load it first via ToolSearch "select:WebFetch,WebSearch"). Fetch each
   URL once for all questions sharing it; ask for exact quotes of the specific facts in the question,
   answer AND explanation. For long Wikipedia pages, ask targeted questions, using `offset` if needed.
2. Check: (a) the page states the answer; (b) no distractor is arguably also correct; (c) **every fact in
   the explanation is on the page** — numbers, dates, names, "first/only/oldest", frequency words;
   (d) 2025–26 events are worded as announced/scheduled unless the page reports them as done;
   (e) `claim` items attribute the claim in the question.
3. If the page is blocked, try one alternative reputable page; if nothing confirms the answer, verdict `drop`.

Fix rule: prefer the smallest fix. For an explanation with an unsupported add-on, rewrite it using only
what the page says (≤ 200 chars; restating the answer in context is fine). Replace a bad distractor with a
plausible, clearly false one of the same type.

Output `verify-N.result.json`: a JSON array, one record per question, in batch order:
`{"id", "verdict": "ok"|"fix"|"drop", "issue": "≤160 chars with the key quote (or 'confirmed: <quote>')",
"set": {only the fields to change, for fix}, "source"/"sourceUrl" in set only if you verified on a different page}`.
Write the file incrementally after each URL group so progress survives; the final file must be valid JSON.

Reply with counts per verdict and the list of non-ok items with one-line reasons.
