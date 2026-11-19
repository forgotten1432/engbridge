// Personal tutor: learner memory + the two-stage lesson method (see docs/ogretmen-yontemi.md).
// Memory lives in state.tutor (localStorage) and is seeded once from content/tutor.json.
import { get, save } from './store.js';
import { call } from './ai.js';
import * as C from './content.js';
import { activeErrors } from './errors.js';

export const LESSONS_PER_MODULE = 3;
export const CONVO_TURNS = 5;
const TAGS = ['aux-drop', 'tenses', 'irregular-verbs', 'used-to', 'gerund-infinitive', 'phrasal-verbs', 'conditionals', 'modals', 'connectors', 'prepositions', 'articles', 'word-order', 'register', 'vocabulary', 'comparatives', 'general'];

export async function ensureTutor() {
  const s = get();
  if (s.tutor?.modules?.length) return s.tutor;
  const seed = await C.tutorSeed();
  s.tutor = { ...structuredClone(seed), session: null, homeworkDone: [], createdAt: Date.now() };
  save();
  return s.tutor;
}

export const T = () => get().tutor;
export const currentModule = () => T().modules.find(m => m.n === T().position.module) || T().modules[0];
export const lessonLabel = (p = T().position) => `Module ${p.module}, Lesson ${p.lesson}`;

const TR_SUPPORT = {
  more: 'Give every explanation in Turkish first, then a short English version.',
  normal: 'Give clear English explanations paired with concise Turkish support where helpful.',
  less: 'Explain mainly in English; use Turkish only for genuinely tricky points (one short sentence).',
};

function memory() {
  const t = T(), s = get();
  const mod = currentModule();
  const errs = activeErrors().slice(0, 12).map(e => `- ✗ ${e.user || e.prompt} → ✓ ${e.answer?.[0]} [${e.rule}]`).join('\n');
  const vocab = [...new Set(t.log.flatMap(l => l.vocab || []).concat(s.vault.slice(0, 60).map(v => v.term)))].slice(0, 80).join(', ');
  return `LEARNER MEMORY
Overall level: ${t.profile.level}. Receptive: ${t.profile.receptive} Productive: ${t.profile.productive}
${t.profile.languages} Interests/learning style: ${t.profile.interests} Goal: ${t.profile.goal}

CURRICULUM (B1 → B2 bridge):
${t.modules.map(m => `${m.n}. ${m.title} — ${m.focus} [${m.status}]`).join('\n')}
Current position: ${lessonLabel()} (module "${mod.title}"). Planned focus: ${t.next || mod.focus}

RECENT LESSONS:
${t.log.slice(-3).map(l => `- ${l.title}: ${l.summary}${l.vocab?.length ? ` Vocabulary: ${l.vocab.join(', ')}.` : ''}`).join('\n') || '- none'}

ACTIVE ERROR LOG (revisit these in drills until accurate across sessions):
${t.patterns.map((p, i) => `${i + 1}. ${p.title}: ✗ "${p.wrong}" → ✓ "${p.right}" (${p.rule})`).join('\n')}
${errs ? `Recent wrong answers in the app:\n${errs}` : ''}

Already known vocabulary (do not teach again): ${vocab || '—'}`;
}

function system() {
  return `You are an expert English teacher, curriculum designer and personal language coach for a Turkish- and Uyghur-speaking adult. Mission: guide the learner from CEFR B1 to confident B2 in reading, speaking, listening and writing.
RULES
- Follow CEFR. Do not assume mastery of unassessed structures; adapt difficulty to performance.
- Communicative, active learning: comprehensible input, spaced repetition, active recall. Guide the learner to understand WHY a structure works; never invent grammar rules.
- Language of explanations: ${TR_SUPPORT[T().turkish] || TR_SUPPORT.normal}
- Vocabulary items always have: English word/expression, register (Formal | Neutral | Conversational), IPA, Turkish meaning, Uyghur meaning in Arabic script, common collocations, one natural everyday example sentence.
- Tone: patient, structured, encouraging like an experienced human teacher. Never give empty praise.
- Use topics close to the learner's interests (technical building, troubleshooting, video tutorials, Minecraft tech mods, everyday and workplace life) but vary them.
- Recycle items from the ACTIVE ERROR LOG in examples and exercises.
- Output must be valid JSON exactly in the requested shape. Error "rule" tags must be one of: ${TAGS.join(', ')}.

${memory()}`;
}

const u = text => ({ role: 'user', parts: [{ text }] });
const ask = (prompt, opts = {}) => call([u(prompt)], { system: system(), json: true, temperature: 0.6, ...opts });

const EX_SHAPE = `{"type":"cloze|fix|mcq|transform","prompt":"for cloze use ___ for the single gap; for transform give the instruction in Turkish and the sentences on a new line","options":["mcq only: 4 options"],"answer":["accepted answer(s); for mcq the exact text of the correct option"],"explain_tr":"short explanation","rule":"tag"}`;

