# 評分機制優化計劃書：中度智障（MID）學生適配

**Project:** Sen Yue Read Score (粵語朗讀評分)
**Author:** Mavis（評估 + 規劃，未實作）
**Date:** 2026-06-15
**Status:** 📋 Draft for teacher review

---

## 一、背景與目的

### 1.1 現時目標用戶

`README.md` + `TEACHER_GUIDE.md` 將用戶定位為「SEN 學生（特殊教育需要）」，但未細分 severity。**中度智障（Moderate Intellectual Disability, MID）** 一般指 IQ 35-55，伴隨：

- 語言表達遲緩、發音不準
- 抽象符號理解弱（文字、數字）
- 專注時段短（單一任務 5-10 分鐘）
- 對挫敗感敏感（需要高頻正強化）
- 工作記憶短，唔能夠 hold 住「你上次嗰個字拎 50 分」呢類抽象回饋
- 容易將「40 分」誤解為「我衰咗」而非「我做到一半」

### 1.2 計劃書目標

1. 盤點現有評分機制對 MID 學生嘅適用性
2. 指出**對 MID 學生有害或無效**嘅設計元素
3. 提出分階段可落地嘅優化建議（唔包 implementation code）
4. 列出**唔應該改**嘅嘢（避免過度修改反而打爛現有效能）

---

## 二、現有評分機制盤點

### 2.1 評分主流程（`index.html` L888–942）

```
錄音 → ASR 引擎 (webspeech / whisper / custom) → scorePronunciation()
  ├─ engine='custom'   → 用 audio features (duration + RMS + peak) 自評
  └─ 其他 (string-match):
       similarity (Levenshtein 0-1) × 50
     + overlap (target 字元命中數) × 18
     + firstMatch (首字命中) +15
     + bonus (包含/被包含) +20
     = final 0-100
```

**Feedback 三段（line 924）：**
- `>= 85`：做得好！發音好準！
- `>= 55`：唔錯！繼續努力～
- 否則：再試一次，你可以嘅！

### 2.2 其他相關評分維度

| 維度 | 位置 | 邏輯 |
|---|---|---|
| Confetti 觸發 | L939 | `aiScore >= 80` → 12 confetti |
| Session 完成時 confetti | L1019 | `avg >= 80` → 35 confetti（大量）|
| 證書 tier | L1034-1038 | 90+ 金 / 75+ 銀 / 60+ 銅 / 其他 參與 |
| 掌握判定 | L1132 | `bestScore >= 80` → ✅ 已掌握 |
| 進步中判定 | L1133 | `60-79` → 👍 進步中 |
| 待加強判定 | L1134 | `attempts >= 2 && bestScore < 60` → ⚠️ 待加強 |
| 老師視角 70 線 | L2450 | 70 為已掌握線（學生視角 80）|
| Score 顏色 | L2581, L2560 | 80+ 綠 / 60-79 橙 / <60 紅 |

### 2.3 評分引擎選擇

| 引擎 | 機制 | 對 MID 學生適用性 |
|---|---|---|
| **WebSpeech** | 瀏覽器原生 zh-HK / yue ASR → transcript → 字符串相似度 | ⚠️ 粵語 ASR 準確率有限；MID 發音更易誤判 |
| **Whisper** | local on-device ASR（first time ~40MB download）| ⚠️ 需 model load 等待；轉錄速度慢；MID 短句/兒童聲線準確率唔同 |
| **Custom (audio features)** | 純 audio RMS / duration / peak → 60-100 分 | ✅ 對 MID 較友善（不依賴 ASR 文字對齊），但**有 silent recording 風險** |

---

## 三、現有機制對 MID 學生嘅問題清單

### 3.1 🔴 Critical — 會造成心理傷害 + 失去教學價值

#### 問題 1：分數以 0-100 數字裸露
**現況**：`resultScore` 顯示 `40/100` 大字。

**問題**：MID 學生唔識「分數」嘅相對意義。40 同 60 對佢哋嚟講都係「我做唔到」。
**實證**：教學實務中 SEN 老師多會口頭修改「分數」為「⭐ 星星數 / 3 隻」或「合格/再嚟」。
**影響**：挫敗感、迴避練習。

#### 問題 2：**最關鍵 — 冇診斷，淨係有分數**
**現況**：line 912-926 純粹做「target 字符串 vs transcript 字符串」相似度，**完全冇分析邊個音錯**。

