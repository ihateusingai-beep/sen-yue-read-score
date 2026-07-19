# Sprint 3 Plan: UI Sentence Rendering + Score Scaling + 500-char Dict

**Project:** Sen Yue Read Score
**Sprint:** Tier 1 / Sprint 3
**Date:** 2026-07-18
**Status:** 📋 Draft for review

---

## 一、目標

Sprint 2 ship 咗 phrase-aware diagnosis (T2) logic 但**用戶睇唔到 phrases**：
- `renderFilteredAssessment` 仍用 `${_e(w.char)}` 大字 display sentence — 一舊字
- result page `resultWord.textContent = w.char` — 同樣一舊字
- 學生/老師唔知「『去咗』呢個 phrase 錯咗」

**Sprint 3 目標**：
1. UI 顯示 per-phrase chunks with kind color
2. Score scaling 改用 matched ratio (公平 word vs sentence)
3. Dictionary 擴到 500 chars 覆蓋 95% 常用字

---

## 二、改動 plan

### 改動 1 — UI sentence rendering (P1.5) 40 LoC

**File**: `index.html` line ~1110 (renderFilteredAssessment function)

**Sentence mode branch**:
```js
// 現有
<div class="vocab-char">${_e(w.char)}</div>

// 改 (only when w.type === 'sentence')
${w.type === 'sentence' && w.phrases && w.phrases.length > 0 ? `
  <div class="sentence-display" style="font-size:1.4em;line-height:1.8;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:12px 0;">
    ${w.phrases.map(p => `<span class="phrase" style="padding:6px 10px;border-radius:8px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.3);">${_e(p.char)}</span>`).join('')}
  </div>
` : `
  <div class="vocab-char">${_e(w.char)}</div>
`}
```

**Family 2 (reset-on-render) mitigation**: new branch 完整 conditional, word path unchanged。

### 改動 2 — Result page per-phrase color (P1.5) 25 LoC

**File**: `index.html` line ~1454 (scorePronunciation function)

**Replace `resultWord.textContent = w.char` with phrase rendering**:
```js
// 現有
document.getElementById('resultWord').textContent = w.char;

// 改
const resultWord = document.getElementById('resultWord');
if (diagnosis && diagnosis.phrases && diagnosis.phrases.length > 0) {
  // T2: per-phrase color based on kind
  resultWord.innerHTML = diagnosis.phrases.map(p => {
    const color = p.kind === 'matched' ? '#22c55e' : 
                  p.kind === 'near' ? '#f59e0b' : 
                  p.kind === 'homophone' ? '#a855f7' : 
                  '#fb923c';  // major or missing
    return `<span style="color:${color};font-weight:bold;margin:0 4px;">${_e(p.phrase)}</span>`;
  }).join('');
} else {
  // T1: word mode unchanged
  resultWord.textContent = w.char;
}
```

**Family 2 mitigation**: same conditional, no reset-on-render for word path。

### 改動 3 — Score scaling via matched ratio (P1.6) 25 LoC

**File**: `index.html` line ~828 (_scoreToStars function)

**Current**:
```js
function _scoreToStars(score) {
  if (score >= 75) return { stars: 3, ... };
  if (score >= 45) return { stars: 2, ... };
  return { stars: 1, ... };
}
```

**Change**: accept optional 2nd `diagnosis` param. If diagnosis present + has total > 0, use matched ratio. Else fall back to absolute score.

```js
function _scoreToStars(score, diagnosis) {
  // T2 sentence-mode: matched ratio for fairness
  if (diagnosis && diagnosis.total > 0 && Array.isArray(diagnosis.matched)) {
    const ratio = diagnosis.matched.length / diagnosis.total;
    if (ratio >= 0.85) return { stars: 3, emoji: '⭐⭐⭐', color: '#22c55e', label: '做得很好' };
    if (ratio >= 0.65) return { stars: 2, emoji: '⭐⭐', color: '#22c55e', label: '有進步' };
    return { stars: 1, emoji: '⭐', color: '#fb923c', label: '仍須努力' };
  }
  // T1 word-mode: absolute score (legacy)
  if (score >= 75) return { stars: 3, emoji: '⭐⭐⭐', color: '#22c55e', label: '做得很好' };
  if (score >= 45) return { stars: 2, emoji: '⭐⭐', color: '#22c55e', label: '有進步' };
  return { stars: 1, emoji: '⭐', color: '#fb923c', label: '仍須努力' };
}
```

**Family 1 (default-state desync) mitigation**: **3 call sites** 必須更新 pass diagnosis arg。

**Call sites audit** (grep `_scoreToStars(`):
1. `index.html` line ~1454: result page — 已 access `diagnosis`, 直接 pass
2. `index.html` line ~1118: custom engine path — 已 access `customScore`, 必須 pass null/undefined (no diagnosis)
3. `index.html` line ~1568: dashboard render `state.assessmentScores` — pass `s.diagnosis` (新 field 喺 scorePronunciation push)

### 改動 4 — 500-char dictionary (P1.4) 70 LoC

**File**: `data/jyutping_extended.json` (new, 500 entries)

**Source**: Rime Cantonese `https://github.com/rime/rime-cantonese`
- 提取 HSK1-3 (300 chars) + 粵語高頻 (200 chars)
- Format: `{"你": "nei5", "係": "hai6", ...}`

