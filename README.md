# 粵語朗讀評分 — SEN 粵語學習工具

> 為中度智障學生設計的粵語朗讀練習 iPad 應用程式，支援多人多裝置、真實 AI 語音評估、零私隱風險。

[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue)](https://ihateusingai-beep.github.io/sen-yue-read-score/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Phase](https://img.shields.io/badge/Phase-3%2B%20(Real%20Whisper)-orange)]()

---

## 🎯 願景

讓中度智障學生透過 iPad 練習粵語發音，**老師**可以即時追蹤每位學生的進度，**所有語音資料保留在裝置上**（家長最在意的私隱問題）。

---

## ✨ 核心功能

### 學生端（iPad）
- 🔢 **5 位數字 PIN 登入** — 大按鈕、適合 SEN 學生
- 🖼 **名 + 頭像拼畫登入** — 適合不識字的學生
- 📚 **詞彙學習** — 聽示範發音、看圖片
- 🎤 **即時評估** — 錄音 → AI 評分 → 即時回饋
- ⭐ **我的進度** — 星星、已掌握的詞、待加強的詞

### 老師端
- 👨‍🎓 **學生管理** — 加學生、設 PIN、揀頭像 emoji
- ✏️ **詞彙 CRUD** — 喺 App 內加新詞、加新分類
- 🔧 **分類開關** — 學生只會見到老師開咗嘅分類
- 📊 **Dashboard** — 全班 / 個人進度、難點熱點、趨勢 sparkline
- 📄 **PDF 報告** — 學生個人報告 + 全班報告
- 🔌 **3 個 ASR 引擎可 swap** — Web Speech / Whisper 本地 / 自訂比對
- 💾 **匯出 / 匯入** — 詞彙 JSON、學生資料（跨 iPad 同步）

### SEN 設計原則
- ✅ **大觸控區**（≥70px 按鈕）
- ✅ **深色 UI + 高對比**
- ✅ **一鍵返回 Hub**
- ✅ **圖像導航為主**（emoji + 圖片）
- ✅ **正增強**（「叻叻！」、「加油！」）
- ✅ **每節練習短**（4 秒錄音，唔會累）

---

## 🛠 技術棧

```
前端:      純 HTML + CSS + JavaScript (vanilla)
部署:      GitHub Pages（單一 index.html + 資源）
音訊:      MediaRecorder API + AudioContext
ASR:       transformers.js + Xenova/whisper-tiny (q8, ~40MB)
           或 Web Speech API（fallback）
           或 自訂聲紋比對（offline-only）
評分:      Levenshtein distance + 字元重疊 + 首字 bonus
私隱:      完全本地、零雲端、零追蹤
成本:      $0（無 API 費用、無 server、無 backend）
```

**單檔部署**：整個 App 喺一個 `index.html` + `data/words.json`，可以 host 喺任何 static web server。

---

## 🚀 快速開始

### 學生（5 分鐘）
1. 開 https://ihateusingai-beep.github.io/sen-yue-read-score/
2. 輸入 5 位 PIN（或撳自己個名）
3. 撚詞彙學習 → 撚評估 → 完成 → 攞星星 ⭐

### 老師
1. 撳「🔧 老師模式」
2. 👨‍🎓 學生 tab → 加學生（名 / PIN / 頭像 / 顏色）
3. ✏️ 詞彙 tab → 編輯詞彙 / 加新分類
4. ⚙️ 系統 tab → 揀 ASR 引擎（建議 Whisper 本地）
5. 📊 Dashboard → 睇進度、匯出 PDF 報告

詳細步驟見 [TEACHER_GUIDE.md](TEACHER_GUIDE.md)。

---

## 📂 項目結構

```
sen-yue-read-score/
├── index.html              # 整個 App（單檔）
├── data/
│   └── words.json         # 詞彙資料庫
├── assets/images/         # 詞彙配圖
├── README.md              # 本檔案
├── TEACHER_GUIDE.md       # 老師手冊
├── DEMO_SCRIPT.md         # 5 分鐘 demo 流程
├── BUILD.md               # 技術 build notes
└── .github/workflows/
    └── pages.yml          # GitHub Pages 自動部署
```

---

## 🌐 ASR 引擎對比

| 引擎 | 成本 | 私隱 | 廣東話支援 | 適合 |
|------|------|------|----------|------|
| **Web Speech API** | 🆓 | 🔓 中 | 弱 | 預設、即開即用 |
| **Whisper 本地** | 🆓 | 🔒 高 | 中（透過 zh 編碼） | SEN、私隱敏感 |
| **自訂比對** | 🆓 | 🔒 高 | N/A（聲紋比對） | 唔需要標準音 |

> 詳細對比見 [BUILD.md](BUILD.md) Phase 3 章節。

---

## 🗺 路線圖

- [x] **Phase 1** — MVP 單檔（Web Speech + Levenshtein）
- [x] **Phase 1+** — 詞彙 JSON + CRUD editor
- [x] **Phase 2** — 學生 PIN + 進度追蹤 + Dashboard
- [x] **Phase 3** — Pluggable ASR engine layer
- [x] **Phase 3+** — 真 Whisper.cpp WASM（transformers.js + Xenova/whisper-tiny）
- [x] **Phase 4** — Dashboard 進度深化（sparkline、難點熱點、PDF 報告）
- [ ] **Phase 5** — 真實 SEN 學生試用 + feedback
- [ ] **Phase 6** — 雲端同步（Supabase，視乎試用結果）
- [ ] **Phase 7** — Tauri 殼做真正 iPad App（App Store 級）

---

## 🏫 學校設定

- 學校：匡智張玉瓊晨輝學校
- 對象：中度智障學生
- 設計：SEN 觸控友善、深色主題、廣東話優先

---

## 📜 License

MIT

---

## 🙏 致謝

- [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js) — 真實 ASR 評估
- [Xenova/whisper-tiny](https://huggingface.co/Xenova/whisper-tiny) — 廣東話友善嘅 Whisper 模型
- [匡智張玉瓊晨輝學校](http://www.hcwmc.edu.hk/) — 特殊教育專業意見