**問題本質**：
- 學生讀「三」(saam1) ASR 出「心」(sam1) → 字面 0 overlap → 0 分
- 對老師嚟講：呢個唔係「0 分」係「差一個入聲尾 + 聲調錯」→ **診斷價值完全 lost**
- 學生讀「季節」(gwai3 jit3) ASR 出「乖日」→ 兩個字都錯，但錯嘅模式可能係聲調，學生只係需要提示聲調
- 對 SEN 老師嚟講：**「邊個音錯」比「錯幾多分」重要 10 倍**，因為佢要設計下一個教學環節

**詞庫已經有 pinyin 但冇用過**：詞庫 `data/words.json` 每個字都有 `pinyin` 字段（粵拼 jyutping，例 `cheun tin` = 春天），但 `scorePronunciation` 完全冇 reference 呢個字段，**浪費咗現有 metadata**。

**影響**：
- 老師唔知點指導（要逐個字 replay 錄音先知錯喺邊）
- 學生唔知點改進（淨係知道「再嚟多次」）
- 「同音字陷阱」完全冇被辨識（學生讀「心」以為自己讀咗「三」→ 冇人話佢知）

#### 問題 3：「< 55 = 再試一次」嘅負面回饋
**現況**：line 924 第三段 feedback 是「再試一次，你可以嘅！」（其實已經 soften）。
**問題**：MID 學生見到 `< 55` 嘅數字 + 紅色 + 「再試一次」會直接詮釋為「我搞錯咗，我唔啱」。
**進一步問題**：confetti 觸發線係 80 分，MID 學生極少達到 → 永遠無 celebration。

#### 問題 4：證書 tier「參與獎」邊緣化
**現況**：avg < 60 → 紫色「🌟 參與」tier（line 1038）。
**問題**：對 MID 學生嚟講，**每次**都係「參與」級，等於暗示「你永遠得參與」。應該有「進步獎」「努力獎」呢類可達到嘅 tier。
**實證**：特殊學校評估指引普遍倡導「絕對評價」（personal best）多過「常模評價」。

#### 問題 5：顏色綁死 80 分線
**現況**：score < 60 → 紅色 `#ef4444`（line 2560, 2581, 2931）。
**問題**：紅色喺 UI 心理學 = error / wrong。對 MID 學生嘅老師嚟講，紅色等於「fail」嘅視覺編碼，會令佢哋嘅學生睇到老師 dashboard 嗰陣覺得「我係紅色 = 衰」。

### 3.2 🟡 Moderate — 功能性問題

#### 問題 6：Custom engine 嘅 baseline 同化效應
**現況**：`yueAudioBaselines` 用 EMA (`existing * 0.7 + new * 0.3`) 更新 baseline（line 876-879）。
**問題**：第一個 baseline 通常係學生自己最早期嘅 audio → 如果佢第 1 次讀得弱，後續 baseline 會 forever 偏低，導致永遠拎「good」分，但分數**唔反映真實進步**。反之亦然。
**進一步**：EMA 冇 mechanism 偵測「學生真係進步咗需要 re-baseline」。

#### 問題 7：String-match scoring 對短字 / 入聲字唔公道
**現況**：overlap = target 字元命中數 × 18，bonus = 包含 +20。
**問題**：
- MID 學生讀「三」（saam1）可能 ASR 出「心」（sam1），2 個字元命中 0 個，overlapBonus = 0 + firstMatch 0 = 0 分起步
- 粵語入聲字（-p, -t, -k）尾音經常被 ASR cut 走
- 1-2 個字嘅短字比 5-6 個字嘅長字更易拎低分（denominator 細）

#### 問題 8：Mastery threshold（bestScore >= 80）對 MID 過高
**現況**：學生 80 分先算「已掌握」。
**問題**：MID 學生 best score 60-70 已經係個人最佳。80 分線變相「永遠進步中」= 永遠無成就感。
**進一步**：teacher 視角 70 分線（line 2450）已經 lower — 兩邊唔一致增加混亂。

#### 問題 9：Feedback 文字密度高
**現況**：「做得好！發音好準！」（5 個字 + 抽象詞「準」）
**問題**：MID 學生 working memory 短，5 個字嘅句子可能只記得「準」一個字。
**進一步**：feedback 文字冇 emoji icon 對應，視覺編碼弱。