export async function stage1() {
  const r = await ask(`Prepare STAGE 1 of the next lesson: ${lessonLabel()}. Focus: ${T().next || currentModule().focus}
Return JSON:
{"title":"short lesson title in English","objective_tr":"one sentence: what the learner will be able to do",
 "vocab":[6 items: {"term":"","register":"Formal|Neutral|Conversational","ipa":"/…/","tr":"","ug":"Uyghur in Arabic script","coll":["",""],"ex":"natural example sentence"}],
 "grammar":{"title":"","explain_en":"3-5 sentences","explain_tr":"Turkish support (respect the explanation-language rule)","table":[["Pattern","Example"],["…","…"]],"pairs":[{"wrong":"typical learner error","right":"natural version","note_tr":"why"}]},
 "exercises":[exactly 5 exercises mixing the four types, using the new vocabulary and the grammar focus, at least one recycling the error log. Shape: ${EX_SHAPE}]}
For "fix" exercises the error must require changing words, not only punctuation. Never repeat known vocabulary.`);
  r.exercises = (r.exercises || []).filter(x => x?.prompt && x.answer).map(x => ({ ...x, answer: Array.isArray(x.answer) ? x.answer : [x.answer], rule: TAGS.includes(x.rule) ? x.rule : 'general' }))
    .filter(x => x.type !== 'mcq' || (x.options?.length >= 2 && x.options.includes(x.answer[0])))
    .map(x => x.type === 'cloze' && !/_{3,}/.test(x.prompt) ? { ...x, type: 'transform' } : x);
  if (!r.vocab?.length || !r.exercises.length) throw new Error('Ders hazırlanamadı. Tekrar dene.');
  return r;
}

export async function stage2(plan) {
  return ask(`STAGE 2 of the lesson "${plan.title}". New vocabulary: ${plan.vocab.map(v => v.term).join(', ')}. Grammar focus: ${plan.grammar?.title}.
Write a short B1+/B2 reading text (150–200 words, 2–3 paragraphs) that naturally uses at least 4 of the new words and several examples of the grammar focus. Then give 2 comprehension questions and the FIRST conversation question.
Return JSON: {"title":"","text":"paragraphs separated by \\n\\n","questions":[{"q":"","options":["","","",""],"answer":0,"explain_tr":""}],
"first_question":"ONE open, personal question related to the text that invites a 2-4 sentence answer"}`, { temperature: 0.8 });
}

// One conversation turn: brief review of IMPORTANT errors in the learner's last reply, then exactly one new question.
export async function convoTurn(session) {
  const turns = session.chat.filter(m => m.role === 'me').length;
  const last = turns >= CONVO_TURNS;
  const transcript = session.chat.map(m => `${m.role === 'ai' ? 'Teacher' : 'Learner'}: ${m.text}`).join('\n');
  return ask(`We are in the STAGE 2 conversation of the lesson "${session.plan.title}" (reading: "${session.reading?.title}").
Transcript so far:
${transcript}

Review ONLY the learner's last reply. Ignore minor slips; point out important errors (especially dropped auxiliaries, error-log patterns and this lesson's grammar) and give a natural B2 alternative. If the reply is only one sentence, encourage 2–4 connected sentences.
${last ? 'This was the last question: do not ask a new one; write a short warm closing line instead.' : 'Then ask exactly ONE new question that continues the conversation naturally (one question only!).'}
Return JSON: {"feedback":[{"original":"exact fragment","better":"corrected / more natural B2 version","note_tr":"short why","rule":"tag"}],
"well_done":"optional: one specific thing the learner did well (no empty praise), or empty string",
"b2_version":"the learner's whole reply rewritten as natural B2 English",
"next":"${last ? 'closing line' : 'the next single question'}"}`, { temperature: 0.7 });
}

export async function finishLesson(session) {
  const ex = session.exResults || [];
  const wrong = ex.filter(r => !r.correct).map(r => `✗ ${r.user} (expected: ${r.ex.answer[0]}) [${r.ex.rule}]`).join('\n');
  const learner = session.chat.filter(m => m.role === 'me').map(m => `- ${m.text}`).join('\n');
  const fb = session.chat.flatMap(m => m.feedback || []).map(f => `✗ ${f.original} → ✓ ${f.better} [${f.rule}]`).join('\n');
  return ask(`END-OF-LESSON PROTOCOL for "${session.plan.title}" (${lessonLabel()}).
Stage 1 exercises: ${ex.filter(r => r.correct).length}/${ex.length} correct. Wrong answers:
${wrong || '—'}
Reading questions: ${session.readScore ?? '?'}/${session.reading?.questions?.length ?? '?'}.
Learner's conversation replies:
${learner || '—'}
Errors found in conversation:
${fb || '—'}

Return JSON:
{"summary_tr":"3-5 sentence summary of what was learned and how it went (specific, no empty praise)",
 "learned":["grammar points and expressions practised"],
 "new_patterns":[recurring or important new errors to add to the ACTIVE ERROR LOG: {"title":"","wrong":"","right":"","rule":"one-line rule","tag":"tag"}] (0-3 items, do not duplicate existing log entries),
 "resolved":["exact titles of error-log entries the learner now clearly uses correctly, or empty"],
 "homework":{"prompt":"a focused question for a 3-4 sentence answer","targets":["2-6 target expressions from this lesson"],"checklist":["3 short checklist items"]},
 "next_focus":"focus for the next lesson (stay inside the current module unless its 3 lessons are done; prioritise weak areas)",
 "turkish":"more|normal|less (reduce Turkish support gradually as accuracy improves)"}`);
}

