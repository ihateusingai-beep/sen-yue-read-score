# Tier 1 Implementation Plan: 句子級朗讀評分 (Sentence-Level Support)

**Project:** Sen Yue Read Score (粵語朗讀評分)
**Author:** Mavis
**Date:** 2026-07-18
**Status:** 📋 Draft for review
**Scope:** Pure HTML SPA, 5-15 個漢字句子, 唔做 backend

---

## 一、目標

由 **詞彙級（1-4 字）** 升級到 **句子級（5-15 字）**：

| 場景 | 之前 | 之後 |
|---|---|---|
| 詞彙（春天/夏天/滴滴答答）| ✅ | ✅ 不變 |
| 短語（春天好靚/蝴蝶飛舞）| ❌ | ✅ |
| 句子（小明今日去咗公園）| ❌ | ✅ |
| 段落（20+ 字）| ❌ | ❌ 不做 (Tier 2+) |

**冇 backend**, **冇 cross-device sync**, **唔擴大 localStorage** 之外嘅 storage。

---

## 二、現狀 audit（v1.1.13 base）

### 2.1 詞庫 schema

```json
{
  "char": "春天",
  "pinyin": "cheun tin",
  "meaning": "春季",
  "target": "春天",
  "image": "chun-tin.png"
}
```

- **`target` = 1-on-1 with `char`**
- **冇 `type` field**（默認 "word"）
- **冇 `wordBoundary`**（冇法做 phrase-level 診斷）

### 2.2 錄音 timeout range

- L1886, L2001: `Math.max(2, Math.min(15, ...))` → **2-15 秒**
- 預設 button: **4/6/8 秒** (L2114-2116)
- WebSpeech auto-abort: **recordingTimeout + 5s** (L1119)

**短句需要 ≥5 秒**。10 個漢字慢讀約 8-10 秒（4-5 字/秒）。需要放寬到 **20-30 秒**。

### 2.3 診斷字典 `_JYUTPING_DICT`

- 大約 **80 chars** + 13 個同音陷阱
- **句子 = 10 個 chars random** → 命中率 50-60%（有 5-6 個唔識）
- 需要 expand 到 **500 chars** 覆蓋 95% 常用字

### 2.4 診斷函式 `_diagnosePronunciation`

而家係 **char-by-char** 配對（target char 對 user char），**冇 phrase-level 診斷**。句子：「小明今日去咗公園」入面「今日」一齊講，個別字錯唔應該怪「日」要怪「今日」。

---

## 三、改動 plan

### 改動 1 — 詞庫 schema extend (P1.1)

**Files**: `data/words.json` (加 sentence entries) + schema doc

```json
{
  "char": "小明今日去咗公園",
  "pinyin": "siu ming gam jat heoi liu gung jyun",
  "meaning": "句子示例",
  "target": "小明今日去咗公園",
  "image": null,
  "type": "sentence",
  "wordBoundary": ["小明", "今日", "去咗", "公園"],
  "phrases": [
    { "start": 0,  "end": 2,  "char": "小明" },
    { "start": 2,  "end": 4,  "char": "今日" },
    { "start": 4,  "end": 6,  "char": "去咗" },
    { "start": 6,  "end": 8,  "char": "公園" }
  ]
}
```

**新 field 解析**:
- `type: "sentence"` → 觸發 sentence-mode rendering + 診斷
- `wordBoundary` → chunk 邊界，診斷時按 chunk 切
- `phrases[]` → 顯示用（學生見到「小明 今日 去咗 公園」分段）
- 舊 entries 冇 `type` → 默認 `"word"`（向後兼容）

**Schema 載入邏輯** (index.html L1716 init):
```js
// Existing reconcile logic, then:
state.words.forEach(w => {
  if (!w.type) w.type = 'word'; // back-compat
  if (w.type === 'sentence' && !w.wordBoundary) {
    // Auto-derive wordBoundary from char (split every 2 chars)
    w.wordBoundary = _deriveWordBoundary(w.char);
  }
});
```

### 改動 2 — 錄音 timeout 放寬 (P1.2)

**Files**: index.html (3 places: state default, settings, button options)