### 3.3 🟢 Minor — polish level

#### 問題 10：Score 持久化用 absolute `bestScore`
**現況**：`_recordAttempt` 只 update `w.bestScore` if `score > w.bestScore`（line 2059）。
**問題**：永遠 highlight 最高分。對 MID 學生嚟講，**recent improvement** 比 historical max 更重要（建立 growth mindset）。

#### 問題 11：「< 55」feedback 包含「你可以嘅」
**現況**：line 924 已經 include 你可以嘅 → 其實 OK。
**問題**：要 verify 真正顯示嘅係呢句（lint 過），唔好畀瀏覽器 cache 影響。

---

## 四、優化建議（分階段）

### Phase 1 — **Quick wins（低風險、本週可做）**

#### P1-A. Score 顯示分層（唔改分數邏輯，只改 UI）
- **新**：`>= 80` 顯示 `🌟🌟🌟`；`60-79` 顯示 `🌟🌟`；`40-59` 顯示 `🌟`；`< 40` 顯示 `💪`
- **改**：`resultScore` 同 score 顏色 binding 鬆綁。永遠顯示「🌟 星星數」+ 細字「AI 評分: 45/100」做備忘。
- **保留**：分數內部儲存同 dashboard 顯示都唔變，純 UI 層。
- **工作量**：< 2 小時，純 CSS + 1 個 helper function。

#### P1-B. Feedback 文案加 emoji icon prefix
```
>= 85: 🎉 做得好！發音好準！
>= 55: 👍 唔錯！繼續努力～
>= 30: 💪 再試一次，你可以嘅！
< 30: 🤗 唔緊要，老師陪你一齊嚟
```
- **改**：`scorePronunciation` line 924。
- **保留**：「你可以嘅」「唔緊要」warm wording。

#### P1-C. Confetti 線降到 60
- **改**：line 939 confetti 觸發 `aiScore >= 60`（MID 學生 60 分已經係好 effort）。
- **改**：line 1019 session 完成 confetti `avg >= 60`。
- **保留**：「perfect 90+」嘅 35 confetti 大爆發。

#### P1-D. 紅色轉暖色
- **改**：所有 `< 60` 嘅顏色由 `#ef4444` 紅 → `#fb923c` 暖橙（line 2560, 2581, 2931 等）。
- **改**：橙嘅含義 = 「需要多練習」而非「錯」。
- **保留**：綠 (>=80) 同 黃 (60-79) 不變。

#### P1-E. 診斷式評語（核心新增 — 「差喺邊」）
**呢個係用戶最關注嘅重點：分數變評語可以，但必須話到畀老師 + 學生聽「差喺邊」，「邊個音錯咗」，「係咪已經接近同音字」。**

**現有盲點**（line 912-926）：
- 純粹做「target 字符串 vs transcript 字符串」相似度
- 學生讀「三」(saam1) ASR 出「心」(sam1) → 字面 0 overlap → 0 分
- 但對老師嚟講呢個唔係「0 分」係「差一個入聲尾 + 聲調錯」→ **診斷價值完全 lost**

**新方案（3-tier 診斷）：**

**Tier 1 — 音節級診斷（character-level + pinyin 比對）**
- **新**：詞庫本身有 `pinyin`（粵拼 jyutping，例 `cheun tin` = 春天）
- **新**：`scorePronunciation` 內新增 `diagnosePronunciation(transcript, target, pinyin)`：
  1. 將 target 字串每字轉成 pinyin syllable（用 lookup table 預載，唔靠外部 API）
  2. 將 transcript 嘗試轉成 pinyin（用 ASR 引擎自帶嘅語言模型 OR fallback 用戶輸入）
  3. 逐 syllable 比對：
     - 聲母差異：`n/l`, `f/w`, `gw/g`, `d/t`, `k/g`, `b/p` 算「近音錯」
     - 韻母差異：`aa/a`, `i/u`, `e/o` 算「近音錯」
     - 聲調差異：相鄰調（1↔2, 2↔3）算「聲調錯」
     - 入聲尾 `-p/-t/-k` 漏咗算「入聲漏」
  4. 輸出 `{ matched, nearMiss, wrong, missing }` 陣列