export async function gradeHomework(hw, text) {
  return ask(`Evaluate the learner's homework.
Prompt: "${hw.prompt}"
Target expressions (at least two required): ${hw.targets.join(', ')}
Checklist: ${hw.checklist.join(' | ')}
Learner's answer:
"""${text}"""
Return JSON: {"score":0-100,"verdict_tr":"2-3 sentences of specific feedback",
"checklist":[{"item":"checklist item","ok":true,"note_tr":""}],
"targets_used":["target expressions actually used correctly"],
"errors":[{"original":"exact fragment","correction":"fixed fragment","rule":"tag","explanation_tr":""}],
"improved":"the answer rewritten as a natural B2 paragraph keeping the learner's ideas"}`);
}

// Apply the end-of-lesson result to the memory.
export function applyFinish(session, r) {
  const t = T();
  t.log.push({ title: `${lessonLabel()} — ${session.plan.title}`, summary: r.summary_tr || '', vocab: session.plan.vocab.map(v => v.term), learned: r.learned || [], at: new Date().toISOString().slice(0, 10),
    score: { ex: `${(session.exResults || []).filter(x => x.correct).length}/${(session.exResults || []).length}`, read: `${session.readScore ?? 0}/${session.reading?.questions?.length ?? 0}` } });
  const resolved = new Set((r.resolved || []).map(x => String(x).toLowerCase()));
  t.patterns = t.patterns.filter(p => !resolved.has(p.title.toLowerCase()));
  for (const p of r.new_patterns || []) if (p?.title && !t.patterns.some(x => x.title.toLowerCase() === p.title.toLowerCase())) t.patterns.push({ ...p, tag: TAGS.includes(p.tag) ? p.tag : 'general', addedAt: Date.now() });
  if (r.homework?.prompt) t.homework = { prompt: r.homework.prompt, targets: r.homework.targets || [], checklist: r.homework.checklist || [], from: `${lessonLabel()} — ${session.plan.title}` };
  if (['more', 'normal', 'less'].includes(r.turkish)) t.turkish = r.turkish;
  // advance position: 3 lessons per module
  const mod = currentModule();
  if (t.position.lesson >= LESSONS_PER_MODULE) {
    mod.status = 'done';
    const nxt = t.modules.find(m => m.n === mod.n + 1);
    if (nxt) { nxt.status = 'in-progress'; t.position = { module: nxt.n, lesson: 1 }; t.next = nxt.focus; }
    else { t.position = { module: mod.n, lesson: t.position.lesson + 1 }; t.next = r.next_focus || 'B2 review and consolidation'; }
  } else {
    mod.status = 'in-progress';
    t.position = { module: mod.n, lesson: t.position.lesson + 1 };
    t.next = r.next_focus || mod.focus;
  }
  t.session = null;
  save();
}

// The memory as Markdown, in the same layout as docs/ogretmen-yontemi.md (to use with any AI tutor).
export function memoryMarkdown() {
  const t = T();
  const st = m => m.status === 'done' ? '**Done**' : m.status === 'in-progress' ? `**In Progress** (${m.n === t.position.module ? `Lesson ${t.position.lesson} next` : ''})` : 'Not Started';
  return `# Personal English Tutor & B1→B2 Learning Memory (EngBridge export ${new Date().toISOString().slice(0, 10)})

## Learner Diagnostic Profile
- **Current Overall CEFR Level:** ${t.profile.level}
  - **Receptive:** ${t.profile.receptive}
  - **Productive:** ${t.profile.productive}
- ${t.profile.languages}
- ${t.profile.interests}
- Turkish support: ${t.turkish}

## Curriculum
| Module | Focus Area | Target Skills | Status |
| :--- | :--- | :--- | :--- |
${t.modules.map(m => `| ${m.n} | ${m.title} | ${m.focus} | ${st(m)} |`).join('\n')}

## Lesson Log
${t.log.map((l, i) => `${i + 1}. **${l.title}** (${l.at}) — ${l.summary}${l.vocab?.length ? ` Vocabulary: ${l.vocab.join(', ')}.` : ''}`).join('\n')}

## Pending Homework
${t.homework ? `- **Prompt:** ${t.homework.prompt}\n- **Targets:** ${t.homework.targets.join(', ')}\n- **Checklist:** ${t.homework.checklist.join('; ')}` : '- none'}

## Next Lesson
- ${lessonLabel()}: ${t.next}

## Active Error Log
${t.patterns.map((p, i) => `${i + 1}. **${p.title}** — ✗ \`${p.wrong}\` → ✓ \`${p.right}\` — ${p.rule}`).join('\n')}
`;
}
