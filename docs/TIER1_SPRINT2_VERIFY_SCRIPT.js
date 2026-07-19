// Tier 1 Sprint 2 verification (phrase-aware diagnosis)
// Run: node docs/TIER1_SPRINT2_VERIFY_SCRIPT.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');
const WORDS_JSON = path.join(PROJECT_ROOT, 'data', 'words.json');

let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { console.log('  ✅', name); pass++; }
  else { console.log('  ❌', name); fail++; }
}

console.log('\n=== Sprint 2: pre-flight ===');
console.log('CWD:', PROJECT_ROOT);
const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const tmpJs = '/tmp/_sprint2_syntax_check.js';
fs.writeFileSync(tmpJs, scriptMatch[1]);
try {
  execSync(`node --check ${tmpJs}`, { stdio: 'pipe' });
  assert(true, 'node --check OK');
} catch (e) {
  assert(false, 'node --check failed: ' + e.stderr.toString().slice(0, 200));
  process.exit(1);
}
fs.unlinkSync(tmpJs);

// Extract diagnosis block
const diagStart = html.indexOf('function _diagnosePronunciation');
const diagEnd = html.indexOf('// Phrase-aware sentence diagnosis (T2)');
const sentenceStart = html.indexOf('function _diagnoseSentence');
const sentenceEnd = html.indexOf('// Per-char diagnosis on a single phrase slice (T1 logic factored)');
const charStart = html.indexOf('function _diagnoseCharSequence');
// Find the closing brace — search for next non-nested function or class
const charEnd = html.indexOf('\nfunction ', charStart + 10);
const allDiagCode = html.slice(diagStart, charEnd);

const sandbox = {
  console,
};
vm.createContext(sandbox);
try {
  vm.runInContext(allDiagCode, sandbox);
} catch (e) {
  assert(false, 'diagnosis code extract failed: ' + e.message);
  process.exit(1);
}

const _diagnosePronunciation = sandbox._diagnosePronunciation;
const _diagnoseSentence = sandbox._diagnoseSentence;
const _diagnoseCharSequence = sandbox._diagnoseCharSequence;

assert(typeof _diagnosePronunciation === 'function', '_diagnosePronunciation defined');
assert(typeof _diagnoseSentence === 'function', '_diagnoseSentence defined (T2)');
assert(typeof _diagnoseCharSequence === 'function', '_diagnoseCharSequence defined (T1 helper)');

// === Backward compat: wordBoundary undefined → whole-string mode ===
console.log('\n=== Test 1: wordBoundary undefined → T1 fallback ===');
{
  const d = _diagnosePronunciation('心', '三', null, undefined);
  assert(d.summary.kind === 'homophone', '三→心 = homophone (no wordBoundary → T1 fallback)');
  assert(d.homophone.length === 1, 'homophone count = 1');
  assert(d.phrases === undefined, 'no phrases array (T1 mode)');
}

// === T1: wordBoundary = null → same fallback ===
console.log('\n=== Test 2: wordBoundary null → T1 fallback ===');
{
  const d = _diagnosePronunciation('春天', '春天', null, null);
  assert(d.summary.kind === 'perfect', 'perfect match (T1 fallback)');
  assert(d.phrases === undefined, 'no phrases array (T1 mode)');
}