**Tier 2 — 同音字偵測**
- **新**：預載常用同音字 lookup（initial set 20-30 個高頻 SEN 混淆字對）：
  ```
  三/心（saam1/sam1）
  四/死（sei3/sai2）  
  五/誤（ng5/ng6）
  雞/機/居（gai1/gei1/geoi1）
  爸/巴（baa1/baa1）— 提示唔係錯
  ```
- **新**：當學生讀出同音字 → 顯示「你讀成咗『心』，同『三』好接近㗎喇，再試多次集中喺結尾 m 音」
- **新**：當診斷出 nearMiss 1 個音 → 顯示「差一個音喇：結尾加返 `-m` 就完美」

**Tier 3 — 評語生成（取代 line 924）**
```
準確（>= 85）：
  🎉 發音好準！你完整讀到「春天」每個字都清楚

近音成功（nearMiss only, 60-84）：
  👍 好叻！「春天」入面 [n/l] 音差少少，再嚟一次就完美
  📊 診斷：cheun 100% / tin 75%（[n] 音未夠清楚）

同音字陷阱（homophone detected）：
  🤓 你讀成咗「心」(sam1)，同「三」(saam1) 係近音字
     留意：結尾要 [m] 唔係 [n]，可以試吓「san→sam」拉長少少

完全走音（none matched）：
  💪 唔緊要，老師再示範一次，跟住讀
  💡 提示：[w] 音似「娃」，[e] 音似「鞋」
```

**實作難度**：中
- 預載 jyutping 字典（~300 高頻字）係一次性成本
- 拼音 → 發音特徵 mapping 可以係 lookup table
- 診斷函式 + UI 顯示 = 1-2 日工作量
- **唔需要 external API**（最重要）

**保留**：分數機制唔變，分數只係 summary metric，**診斷評語係主要 deliverable**。

### Phase 2 — **Mastery model 重設（中風險，1-2 週）**

#### P2-A. 引入「Personal Best」分層
- **新**：除 `bestScore`（歷史最高）外，新增 `recentBestScore`（最近 7 日最高）。
- **新**：mastery 判定用 `recentBestScore >= 70`（取代 `bestScore >= 80`）。
- **新**：dashboard 顯示「個人最佳」+ 「近期最佳」兩個指標。
- **影響**：MID 學生見到自己有 recent 進步，仍然可以觸發「已掌握」。

#### P2-B. 證書 tier 重新分層
```
>= 85: 金 (gold)
>= 70: 銀 (silver)
>= 55: 銅 (bronze)
>= 40: 進步獎 (improvement) — 紫色改為橙色，emoji 🌱
<  40: 努力獎 (effort) — 紫色改為淺藍，emoji 💫
```
- **改**：line 1034-1038。
- **保留**：「金 / 銀 / 銅」命名。

#### P2-C. Custom engine baseline 改善
- **新**：baseline 只用學生**自己**嘅 best score 對應嘅 audio 更新（唔係 EMA 所有 attempts）。
- **新**：提供「老師手動校準」按鈕 — 老師可以 trigger 一次「示範錄音」做 baseline 起點。
- **改**：line 871-886 `_updateAudioBaseline`。

### Phase 3 — **MID-specific 評分模式（高風險，要 A/B test）**

#### P3-A. 「MID Mode」toggle
- **新**：老師喺 ⚙️ 設定入面可以 enable「中度智障評分模式」。
- **新**：呢個 mode 下：
  - threshold 全線 lower 10 分
  - confetti 線 lower 20 分
  - 預設啟用 custom audio engine
  - 預設關閉 whisper（避免 40MB download 對 iPad 慢）
  - 預設關閉 string-match 嘅 `overlap × 18` 部分（只留 similarity × 50 + firstMatch）
- **影響**：可以**逐個學生**enable（喺 student modal 加 toggle），唔影響其他學生。

#### P3-B. 短字加分機制
- **新**：`target.length <= 2` 嘅字 × 1.3 score boost（因為短字 base score 一定偏低）。
- **新**：入聲字 `-p/-t/-k` 結尾可加 `target.endsWith(p/t/k)` 容錯：score >= 30 都畀 bonus。
- **改**：line 923 計分公式。

#### P3-C. 教練模式（role-play 老師鼓勵語音）
- **新**：低於某分數時，自動 play 一段預錄嘅老師鼓勵語音（用 Web Speech API TTS）。
- **新**：鼓勵語音隨機 pool：「你好棒，已經有進步喇」「再嚟一次，老師陪你」「你嘅發音開始似喇」。

