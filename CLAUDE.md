# EngBridge – notes for Claude

## Who and what
- Owner: GitHub user `forgotten1432`. Talks to Claude in **Turkish**; reply in Turkish. Code, commit messages and content keys may be English/Turkish as already used.
- EngBridge is an offline-first English-learning PWA (A1 → C2) for **Turkish and Uyghur speakers**, used mainly on **iPhone via Safari "Add to Home Screen"**. Published with GitHub Pages: https://forgotten1432.github.io/engbridge/
- The owner cannot pay for the App Store; everything must work as a static site. No build step, no npm: plain HTML/CSS/ES modules.
- Origin: the owner supplied a spec for "EngBridge B1→B2" and asked to extend it to **all levels A1–C2**, build the skeleton first and add content little by little.

## Architecture (see README.md for the full layout and content formats)
- `js/app.js` tab router + first-run seeding; `js/store.js` localStorage state (`engbridge.v1`) + JSON backup/restore; `js/srs.js` SM-2; `js/text.js` answer normalisation (contractions, case, punctuation) and dictation word diff; `js/exercise.js` shared player for `cloze | fix | mcq | transform`; `js/errors.js` Error Hunter log; `js/ai.js` Gemini; `js/views/*.js` the five tabs.
- All learning content is JSON in `content/`. `content/curriculum.json` holds `rules` (error categories) and the A1–C2 plan (6 levels, 23 modules, 69 lessons). A lesson shows as available only when it has `"ready": true` and a file `content/lessons/<id>.json` exists.
- Wrong answers from lessons, dictation and AI reviews go to the Error Hunter (SM-2, mastered after 3 correct in a row).
- `sw.js`: app shell cache-first, `content/` network-first. **Bump `VERSION` in `sw.js` whenever any JS/CSS file changes**, otherwise phones keep running old code. Content-only changes need no bump.

## Decisions already made (keep them)
- Separate repo from Kartlık (the flashcard app in `forgotten1432/githubtest`); do not merge the two apps.
- Gemini is bring-your-own-key, stored only in localStorage. Never commit an API key (the repo is public).
- Model selection is **automatic** by default (`settings.model === ''`): `ai.js` calls ListModels, ranks by version, prefers `flash`, and re-resolves on 404. Do not hard-code model names. The owner mentioned model names like "gemini 4 hydrogen" / "gemini 3.8 flash".
- UI language is Turkish; explanations are Turkish (+ English where useful). Uyghur is written in Arabic script with `dir="rtl"`.
- `[hidden]{display:none!important}` in CSS is required (the bottom sheet used `display:flex` and blocked all taps).

## Content status (as of 2026-11-18)
- Lessons done: `A1-M1-L1` (am/is/are) and **all 18 B1 lessons** (B1-M1 … B1-M6), 12–14 exercises each.
- Reading (10): `a1-my-day`, `a2-new-neighbours`, `a2-busy-weekend`, `b1-remote-work`, `b1-first-interview`, `b1-language-learning`, `b1-moving-city`, `b1-smartphones`, `b2-four-day-week`, `b2-silk-road` (glossary with IPA/TR/UG, 4–5 questions each). Glossary keys must not contain apostrophes (text is HTML-escaped before matching).
- 44 dictation sentences (A1–C2), 16 seed vocab cards, 15 diagnostic errors (from the owner's learner profile).
- `matches()` in `text.js` ignores punctuation, so a `fix` item must need a word change (not only punctuation); MCQ compares the chosen option exactly.
- Open lexicon `content/lexicon/{A1..C2}.json` (8,648 words: CEFR-J/Octanove levels, WordNet definitions via Openjam, CMU IPA), built by `tools/build_lexicon.py`; shown in Kelimeler → 📚 Sözlük and on tapping any word in a reading passage. Keep the licence credits (README + AI → Profil) when changing it.
- Candidate open sources not yet added: Tatoeba EN–TR/EN–UG sentence pairs (CC BY 2.0 FR, per-sentence attribution; tatoeba.org/manythings.org are not reachable from Claude's sandbox, the owner has to upload the file), VOA Learning English texts (public domain, credit learningenglish.voanews.com).
- **Next:** A2 lessons (12) and the rest of A1 (11), then B2, C1, C2; more C1/C2 reading passages and dictation.
- Learner profile to target: B1 overall; weaknesses: dropping is/are/was/were/had in multi-clause sentences, irregular verbs (drive/drove/driven vs derive), phrasal verb precision (put off vs call off, come up, figure out, turn down, take over, catch up), third conditional, used to + V1 vs be used to + V-ing, run-on sentences instead of 4–5 sentence paragraphs with connectors.
- Uyghur translations were written by Claude and have not been checked by a native speaker; say so when adding more.

## Working rules
- Test before pushing: `python3 -m http.server 8766` in the repo and drive it with Playwright/headless Chrome (all five tabs, lesson flow, dictation diff, offline reload). Check that every JSON file parses.
- Each lesson: Turkish explanation, wrong ↔ natural pairs, at least 12 exercises mixing the four types, every exercise with `explain_tr` and a valid `rule`. `answer` is always a list of accepted answers.
- Commit straight to `main` (the owner works from a phone and wants changes live); the owner has to enable GitHub Pages himself (Settings → Pages → main / root) if it is not on yet.
