# sen-yue-read-score — SELECTIVE EXPANSION Build (2026-06-09)

**Status**: Data layer refactored — teachers can now manage vocabulary via `data/words.json`
**Local path**: ~/workspace/sen-yue-read-score
**Repo**: https://github.com/ihateusingai-beep/sen-yue-read-score
**Live**: https://ihateusingai-beep.github.io/sen-yue-read-score/

## Architecture (SELECTIVE EXPANSION — Phase 1)

```
index.html          — Single-file app (SpeechRecognition + Levenshtein + TTS)
data/words.json     — Vocabulary database (teacher-editable, GitHub Pages served)
```

### How teachers add / manage vocabulary

1. Edit `data/words.json` on GitHub (or locally, then push)
2. Each category has `enabled: false` — teacher toggles on in the 🔧 老師設定 panel
3. Settings saved to `localStorage` — survives page refresh
4. To add a new word: add to the `words` array in the appropriate category, add image to `assets/images/`
5. To add a new category: add a new object to `categories` array in `words.json`

### Category structure

| Category | ID | Words | Default |
|----------|----|-------|---------|
| 自然季節 | season | 8 | disabled |
| 戶外活動 | activity | 5 | disabled |
| 聲音世界 | sound | 5 | disabled |

## Rollback

```bash
git checkout <commit-hash>
```

## Previous Build (MVP)

Previous state (hardcoded words, no teacher admin) was at commit before this change.