// === T2: wordBoundary present → phrase mode ===
console.log('\n=== Test 3: wordBoundary present → T2 phrase mode ===');
{
  const d = _diagnosePronunciation('小明今日去咗公園', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  assert(d.summary.kind === 'perfect', 'all 4 phrases match → perfect');
  assert(d.phrases.length === 4, '4 phrases');
  assert(d.phrases[0].kind === 'matched', 'phrase 0 = matched');
  assert(d.phrases[1].kind === 'matched', 'phrase 1 = matched');
  assert(d.total === 8, 'total = 8 chars');
  assert(d.matched.length === 8, 'matched = 8');
}

// === T2: 1 phrase wrong → kind = major for that phrase ===
console.log('\n=== Test 4: 1 phrase wrong, others matched ===');
{
  // "小明今日去咗公園" but user says "小明今日去左公園" — '左' vs '咗'
  // The '左' is not in dict, so unmapped (or wrong)
  const d = _diagnosePronunciation('小明今日去左公園', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  // Matched: 6 (小明 + 今日 + 公園), wrong/unmapped: 2 (去咗 → 去左)
  assert(d.matched.length >= 6, `at least 6 matched (got ${d.matched.length})`);
  assert(d.phrases[0].kind === 'matched', 'phrase 0 (小明) = matched');
  assert(d.phrases[1].kind === 'matched', 'phrase 1 (今日) = matched');
  assert(d.phrases[2].kind !== 'matched', `phrase 2 (去咗) = not matched (got ${d.phrases[2].kind})`);
  assert(d.phrases[3].kind === 'matched', 'phrase 3 (公園) = matched');
}

// === T2: matched ratio threshold (85% / 65%) ===
console.log('\n=== Test 5: matched ratio thresholds ===');
{
  // 8-char sentence, all matched → 100% → perfect
  const d1 = _diagnosePronunciation('小明今日去咗公園', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  assert(d1.summary.kind === 'perfect', '100% matched = perfect');

  // 8-char, ~70% matched → 0.70 → near (≥0.65)
  // Need 5/8 matched = 0.625 < 0.65 → major
  // Or 6/8 = 0.75 → near
  // Simulate: 1 phrase wrong (2 chars) = 6/8 = 0.75 → near
  const d2 = _diagnosePronunciation('小今日去左公園', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  // '小' not '明' (1 char wrong), '去左' vs '去咗' (1 char wrong), '公園' ok
  // 6/8 = 0.75 → near
  console.log(`  Debug d2: matched=${d2.matched.length}, total=${d2.total}, ratio=${(d2.matched.length/d2.total).toFixed(2)}, summary=${d2.summary.kind}`);
  assert(d2.summary.kind === 'near' || d2.summary.kind === 'major', `70-75% ratio (got ${d2.summary.kind})`);
}

// === T2: transcript too short → all missing phrases ===
console.log('\n=== Test 6: transcript too short ===');
{
  // Target 8 chars, transcript only 4
  const d = _diagnosePronunciation('小明', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  assert(d.phrases[0].kind === 'matched', 'phrase 0 (小明) = matched (in transcript)');
  assert(d.phrases[1].kind === 'missing', `phrase 1 (今日) = missing (got ${d.phrases[1].kind})`);
  assert(d.phrases[2].kind === 'missing', `phrase 2 (去咗) = missing (got ${d.phrases[2].kind})`);
  assert(d.phrases[3].kind === 'missing', `phrase 3 (公園) = missing (got ${d.phrases[3].kind})`);
  assert(d.missing.length === 6, `6 missing total (got ${d.missing.length})`);
}

// === T2: wordBoundary coverage check (total chars = sum phrase chars) ===
console.log('\n=== Test 7: wordBoundary char coverage ===');
{
  const d = _diagnosePronunciation('小明今日', '小明今日去咗公園', null,
    ['小明', '今日', '去咗', '公園']);
  // total should be 8 regardless of transcript length
  assert(d.total === 8, `total = 8 (got ${d.total})`);
  assert(d.phrases.length === 4, `4 phrases (got ${d.phrases.length})`);
}

// === T2: homophone in 1 phrase (三→心) ===
console.log('\n=== Test 8: homophone inside 1 phrase ===');
{
  // Target "三多兩少" but user says "心多兩少" — phrase 0 homophone
  const d = _diagnosePronunciation('心多兩少', '三多兩少', null,
    ['三', '多', '兩', '少']);
  assert(d.homophone.length === 1, 'homophone count = 1');
  assert(d.phrases[0].kind === 'homophone', 'phrase 0 = homophone');
  assert(d.phrases[1].kind === 'matched', 'phrase 1 (多) = matched');
  assert(d.summary.kind === 'homophone', 'pure homophone summary');
}

// === T2: 7-char sentence with odd-length last phrase ===
console.log('\n=== Test 9: 7-char sentence (3+2+2 chunks) ===');
{
  // "爸爸買咗新嘅車" = 7 chars: 爸(1)爸(2)買(3)咗(4)新(5)嘅(6)車(7)
  // wordBoundary = ['爸爸', '買咗', '新嘅', '車'] (4 phrases, last 1-char)
  const d = _diagnosePronunciation('爸爸買咗新嘅車', '爸爸買咗新嘅車', null,
    ['爸爸', '買咗', '新嘅', '車']);
  assert(d.total === 7, `total = 7 (got ${d.total})`);
  assert(d.phrases.length === 4, '4 phrases');
  assert(d.phrases[0].phrase === '爸爸', 'phrase 0 = 爸爸');
  assert(d.phrases[3].phrase === '車', 'phrase 3 = 車 (1 char)');
  assert(d.summary.kind === 'perfect', 'all matched');
}

// === Version bump ===
console.log('\n=== Test 10: version ===');
const ver = (html.match(/_DEMO_SEED_VERSION = '([^']+)'/) || ['',''])[1];
assert(ver === 'v1.2.0-beta.2', `version = v1.2.0-beta.2 (got "${ver}")`);

console.log(`\n=== SUMMARY: ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