| 位置 | 而家 | 之後 |
|---|---|---|
| L310 `state.recordingTimeout: 4` | 4 | 6 |
| L1886 `Math.max(2, Math.min(15, ...))` | 2-15 | **5-30** |
| L2001 `Math.max(2, Math.min(15, ...))` | 2-15 | **5-30** |
| L2114-2116 button options | 4/6/8 | **8/15/25** (default 8, slow 15, super-slow 25) |

**WebSpeech auto-abort** (L1105): `recordingTimeout + 5s` — 句子慢讀 25s 就要 30s auto-abort。**OK 唔使改 logic**。

**新增 words 時 type 影響**:
```js
const effectiveTimeout = (state.currentWord?.type === 'sentence')
  ? Math.max(state.recordingTimeout, 15)
  : state.recordingTimeout;
_startCountdownBar(effectiveTimeout);
```

確保 sentence **至少 15 秒**（避免 4s 預設切到 8s 短句都唔夠）。

### 改動 3 — `_diagnosePronunciation` phrase-aware (P1.3)

**File**: index.html L490 (`_diagnosePronunciation` function)

**新增 logic**:
```js
function _diagnosePronunciation(transcript, target, wordPinyin, wordBoundary) {
  // Step 1: split target into phrases
  const phrases = wordBoundary || [target]; // default whole-target if no boundary
  let userCursor = 0;
  const phraseResults = [];

  for (const phrase of phrases) {
    const phraseChars = [...phrase];
    // Greedy match: take next len(phrase) chars from transcript
    const userSlice = [...transcript].slice(userCursor, userCursor + phraseChars.length).join('');
    const sliceSylls = _transcriptToSyllables(userSlice);
    // Per-phrase diagnosis
    const result = _diagnoseCharSequence(phraseChars, sliceSylls);
    phraseResults.push({ phrase, userSlice, ...result });
    userCursor += phraseChars.length;
  }

  // Step 2: aggregate
  return {
    phrases: phraseResults,
    matched: phraseResults.flatMap(p => p.matched),
    nearMiss: phraseResults.flatMap(p => p.nearMiss),
    wrong: phraseResults.flatMap(p => p.wrong),
    homophone: phraseResults.flatMap(p => p.homophone),
    missing: phraseResults.flatMap(p => p.missing),
    unmapped: phraseResults.flatMap(p => p.unmapped || []),
    summary: _summaryFromPhrases(phraseResults),
    total: phrases.reduce((s, p) => s + [...p].length, 0),
  };
}
```

**Per-phrase diagnosis** (`_diagnoseCharSequence`):
- 對每個 phrase，攞 user transcript 對應 slice chars
- 跑 existing `_classifyError` per char
- 收集 per-phrase matched/nearMiss/wrong/missing

**Summary 邏輯 (per phrase ratio)**:
- 80% matched → perfect
- 60-79% → near
- < 60% → major

**Phrase-level feedback**:
- 學生版:「『今日』差少少，集中啲」、「『去咗』讀成咗『去左』(同音陷阱)」
- 老師版: 逐 phrase 顯示診斷

### 改動 4 — 字典 expand (P1.4)

**File**: index.html L329 (`_JYUTPING_DICT`)

**Target**: **500 chars** 覆蓋 HSK1-3 + 粵語常用字

**Source**:
- 開源 `rime-cantonese` 字典 (CC-CEDICT + jyutping mapping)
- GitHub: `https://github.com/rime/rime-cantonese`
- Subset: HSK1-3 = 300 字, 粵語高頻 = 200 字

**Plan**:
1. 從 Rime Cantonese 字典 extract 500 char jyutping mapping
2. 集成入 `_JYUTPING_DICT` (extracted as separate `data/jyutping_dict.json` 喺 Tier 1.5)
3. 或者 inline 入 index.html (single-file) — 500 entries × ~10 chars = 5KB, 唔影響 deploy size

**Approach A (simple, single-file)**: inline
```js
const _JYUTPING_DICT = {
  // ... 現有 80 chars
  // ... 新增 420 chars
};
```