### Phase 4 — **數據驅動（需老師參與）**

#### P4-A. 加 OBSERVATION log
- **新**：每次 scorePronunciation 記低 `transcript / target / audio duration / rms / score / method`。
- **新**：老師可以喺 dashboard 撳「為何低分」睇 ASR 點 misinterpret（例如 target 「三」 student 讀「saam」但 ASR 出「三」 → explain why score 0）。
- **影響**：老師可以校準自己對分數嘅 trust。

#### P4-B. Progress 顯示「最近 3 次 attempt」trend
- **新**：dashboard 嘅每個字 progress 顯示最近 3 次嘅 score 走勢（📈 / 📉 / ➡️）。
- **新**：即使 absolute score 唔高，有 📈 都係 positive feedback。

#### P4-C. 校內 benchmark（遲啲先做）
- **新**：每班 / 每校有 anonymized benchmark，畀老師睇班中位數（**唔顯示個別學生身份**）。
- **新**：MID 學生可以同**自己**比較，唔同其他人比較。

---

## 五、唔應該改嘅嘢

| 元素 | 點解唔改 |
|---|---|
| ASR 引擎 pluggable 架構（L325-410） | 設計好，畀老師揀 engine 嘅彈性要保留 |
| Levenshtein 計 similarity | 算法穩定，改咗會 break 過往累積嘅 score 數據 |
| `state.assessmentScores[]` 結構 | 持久化 shape，向後兼容重要 |
| localStorage key 命名 | 改咗等於 wipe 所有用戶 progress |
| `_seedDemoProgress()` demo data 範圍 | 純示範，唔影響評分邏輯 |
| 學生 PIN 機制 | 私隱 / 安全考量，唔好因評分改動而弱化 |

---

## 六、風險與緩解

| 風險 | 機率 | 影響 | 緩解 |
|---|---|---|---|
| 分數改變令老師混淆（用咗一排嘅 dashboard 解讀） | 中 | 中 | 保留 internal score，**只改 UI display**（P1 全方案） |
| MID 學生對新 feedback「麻木」 | 低 | 中 | A/B test 3 個月，收集老師反饋 |
| 短字加分機制反被濫用（學生只練短字） | 低 | 低 | 每次 session 強制 mixed length |
| 教練語音 TTS 引起分心 | 中 | 中 | 只喺 score < 30 觸發，且**用學生已熟悉嘅老師聲線** |
| 老師忘記啟用「MID Mode」 | 中 | 中 | 第一次新增學生時（student modal）主動提示「該學生是否需要 MID 模式？」 |
| Best score 概念消失令 progress display 失真 | 低 | 中 | 保留 `bestScore` 字段，只係 mastery 判定用 `recentBest` |

---

## 七、落地優先順序

```
Week 1:   P1-A, P1-B, P1-C, P1-D, P1-E    ← UI + 診斷評語
Week 2-3: P2-A, P2-B                       ← Mastery model
Week 4-5: P2-C                             ← Custom engine baseline
Week 6-8: P3-A (toggle) + P3-B (短字加分)   ← MID-specific mode
Week 9-12: P3-C, P4-A, P4-B                ← TTS + observability
Q3 後期:   P4-C                            ← Benchmark
```

**P1-E 排第一位嘅原因**：用戶最關注嘅係「能反映到學生發音準備性，差多少，或者已經係接近同音字」。其他 UI 改動只係 polish，唔解決核心診斷問題。所以 P1-E 同其他 P1 quick wins 同步開工，先 release，其他 Phase 2+ 喺 P1-E 嘅基礎上 iterate。

**每個 phase 完成後**：
1. 跑 manual smoke test（錄 5 個字 × 2 個難度）
2. 確認 GitHub Pages deploy 成功
3. 通知老師喺實際課堂試 1 週
4. 收集反饋 → 下一個 phase 開工前 review

---

## 八、開放問題（要老師 / 校方決定）

1. **「MID 模式」應否預設 enable 喺全部學生身上？** 還是 opt-in？
   - 建議 opt-in，避免影響主流用戶

2. **confetti 線降到 60 之後，主流學生會唔會「失去挑戰感」？**
   - 建議保留主流用戶 80 線，只喺 MID 模式先降到 60

