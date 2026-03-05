# Skills Discovery — Design

**Date**: 2026-03-05
**Status**: Approved

---

## Overview

Add a "Discover" toggle view to the Skills page that lets users search for and install new skills from skills.sh. The Installed/Discover toggle switches the full Skills page between the existing installed view and a search-driven discovery view.

---

## Architecture

### Backend changes
- Add `GET /api/skills/search?q=<query>` — 3-line proxy to `https://skills.sh/api/search?q=<query>&limit=20`. Uses Node 18 built-in `fetch`. Solves CORS without building search logic.
- Extend `ALLOWED_COMMANDS` allowlist with: `/^npx skills add [a-zA-Z0-9@/_-]+$/`
- No new files — changes to `server.js` only.

### Frontend changes
- Toggle bar at top of Skills section: `[Installed] [Discover]`
- Discover view: search input + results grid (same card layout as installed)
- Result cards: skill name, source repo, install count, link to skills.sh, Install button
- Install fires `POST /api/exec { cmd: "npx skills add <source>@<skillId>" }`, output streams to terminal panel
- No changes to `index.html` — changes to `app.js` only.

---

## API

**skills.sh search endpoint:**
```
GET https://skills.sh/api/search?q=<query>&limit=20
```

**Response shape:**
```json
{
  "query": "frontend",
  "searchType": "fuzzy",
  "skills": [
    {
      "id": "anthropics/skills/frontend-design",
      "skillId": "frontend-design",
      "name": "frontend-design",
      "installs": 122774,
      "source": "anthropics/skills"
    }
  ],
  "count": 2,
  "duration_ms": 22
}
```

**Install command:** `npx skills add <source>@<skillId>`
**Skill URL:** `https://skills.sh/<id>`

---

## UI Layout

```
Skills page top:
┌─────────────────────────────────────┐
│ [Installed ●]  [Discover]           │
└─────────────────────────────────────┘

Discover view:
┌─────────────────────────────────────┐
│ 🔍 Search skills...        [Search] │
└─────────────────────────────────────┘

Results grid (same 3-col layout as installed):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ skill-name   │ │ skill-name   │ │ skill-name   │
│ 122K installs│ │ 22K installs │ │ 8K installs  │
│ anthropics/  │ │ obra/super.. │ │ am-will/..   │
│ skills       │ │ powers       │ │ codex-skills │
│ [↗ View][Install]│               │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## States

- **Empty** — "Search for skills above" placeholder
- **Loading** — spinner while fetching
- **Results** — grid of cards
- **No results** — "No skills found for '<query>'"
- **Installing** — button shows "Installing..." and is disabled, terminal shows output