**Approach B (modular)**: separate `data/jyutping.json`, fetch on init
- Pro: 唔影響 index.html size
- Con: 額外 HTTP request, race condition risk

**Recommendation**: Approach A (single-file, 5KB acceptable)

**同音陷阱 expand**: 13 → 30+
- 加: 大/太、家/加/假、佢/居、高/搞、好/號...

### 改動 5 — UI sentence-mode (P1.5)

**File**: index.html L978 (`renderFilteredAssessment`)

**Sentence rendering**:
```js
// 現有
<div class="vocab-char">${_e(w.char)}</div>
<div class="vocab-pinyin">${_e(w.pinyin)}</div>

// 句子 mode
${w.type === 'sentence' ? `
  <div class="sentence-display" style="font-size:1.6em;line-height:1.8;">
    ${w.phrases?.map(p => `<span class="phrase" data-phrase="${_e(p.char)}" style="padding:4px 8px;border-radius:8px;background:rgba(124,58,237,0.1);">${_e(p.char)}</span>`).join(' ')}
  </div>
  <div class="vocab-pinyin">${_e(w.pinyin)}</div>
` : `
  <div class="vocab-char">${_e(w.char)}</div>
  <div class="vocab-pinyin">${_e(w.pinyin)}</div>
`}
```

**Result page (per-phrase 顯示)**:
- 用 唔同 color 顯示 啱 / 差啲 / 錯嘅 phrase
- 綠 = matched, 黃 = near, 紅(暖橙) = wrong/missing

```js
const phraseHtml = diagnosis.phrases.map(p => {
  const color = p.kind === 'matched' ? '#22c55e' : 
                p.kind === 'nearMiss' ? '#f59e0b' : 
                '#fb923c';
  return `<span style="color:${color};font-weight:bold;">${_e(p.phrase)}</span>`;
}).join(' ');
```

### 改動 6 — Score scaling 句子上調 (P1.6)

**File**: index.html `_scoreToStars` (Tier 1 後)

**問題**: 10 字句子「全啱」拎 100，但學生讀第 9 字錯咗，扣 8 分變 92，仲係 3 星。**但讀 2 個 phrase 錯**就跌到 60 分（2 星）。

**改動**: 用 phrase ratio 唔用 absolute score
```js
function _scoreToStars(score, totalChars) {
  const ratio = score / 100; // 0-1
  if (ratio >= 0.85) return 3 stars;  // 85%+ correct
  if (ratio >= 0.65) return 2 stars;  // 65-84%
  return 1 star;  // <65%
}
```

但 100 字 90% = 90 拎 3 星，但 5 字 90% = 4.5 字啱 = 45 拎 1 星 — **不公平**。

**更好**: 用 matched / total ratio
```js
const matchedRatio = diagnosis.matched.length / diagnosis.total;
if (matchedRatio >= 0.85) return 3;
if (matchedRatio >= 0.65) return 2;
return 1;
```

呢個 independent of score 公式, 公平對 word 同 sentence。

### 改動 7 — 持久化 (P1.7) — **不變**

Sentence 同 word 一樣用 `state.assessmentScores[]` push 落去。**schema 唔變**:
```js
state.assessmentScores.push({
  word: w.char,           // "小明今日去咗公園"
  score: aiScore,         // 0-100 (overall string similarity)
  transcript,             // full transcript
  engine, method, diagnosis  // diagnosis 已經有 phrases[] structure
});
```

Dashboard 顯示 sentence 用 `word` field 截短:
```js
${s.word.length > 6 ? s.word.slice(0, 6) + '…' : s.word}
```

---

## 四、Effort & Risk

### 4.1 Effort estimate

| 改動 | LoC | Sprint |
|---|---|---|
| P1.1 schema extend | 30 | 1 |
| P1.2 timeout 放寬 | 15 | 1 |
| P1.3 phrase-aware 診斷 | 120 | 1-2 |
| P1.4 dict expand 80→500 | 50 (data) | 2 |
| P1.5 UI sentence | 80 | 2 |
| P1.6 score scaling | 25 | 2 |
| P1.7 持久化 | 0 (不變) | — |
| **Total** | **320 LoC** | **2-3 sprint** |

