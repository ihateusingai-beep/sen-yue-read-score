# sen-yue-read-score — Build Notes

**Repo**: https://github.com/ihateusingai-beep/sen-yue-read-score
**Live**: https://ihateusingai-beep.github.io/sen-yue-read-score/

---

## Current State (Phase 4)

- **Status**: Dashboard 進度深化完成，準備真實 SEN 試用
- **Path**: `~/workspace/sen-yue-read-score/`
- **Last build**: 2026-06-09

---

## Architecture

```
index.html              # 整個 App (single file, ~3,000 lines)
data/words.json         # 詞彙資料庫 (teacher-editable)
assets/images/          # 詞彙配圖
.github/workflows/
  └── pages.yml         # GitHub Pages 自動部署
```

**Hosting**: GitHub Pages (free, HTTPS, custom domain support)

---

## Key Design Decisions

### Single-file deployment
- 整個 App 喺一個 `index.html`
- 容易理解、容易 fork、容易 host
- 缺點：檔案大（~107KB），但現代瀏覽器無問題

### Pluggable ASR engines
- 3 個引擎抽象層（`whisper` / `webspeech` / `custom`）
- 老師可即時切換
- 唔 lock-in 任何一個 API

### Whisper local via transformers.js
- `Xenova/whisper-tiny` q8 quantization
- WebGPU if available, else WASM
- ~40MB model, cached after first download
- Works offline after first load

### Per-student progress in localStorage
- `yueStudents`: { students[], loginMode }
- `yueProgress`: { [studentId]: { byWord, scores, totalAttempts } }
- `yueCategories`: 詞彙結構 override
- `yueAdminSettings`: enabled 狀態
- 30+ iPad 各自 local，跨機用 JSON import/export sync

### SEN design principles
- Big touch targets (≥70px)
- Dark high-contrast theme
- Image-first navigation
- One-tap return to Hub
- Positive reinforcement feedback
- 4-second short recordings

---

## Phase History

### Phase 1 — MVP (2026-06-09 morning)
- Single-file `index.html`
- Web Speech API + Levenshtein scoring
- GitHub Pages deploy

### Phase 1+ — Teacher vocab control (2026-06-09 morning)
- Extract hardcoded words → `data/words.json`
- Teacher tab: category toggle, in-app CRUD editor
- Import/Export JSON for sharing

### Phase 2 — Students + Progress (2026-06-09 afternoon)
- 5-digit PIN login (or name+avatar grid)
- Per-student progress tracking
- Teacher Dashboard
- Student import/export for multi-iPad sync

### Phase 3 — Pluggable ASR (2026-06-09 evening)
- Engine abstraction layer
- 3 engines: Web Speech, Whisper local (stub), Custom audio features
- System tab for switching

### Phase 3+ — Real Whisper (2026-06-09 evening)
- Replaced Whisper stub with real `transformers.js` + `Xenova/whisper-tiny`
- Audio preprocessing (webm → 16kHz mono Float32Array)
- Lazy load + cache management

### Phase 4 — Dashboard depth (2026-06-09 evening)
- Per-student sparkline (last 10 attempts)
- Class-wide weak spots heatmap
- Time period filter (all/month/week)
- PDF report export (student + class)
- Student "My Progress" page (avatar + stars + categorized word lists)

---

## Engine Trade-offs (Phase 3)

| Engine | Cost | Privacy | Cantonese | Best for |
|--------|------|---------|-----------|----------|
| Web Speech | 🆓 | 🔓 Medium | Weak | Quick trial |
| Whisper local | 🆓 | 🔒 High | Medium (via 'chinese' hint) | SEN, real use |
| Custom | 🆓 | 🔒 High | N/A (audio features) | Noisy room, no standard needed |

See `TEACHER_GUIDE.md` for setup steps.

---

## Rollback

```bash
git log --oneline   # find a previous commit
git checkout <commit-hash>
```

---

## Next Steps (post-trial)

1. **Real SEN student trial** (1-2 weeks) — collect feedback
2. **Phase 5** decision: based on feedback, decide:
   - Cloud sync (Supabase) for 30+ iPad
   - Or continue local-only with improved UX
3. **Tauri wrapper** for App Store distribution (if needed)

---

## See Also

- `README.md` — Project overview
- `TEACHER_GUIDE.md` — Step-by-step teacher manual
- `DEMO_SCRIPT.md` — 5-minute demo script
