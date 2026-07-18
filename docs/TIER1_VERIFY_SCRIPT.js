// Tier 1 Sprint 1 verification script
// Run: node docs/TIER1_VERIFY_SCRIPT.js
// Pre-req: must be run from project root: /Users/kencheng/workspace/vs code/education/chinese/sen-yue-read-score

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = process.cwd();
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');
const WORDS_JSON = path.join(PROJECT_ROOT, 'data', 'words.json');

let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { console.log('  ✅', name); pass++; }
  else { console.log('  ❌', name); fail++; }
}

console.log('\n=== Sprint 1: pre-flight ===');
console.log('CWD:', PROJECT_ROOT);
console.log('index.html exists:', fs.existsSync(INDEX_HTML));
console.log('words.json exists:', fs.existsSync(WORDS_JSON));

// 1. JSON parse
console.log('\n=== Test 1: words.json parse + sentence schema ===');
let wordsData;
try {
  wordsData = JSON.parse(fs.readFileSync(WORDS_JSON, 'utf8'));
  assert(true, 'JSON parses');
  const cats = wordsData.categories || [];
  assert(cats.length === 4, `4 categories (got ${cats.length})`);
  const sentenceCat = cats.find(c => c.id === 'sentence');
  assert(sentenceCat !== undefined, 'sentence category exists');
  if (sentenceCat) {
    assert(sentenceCat.words.length === 5, `5 sentence entries (got ${sentenceCat.words.length})`);
    sentenceCat.words.forEach((w, i) => {
      assert(w.type === 'sentence', `entry ${i} type=sentence`);
      assert(Array.isArray(w.wordBoundary), `entry ${i} has wordBoundary array`);
      assert(Array.isArray(w.phrases), `entry ${i} has phrases array`);
      // Verify wordBoundary matches char length
      const totalChars = w.wordBoundary.reduce((s, p) => s + [...p].length, 0);
      assert(totalChars === [...w.char].length, `entry ${i} wordBoundary covers full char (${totalChars} === ${[...w.char].length})`);
    });
  }
} catch (e) {
  assert(false, 'words.json parse failed: ' + e.message);
  process.exit(1);
}

// 2. Inline JS extract + syntax check (uses node --check equivalent)
console.log('\n=== Test 2: inline JS syntax ===');
const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch !== null, 'inline script block found');
if (scriptMatch) {
  const tmpJs = '/tmp/_tier1_syntax_check.js';
  fs.writeFileSync(tmpJs, scriptMatch[1]);
  const { execSync } = require('child_process');
  try {
    execSync(`node --check ${tmpJs}`, { stdio: 'pipe' });
    assert(true, 'node --check OK');
  } catch (e) {
    assert(false, 'node --check failed: ' + e.stderr.toString().slice(0, 200));
  }
  fs.unlinkSync(tmpJs);
}