### 4.2 Risk matrix

| Risk | 機率 | 影響 | 緩解 |
|---|---|---|---|
| WebSpeech 30 秒 timeout 撞牆 (Chrome 60 秒硬頂) | 中 | 高 | 加 `(timeout - 2) * 1000` early warning, 鼓勵用戶收尾 |
| 500 chars 字典出錯 (jyutping 不準) | 高 | 中 | 用 Rime 開源 dict + smoke test 30 chars 驗證 |
| Phrase auto-derive 唔啱粵語斷字 | 高 | 高 | 強制老師手動填 `wordBoundary`, 唔 auto-derive |
| Long transcript 截斷 localStorage quota | 中 | 高 | sentence scores 同 word scores 一樣 JSON.stringify，< 5KB, 唔撞 |
| 句子診斷太嚴: 1 個字錯 = 0 星 | 中 | 中 | 用 matched ratio (P1.6), 唔用 absolute score |
| Phrase-level 同音陷阱 miss | 中 | 中 | 將現有 13 個 traps 應用 per-phrase, 唔 per-char |
| iPad Safari 30 秒 auto-stop | 中 | 中 | 加顯式 user-手動 stop button (按住 mic icon 講完即鬆) |

### 4.3 Backward compat

- **舊 `data/words.json` entries** 冇 `type` → auto-default `"word"` ✅
- **舊 `_JYUTPING_DICT` 80 chars** 保留 + 擴充 ✅
- **舊 `state.assessmentScores` schema** 不變 ✅
- **舊 user localStorage** 唔需 reset ✅
- **`_DEMO_SEED_VERSION` bump** `v1.1.13 → v1.2.0` (semver: minor = feature add)

---

## 五、Smoke test plan

每個 PR 必過：

### Unit-level (Node sandbox)
- `_diagnosePronunciation('小明', '小明', null, ['小明'])` → perfect, matched=2
- `_diagnosePronunciation('小名', '小明', null, ['小明'])` → wrong=1 (名 vs 明: m-vs-mg)
- `_diagnosePronunciation('小', '小明', null, ['小明'])` → missing=1
- `_deriveWordBoundary('小明今日去咗公園')` → `['小明', '今日', '去咗', '公園']` (default 2-char chunks)
- `_JYUTPING_DICT` size check ≥ 500
- `_scoreToStars(60, 5)` (60% matched) → 1 star; `_scoreToStars(60, 10)` (60% matched) → 1 star

### Integration (Playwright)
- 加 1 個 sentence entry 入 words.json
- 撳「即時評估」揀 sentence
- 確認 render 顯示 phrase chunked
- 確認 timeout display = 15s+
- 確認 student 撳錄音 → auto-abort 後 button re-enable
- 確認 result page per-phrase 顏色對

### E2E (real Chrome on Mac)
- 錄 1 個 sentence, WebSpeech ASR 拿到完整 transcript
- 確認診斷有 phrases[] 結構
- 確認 score 合理 (matched 80% → 3 stars)
- 確認 dashboard 顯示新 sentence 嘅 attempt

### Negative test
- 錄超長 (>20 字) sentence → auto-abort 觸發
- WebSpeech fail (Safari) → fallback 流程 work
- 字典 miss 50% chars → unmapped branch 觸發, 唔 crash

---

## 六、Rollout plan

### Sprint 1 (P1.1 + P1.2 + smoke) — **CODE COMPLETE, VERIFICATION DEFERRED**
1. ✅ 改 `data/words.json` schema，加 5 個示例 sentences
2. ✅ 改 `state.recordingTimeout` default 4 → 8 (note: 8 not 6, covers both word + sentence in default)
3. ✅ 改 button options 4/6/8 → 8/15/25
4. ✅ 改 `Math.max/min` range 2-15 → 5-30
5. ✅ Auto-derive `wordBoundary` if missing (`_deriveWordBoundary` helper)
6. ⏸ Smoke test: deferred (bash hook stale, see below)
7. ⏸ Deploy `v1.2.0-beta.1`: deferred (need smoke + git push)

