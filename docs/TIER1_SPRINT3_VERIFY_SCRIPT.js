// Sprint 3 verification (UI sentence rendering + score scaling + 500-char dict)
// Run: node docs/TIER1_SPRINT3_VERIFY_SCRIPT.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');
const WORDS_JSON = path.join(PROJECT_ROOT, 'data', 'words.json');
const DICT_JSON = path.join(PROJECT_ROOT, 'data', 'jyutping_extended.json');

let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { console.log('  ✅', name); pass++; }
  else { console.log('  ❌', name); fail++; }
}

console.log('\n=== Sprint 3: pre-flight ===');
const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const tmpJs = '/tmp/_sprint3_syntax_check.js';
fs.writeFileSync(tmpJs, scriptMatch[1]);
try {
  execSync(`node --check ${tmpJs}`, { stdio: 'pipe' });
  assert(true, 'node --check OK');
} catch (e) {
  assert(false, 'node --check failed: ' + e.stderr.toString().slice(0, 200));
  process.exit(1);
}
fs.unlinkSync(tmpJs);

// === Test 1: dict file exists + parses + has reasonable size ===
console.log('\n=== Test 1: jyutping_extended.json ===');
{
  const dictData = JSON.parse(fs.readFileSync(DICT_JSON, 'utf8'));
  const entries = Object.entries(dictData).filter(([k]) => !k.startsWith('_'));
  assert(entries.length >= 500, `dict has ≥500 entries (got ${entries.length})`);

  // All values must be jyutping string format
  const invalid = entries.filter(([k, v]) => !/^[a-z]+[1-6]$/.test(v));
  assert(invalid.length === 0, `all jyutping strings valid (got ${invalid.length} invalid)`);

  // Spot check expected mappings
  assert(dictData['你'] === 'nei5', '你→nei5');
  assert(dictData['我'] === 'ngo5', '我→ngo5');
  assert(dictData['食'] === 'sik6', '食→sik6');
  assert(dictData['食'] === 'sik6', '食→sik6 (2nd check)');
  assert(dictData['行'] === 'haang4', '行→haang4');
}

// === Test 2: _HOMOPHONE_TRAPS now has 30+ entries ===
console.log('\n=== Test 2: homophone traps expansion ===');
{
  const trapStart = html.indexOf('const _HOMOPHONE_TRAPS = {');
  const trapEnd = html.indexOf('};', trapStart) + 2;
  const trapCode = html.slice(trapStart, trapEnd);
  // Count entries by counting unique keys like 'XXX': [
  const entryCount = (trapCode.match(/'[^']+': \[\{ char:/g) || []).length;
  assert(entryCount >= 30, `≥30 trap entries (got ${entryCount})`);

  // Spot check new traps from Sprint 3
  assert(/'你': \[\{ char: '泥'/.test(trapCode), '你→泥 trap present');
  assert(/'大': \[\{ char: '太'/.test(trapCode), '大→太 trap present');
  assert(/'新': \[\{ char: '辛'/.test(trapCode), '新→辛 trap present');
  assert(/'聽': \[\{ char: '廳'/.test(trapCode), '聽→廳 trap present');
}

// === Test 3: renderFilteredAssessment has sentence branch ===
console.log('\n=== Test 3: renderFilteredAssessment sentence UI ===');
{
  const sentenceBranch = html.includes('class="sentence-display"');
  assert(sentenceBranch, 'sentence-display class used in render code');

  const phraseRender = html.includes("w.phrases.map(p => `<span class=\\\"phrase\\\"");
  assert(phraseRender || html.includes("w.phrases.map(p => `<span class=\"phrase\""),
    'phrase span render code present');

  const wordPathPreserved = html.includes('<div class="vocab-char">');
  assert(wordPathPreserved, 'word path (.vocab-char) preserved');
}

// === Test 4: result page per-phrase color ===
console.log('\n=== Test 4: resultWord per-phrase color ===');
{
  const phraseColor = html.includes("p.kind === 'matched' ? '#22c55e'");
  assert(phraseColor, 'matched = green color present');

  const nearColor = html.includes("p.kind === 'near' ? '#f59e0b'");
  assert(nearColor, 'near = orange color present');

  const homophoneColor = html.includes("p.kind === 'homophone' ? '#a855f7'");
  assert(homophoneColor, 'homophone = purple color present');

  const majorColor = html.includes("'#fb923c'");
  assert(majorColor, 'major = warm orange color present');

  const wordFallback = html.includes("resultWordEl.textContent = w.char");
  assert(wordFallback, 'word path textContent fallback preserved');
}

// === Test 5: _scoreToStars signature + ratio logic ===
console.log('\n=== Test 5: _scoreToStars matched ratio ===');
{
  const signature = html.match(/function _scoreToStars\(score, diagnosis\)/);
  assert(signature !== null, '_scoreToStars(score, diagnosis) signature');

  const ratioCheck = html.includes("diagnosis.matched.length / diagnosis.total");
  assert(ratioCheck, 'matched ratio calculation present');

  const threshold85 = html.includes('ratio >= 0.85');
  assert(threshold85, '85% threshold present');

  const threshold65 = html.includes('ratio >= 0.65');
  assert(threshold65, '65% threshold present');

  const wordMode = html.includes('score >= 75') && html.includes('score >= 45');
  assert(wordMode, 'word mode T1 fallback (75/45) preserved');

  const callSite = html.includes('_scoreToStars(aiScore, diagnosis)');
  assert(callSite, 'call site passes diagnosis arg');
}

// === Test 6: dict merge in init() ===
console.log('\n=== Test 6: dict merge logic in init() ===');
{
  const fetchPresent = html.includes("await fetch('data/jyutping_extended.json')");
  assert(fetchPresent, 'fetch jyutping_extended.json in init');

  const objectAssign = html.includes('Object.assign(_JYUTPING_DICT, cleaned)');
  assert(objectAssign, 'Object.assign to _JYUTPING_DICT');

  const metadataFilter = html.includes("!k.startsWith('_')");
  assert(metadataFilter, 'filter _comment / _source / _extracted metadata keys');

  const warn = html.includes("console.warn('[dict] extended load failed");
  assert(warn, 'console.warn on fetch fail (Family 4 mitigation)');
}

// === Test 7: version bump ===
console.log('\n=== Test 7: version ===');
const ver = (html.match(/_DEMO_SEED_VERSION = '([^']+)'/) || ['',''])[1];
assert(ver === 'v1.2.0', `version = v1.2.0 (got "${ver}")`);

// === Test 8: words.json still valid + sentence entries intact ===
console.log('\n=== Test 8: words.json regression ===');
{
  const wd = JSON.parse(fs.readFileSync(WORDS_JSON, 'utf8'));
  const sentenceCat = wd.categories.find(c => c.id === 'sentence');
  assert(sentenceCat && sentenceCat.words.length === 6, `sentence cat has 6 entries (got ${sentenceCat?.words.length})`);
  // Verify 我今日好開心 (no wordBoundary) entry for fallback test
  const noBoundary = sentenceCat.words.find(w => w.char === '我今日好開心');
  assert(noBoundary && !noBoundary.wordBoundary, '我今日好開心 has no wordBoundary (fallback test)');
  // Verify 今日天氣好好 (phrases but no wordBoundary)
  const phrasesOnly = sentenceCat.words.find(w => w.char === '今日天氣好好');
  assert(phrasesOnly && !phrasesOnly.wordBoundary && phrasesOnly.phrases, '今日天氣好好 has phrases but no wordBoundary');
}

console.log(`\n=== SUMMARY: ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