3. **教練語音嘅 voice 用咩聲線？**
   - 預設用 Cantonese 女生聲
   - 可唔可以畀老師 upload 自己嘅錄音？（P3-C v2）

4. **「個人最佳」同「近期最佳」邊個做 mastery 判定？**
   - 建議 `recentBest >= 70`（P2-A），但要喺 dashboard 顯示 both
   - 老師可以 override

5. **學生睇到分數嘅限制？**
   - 應否完全 hide 數字分，只畀 🌟？
   - 還是畀 0/3 stars + 一個「老師話你知你幾叻」嘅語音？
   - 提議 v1：保留分數但 default 顯示 🌟 模式，老師可切換顯示模式

6. **🔑 診斷評語嘅 jyutping 字典要預載幾多字？**（P1-E 核心）
   - **MVP**：詞庫 18 個字（已有）→ 預載呢 18 個字嘅 jyutping 拆解就夠晒
   - **進階**：300 個高頻字（覆蓋 SEN 常見字）
   - **完整**：5000 常用字（用 Rime 開源字典 subset）
   - 建議 v1 預載 MVP + 詞庫 import 時要求老師填 pinyin（已有機制）
   - v2 加 300 高頻字
   - 評估後再決定 v3

7. **同音字陷阱數據庫點樣維護？**
   - v1 老師手動加（學生 modal 加「常見錯誤」欄）
   - v2 系統根據歷史 transcript 自動 detect（同字 long-tail 錯音）
   - 建議 v1 手動 — 起步成本低，質素可控

8. **診斷評語應該畀學生定只畀老師睇？**
   - 學生睇到「差 m 音」可能更混亂（佢哋唔識 IPA / jyutping symbol）
   - 老師睇到「差 m 音」→ 即時知點教
   - 建議 v1：學生版用「再試多次，結尾音要清楚」自然語言；老師版顯示具體 jyutping symbol

---

## 九、成功指標

**老師角度：**
- 老師 dashboard 開啟率 ↑（預估 +30%）
- 老師「學生進步」自評問卷 ↑（Likert 4-5 比例）
- 每週 active 練習率 ↑（現時低 engagement 學生觸發 alert 後介入成功率）

**學生角度（透過老師觀察）：**
- 學生主動要求「再玩多次」嘅頻率 ↑
- 學生錄音時嘅微笑 / 投入度（qualitative）
- 學生連續 7 日活躍比例 ↑

**系統角度：**
- 個別 MID 學生嘅 `recentBestScore` 中位數 ↑（6 個月後）
- 「待加強」紅標籤學生數 ↓

---

## 十、附錄

### A. 現有 feedback 文字全文（line 924）

```js
feedback = aiScore >= 85 ? '做得好！發音好準！' : aiScore >= 55 ? '唔錯！繼續努力～' : '再試一次，你可以嘅！';
```

### B. 現有 confetti 觸發點

| 位置 | 條件 | 數量 |
|---|---|---|
| L939 | `aiScore >= 80` | 12 |
| L1019 | session `avg >= 80` | 35 |
| L1104 | assessment 完成（無條件）| 20 |

### C. 顏色 token 一覽

| 用途 | Hex | 心理含義 |
|---|---|---|
| 綠 (mastered) | `#22c55e` | ✅ success |
| 橙 (practicing) | `#f59e0b` | ⚠️ caution |
| 紅 (struggling) | `#ef4444` | ❌ error |
| 紫 (cert-participation) | `#7c3aed` | 🌟 generic |
| 老師視角 70+ | `#22c55e` | 綠（已掌握）|

### D. 參考文獻 / 教學實務原則

- **絕對評價 (criterion-referenced)** vs **常模評價 (norm-referenced)**：MID 學生宜用前者
- **正向行為支持 (PBS, Positive Behaviour Support)**：高頻強化 > 低頻大強化
- **視覺編碼優先**：MID 學生對 emoji / icon / 顏色嘅辨識遠快過文字
- **Growth mindset feedback**：process praise（「你好努力」）> person praise（「你好叻」）
- 香港教育局《全校參與模式融合教育指引》SEN 評估調整原則

---

**📌 下一步**：等老師過目呢份計劃書，回應 Section 八嘅 5 個問題 + 確認 Phase 1 嘅 4 個 quick wins 係咪開工。