**Sprint 1 verification 工具** (run in fresh session with shell access):
- `node docs/TIER1_VERIFY_SCRIPT.js` — unit-level (JSON parse, syntax, _rebuildWords, _deriveWordBoundary, timeout range)
- `node docs/TIER1_PLAYWRIGHT_VERIFY.mjs` — E2E (live page, sentence category visible, buttons, effectiveTimeout, screenshots)

**⚠️ Bash hook status**: `IS_DEFAULT_WORKSPACE=/Users/kencheng/workspace/sen-yue-read-score` 喺 system prompt 鎖死, 但項目實際喺 `vs code/education/chinese/sen-yue-read-score/`. 全部 bash command 喺呢個 session hang 死. **Sprint 1 + Sprint 2 嘅 verify + commit + push 全部要喺新 session (cwd 修咗) 做**.

**Sprint 1 完成度**:
- Code: 100% done (6/6 sub-tasks)
- Verification: 0% (deferred)
- Commit + push: 0% (deferred)
- Deploy: 0% (deferred)

**Sprint 1 改動清單** (待 commit):
- `data/words.json`: +5 sentence entries, +1 category `sentence`
- `index.html`:
  - L312 `state.recordingTimeout: 4` → `8` + comment
  - L1030-1043 `_rebuildWords` back-compat (type + wordBoundary defaults)
  - L1929-1934 新 `_deriveWordBoundary(sentence)` helper
  - L1043-1050 `effectiveTimeout` 強制 ≥15s 喺 sentence-mode
  - L1135 WebSpeech auto-abort 用 effectiveTimeout+5
  - L1233 MediaRecorder auto-stop 用 effectiveTimeout
  - L1894 load range 2-15 → 5-30
  - L2019 adjustTimeout range 2-15 → 5-30
  - L2132-2134 buttons 4/6/8 → 8/15/25
  - L2312 `_DEMO_SEED_VERSION` `v1.1.13` → `v1.2.0-beta.1`

### Sprint 2 (P1.3 + P1.4)
1. 寫 `_diagnoseCharSequence` helper
2. 改 `_diagnosePronunciation` 接受 `wordBoundary` param
3. Phrase-level matched/nearMiss/wrong/missing aggregation
4. 從 Rime Cantonese extract 500 chars jyutping → `_JYUTPING_DICT`
5. 加 20 個新同音陷阱
6. Smoke test: 10 sentence diagnosis cases
7. Deploy `v1.2.0-beta.2`

### Sprint 3 (P1.5 + P1.6)
1. UI sentence rendering (per-phrase color)
2. Result page per-phrase visualization
3. `_scoreToStars` 用 matched ratio
4. Dashboard 截短長 sentence display
5. E2E: 真實 student flow 試 5 個 sentence
6. Deploy `v1.2.0`

### Post-launch monitoring
- 收集 1 週 field data:
  - Sentence vs word 練習比例
  - WebSpeech auto-abort rate
  - Phrase-level 診斷準確率 (老師反饋)
  - 字典 miss rate
- 如果 matched ratio < 80% 用戶感覺 3 星太鬆, 收緊到 0.88
- 如果 WebSpeech > 25 秒 auto-stop 撞, default 降到 20s

---

## 七、Out of scope (Tier 2+ 唔做)

| Feature | 點解唔做 |
|---|---|
| 段落 50+ 字 | WebSpeech 連續 ASR 60 秒硬頂 + 中文連續 error rate 30-50% |
| IndexedDB 音檔儲存 | localStorage + audio blob URL 暫時夠用 (5MB quota) |
| 音檔 re-playback | 學生 re-listen 自己錄音嘅 UX 唔 critical for Tier 1 |
| Cross-device sync | 一定要 backend, scope 太大 |
| Backend Whisper large | 1.5GB model 唔可行 pure HTML |
| Worker 跑 ASR | Tier 1 WebSpeech 同步夠用, Worker 留 Tier 2 |
| 錄音片段 rewind 編輯 | 學生重錄即可, 唔 critical |
| Sentence difficulty level | 老師手動 mark, automatic 太複雜 |

---