// 3. _deriveWordBoundary + back-compat fallback
console.log('\n=== Test 3: _rebuildWords back-compat ===');
// We need to extract enough inline JS to test _rebuildWords in isolation.
// Extract the _rebuildWords + _deriveWordBoundary block.
const rebuildStart = html.indexOf('function _rebuildWords()');
const rebuildEnd = html.indexOf('// ================== LOGIN', rebuildStart);
const rebuildCode = rebuildEnd > rebuildStart ? html.slice(rebuildStart, rebuildEnd) : '';
const sandbox = {
  console,
  state: {},
  setTimeout, clearTimeout,
};
vm.createContext(sandbox);
try {
  vm.runInContext(rebuildCode, sandbox);
  assert(typeof sandbox._rebuildWords === 'function', '_rebuildWords defined');
  assert(typeof sandbox._deriveWordBoundary === 'function', '_deriveWordBoundary defined');

  // Test _deriveWordBoundary with 4-char / 6-char / 8-char sentences
  const d = sandbox._deriveWordBoundary;
  assert(JSON.stringify(d('小明今日')) === JSON.stringify(['小明', '今日']), '4-char → 2 chunks');
  assert(JSON.stringify(d('小明今日去咗公園')) === JSON.stringify(['小明', '今日', '去咗', '公園']), '8-char → 4 chunks');
  assert(JSON.stringify(d('爸爸買咗新嘅車')) === JSON.stringify(['爸爸', '買咗', '新嘅', '車']), '7-char → 4 chunks (last chunk 1 char)');

  // Test _rebuildWords with mixed word + sentence
  const state = {
    categories: [
      { id: 'season', label: '季節', enabled: true,
        words: [{ char: '春天', pinyin: 'cheun tin', target: '春天' }] }, // legacy: no type
      { id: 'sentence', label: '句子', enabled: true,
        words: [
          // with wordBoundary
          { char: '小明今日去咗公園', type: 'sentence', wordBoundary: ['小明', '今日', '去咗', '公園'] },
          // WITHOUT wordBoundary — must auto-derive
          { char: '今日天氣好好', type: 'sentence' },
        ]
      }
    ],
    words: [],
    selectedCategoryIds: []
  };
  sandbox.state = state;
  sandbox._rebuildWords();
  assert(state.words.length === 3, '3 words rebuilt (1 word + 2 sentences)');

  // legacy word default type
  assert(state.words[0].type === 'word', 'legacy word auto-set type=word');
  assert(state.words[0].char === '春天', 'word[0] = 春天');
  assert(state.words[0].categoryId === 'season', 'word[0].categoryId = season');

  // sentence with explicit wordBoundary
  assert(state.words[1].type === 'sentence', 'words[1].type = sentence');
  assert(state.words[1].wordBoundary.length === 4, 'words[1] wordBoundary preserved');

  // sentence without wordBoundary — auto-derive fallback
  assert(state.words[2].type === 'sentence', 'words[2].type = sentence');
  assert(state.words[2].wordBoundary.length === 3, `words[2] wordBoundary auto-derived (got ${state.words[2].wordBoundary.length}, expected 3)`);
  assert(JSON.stringify(state.words[2].wordBoundary) === JSON.stringify(['今日', '天氣', '好好']), 'words[2] wordBoundary = ["今日","天氣","好好"]');
} catch (e) {
  assert(false, '_rebuildWords test crashed: ' + e.message + '\n' + e.stack);
}

// 4. Timeout range + effectiveTimeout
console.log('\n=== Test 4: timeout range + sentence override ===');
const rtc = (html.match(/recordingTimeout: \d+/) || [''])[0];
assert(rtc === 'recordingTimeout: 8', `default = 8 (got "${rtc}")`);

const range1 = (html.match(/t >= \d+ && t <= \d+/) || [''])[0];
assert(range1 === 't >= 5 && t <= 30', `load range = 5-30 (got "${range1}")`);

const range2 = (html.match(/Math\.max\(\d+, Math\.min\(\d+, state\.recordingTimeout \+ delta\)\)/) || [''])[0];
assert(range2 === 'Math.max(5, Math.min(30, state.recordingTimeout + delta))', `adjust range = 5-30 (got "${range2}")`);

const effCheck = html.includes('effectiveTimeout = (state.currentWord && state.currentWord.type === \'sentence\')');
assert(effCheck, 'effectiveTimeout override logic present');

const min15Check = html.includes('Math.max(state.recordingTimeout, 15)');
assert(min15Check, 'sentence min 15s override present');

const btnCheck = html.match(/預設 8秒|慢朗讀 15秒|句子 25秒/g) || [];
assert(btnCheck.length === 3, `3 new button labels present (got ${btnCheck.length}: ${btnCheck.join(', ')})`);

// 5. _DEMO_SEED_VERSION bump
console.log('\n=== Test 5: version bump ===');
const ver = (html.match(/_DEMO_SEED_VERSION = '([^']+)'/) || ['',''])[1];
assert(ver === 'v1.2.0-beta.1', `version = v1.2.0-beta.1 (got "${ver}")`);

// 6. Git status check
console.log('\n=== Test 6: git status ===');
try {
  const { execSync } = require('child_process');
  const status = execSync('git status --short', { encoding: 'utf8' });
  console.log('  git status output:');
  console.log(status.split('\n').filter(l => l).map(l => '    ' + l).join('\n'));
  assert(status.includes('M  index.html') || status.includes('M index.html'), 'index.html modified');
  assert(status.includes('M  data/words.json') || status.includes('M data/words.json'), 'data/words.json modified');
} catch (e) {
  assert(false, 'git status failed: ' + e.message);
}

console.log(`\n=== SUMMARY: ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