**Init merge in `index.html`**:
```js
// In init() after _JYUTPING_DICT initial declaration
fetch('data/jyutping_extended.json')
  .then(r => r.json())
  .then(data => {
    Object.assign(_JYUTPING_DICT, data);
    console.log(`[dict] extended loaded ${Object.keys(data).length} chars`);
  })
  .catch(e => console.warn('[dict] extended load failed, using base 80 chars', e));
```

**Family 4 (silent data loss) mitigation**: 
- fetch fail → base 80 chars 繼續 work
- 個別 char typo → diagnosis mark unmapped, 唔 crash
- console.warn visible to teacher via DevTools

### 改動 5 — 加 20 個新同音陷阱 (P1.4) 15 LoC

擴 `_HOMOPHONE_TRAPS`:
```js
const _HOMOPHONE_TRAPS = {
  // ... 13 existing
  '你': [{ char: '尼', jyut: 'nei4', note: '聲調 5→4' }],
  '我': [{ char: '臥', jyut: 'ngo6', note: '聲調 5→6' }],
  '大': [{ char: '太', jyut: 'taai3', note: '聲調 6→3' }],
  // ... 17 more
};
```

**Source**: 常見粵語同音混淆對，由老師 field data 收集 (Sprint 4 計劃)。

---

## 三、Sprint 3 5-bug-family audit

| # | Family | Risk | Mitigation |
|---|---|---|---|
| 1 | **default-state desync** | `_scoreToStars` 加 optional diagnosis param — 3 call sites | grep all + manual update + smoke test |
| 2 | **reset-on-render** | sentence render branch 完整 conditional, word path unchanged | smoke test 2 paths |
| 3 | **enable-condition off-by-concept** | matched ratio boundary 85%/65% sharp | smoke test boundary: 8/8=100%→3, 7/8=87.5%→3, 6/8=75%→2, 5/8=62.5%→1 |
| 4 | **silent data loss** | dict load fail silent → console.warn required, fallback to base dict | smoke test: simulate fetch fail |
| 5 | **dead code via name collision** | 500 new dict keys vs 80 existing — no collision risk (unique 漢字) | smoke test: dict size >= 580, no duplicate values |

---

## 四、Effort estimate

| Task | LoC | Risk |
|---|---|---|
| P1.5 renderFilteredAssessment sentence UI | 40 | Low |
| P1.5 result page phrase color | 25 | Low |
| P1.6 _scoreToStars matched ratio | 25 | Medium |
| P1.4 500-char dict extract (separate file) | 70 (data) | Low |
| P1.4 dict merge in init | 10 | Low |
| P1.4 +20 homophone traps | 15 | Low |
| docs/TIER1_SPRINT3_VERIFY_SCRIPT.js | 200 | Low |
| _DEMO_SEED_VERSION v1.2.0-beta.2 → v1.2.0 | 1 | — |
| **Total** | **~385 LoC** | **Low-Medium** |

---

## 五、Smoke test plan (12 cases)

```js
// Test 1-3: sentence UI render (HTML structure)
- word[0].type='word' → render uses .vocab-char (legacy)
- sentence with phrases → render uses .sentence-display with N phrase spans
- sentence without phrases → fall back to .vocab-char (defensive)

// Test 4-6: result page phrase color
- perfect (4/4 matched) → all green spans
- 1 phrase near (3/4 matched) → 3 green + 1 orange
- 1 phrase missing → 3 green + 1 orange (major kind)

// Test 7-10: score scaling with matched ratio
- 8/8 matched (100%) → 3 stars ⭐⭐⭐
- 7/8 matched (87.5%) → 3 stars (≥85%)
- 6/8 matched (75%) → 2 stars (≥65%)
- 5/8 matched (62.5%) → 1 star (<65%)
- word mode (no diagnosis) → use absolute score (legacy)

// Test 11-12: dict size + no collision
- _JYUTPING_DICT size >= 580 after fetch
- No duplicate values in dict (sanity)
```

---

## 六、Rollout

### Sprint 3 (P1.4 + P1.5 + P1.6)
1. Extract 500 chars from Rime Cantonese → `data/jyutping_extended.json` (5 min manual work)
2. P1.5: renderFilteredAssessment + result page UI sentence rendering
3. P1.6: _scoreToStars matched ratio + 3 call sites update
4. P1.4: dict merge in init() + 20 homophone traps
5. Smoke test 12 cases
6. Deploy v1.2.0

### Post-Sprint 3 (Sprint 4+ 候選)
- Audio replay (sentence 回聽自己錄音)
- 老師手動校準/編輯 homophone traps UI
- Phrase difficulty marking
- 5-tier star scaling for advanced students
- Backend Whisper large (out of Tier 1 scope)

---

## 七、Open questions

1. **Sentence UI 顏色** — Phrase background color 7% 紫色 tint OK？或者全白色底？
2. **Matched ratio 85% / 65%** 邊界係咪太鬆？老師 field data 試 1 週先知
3. **500 chars** 定 **1000 chars** 一次過 inline？(1000 chars = 10KB, deploy size +5%, 唔影響)
4. **dict 來源** — Rime Cantonese OR Cantonese-Mandarin parallel corpus OR 老師手動標註？建議 Rime + 老師 verify 高頻 100 chars

---

## 八、Risk-gate

每個 sub-task ship 前：
- [ ] Smoke test 4 cases 全綠
- [ ] Live page syntax check 過
- [ ] 1 個真實 user (老師) 試 1 個 sentence sign-off

收工：
- [ ] Deploy GH Pages 5-15 min
- [ ] 確認 1 個 sentence E2E OK
- [ ] `_DEMO_SEED_VERSION` bump
- [ ] Memory update