## 八、Open questions (要老師 / 校方決定)

1. **Sentence length 上限**: 15 字夠唔夠？要唔要 20 字？
   - 15 字 ≈ 5-6 個短語, 適合課堂朗讀
   - 20 字 ≈ 8 個短語, 較 challenging
   - 建議 15 字

2. **Phrase boundary 點定**: 自動 (2-char chunk) 定老師手動？
   - 自動: 省事但可能切錯
   - 手動: 準但要逐句填
   - **建議混合**: 默認 2-char, 老師可手動 override (P1.1 schema 已 include `wordBoundary`)

3. **Dict size 500 定 1000**: 
   - 500: 95% 常用字覆蓋, 5KB inline
   - 1000: 99% 覆蓋, 10KB
   - 建議 v1.2.0 用 500, v1.3.0 升到 1000 (data-driven)

4. **Sentence `image` field 點處理**: 
   - 句冇對應單一 image (e.g. 「小明去公園」冇 image)
   - 建議: `image: null` 觸發 render 跳過圖片 block, 顯示純文字

5. **Sentence 嘅「仍須努力」threshold 點定**: 
   - 65% matched = 2 stars (現行)
   - 50% matched = 2 stars (更鬆)
   - 建議維持 65%, 觀察 1 週 field data

---

## 九、成功指標

**老師角度**:
- Sentence exercise 比例 ≥ 30% (Tier 1 啟用 1 個月後)
- 老師「句子診斷有幫助」Likert 4-5 ≥ 70%
- 5-10 字句子 average student score ≥ 70 (2 stars baseline)

**學生角度**:
- 句子練習完成率 ≥ 80% (學生唔好中途放棄)
- Re-record rate < 30% (學生對 1st 結果唔滿意 < 30%)
- 「覺得句子比詞彙有用」≥ 60%

**系統角度**:
- WebSpeech ASR 命中率 ≥ 70% (10 字句子有 7+ 字 transcript 啱)
- Phrase-level diagnosis 準確率 ≥ 80% (matched/near/wrong 分類對)
- Auto-abort rate < 10% (句子做唔完 < 10%)

---

## 十、File-level diff summary

| File | Action | LoC |
|---|---|---|
| `data/words.json` | 加 5 個 sentence entries | +30 |
| `index.html` (L329) | `_JYUTPING_DICT` expand 80 → 500 chars | +50 |
| `index.html` (L477) | `_HOMOPHONE_TRAPS` expand 13 → 30+ | +20 |
| `index.html` (L490) | `_diagnosePronunciation` phrase-aware refactor | +120 |
| `index.html` (L978) | `renderFilteredAssessment` sentence mode | +60 |
| `index.html` (L1019) | sentence mode timeout logic | +15 |
| `index.html` (L1346) | `scorePronunciation` result page per-phrase | +30 |
| `index.html` (L1411) | `_scoreToStars` matched ratio | +20 |
| `index.html` (L1886) | `state.recordingTimeout` range 2-15 → 5-30 | +2 |
| `index.html` (L2114) | button options 4/6/8 → 8/15/25 | +2 |
| `index.html` (init) | `wordBoundary` auto-derive fallback | +20 |
| `docs/TIER1_SENTENCE_LEVEL_PLAN.md` | this doc | +400 |
| `docs/SENTENCE_DICT_REFERENCE.md` | new — jyutping 字典 source-of-truth | +100 |
| **Total** | | **~870 LoC** |

---

## 十一、Risk-gate 必過

每個 sprint 開工前：
- [ ] Smoke test 20 cases 全綠
- [ ] Live page syntax check 過
- [ ] 1 個真實 user (老師) 試 1 個 sentence 後 sign-off

每個 sprint 收工：
- [ ] Deploy 上 GH Pages 5-15 分鐘 edge propagation
- [ ] 確認 1 個 sentence flow end-to-end OK
- [ ] `_DEMO_SEED_VERSION` bump
- [ ] Memory file update（entry 寫新發現）

---

**📌 下一步**: 等老師過目，回應 Section 八嘅 5 個 design question + 確認是否開始 Sprint 1。
