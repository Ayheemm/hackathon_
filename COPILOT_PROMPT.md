# GitHub Copilot — MIZAN Frontend Integration Prompt

> Paste this entire prompt to GitHub Copilot Chat (Ctrl+Shift+I in VS Code).

---

## Context

I have a Next.js 16 frontend for a Tunisian legal AI assistant called **MIZAN / 9anouni**.
The project is at `frontend/src/app/`.
The backend is a Flask API running at `http://localhost:5000`.

## Backend API contract

### POST /chat
```
Request:  { message: string, history: [{user: string, assistant: string}]? }
Response: { answer: string, sources: [{title, source, article, url, score}], language: "fr"|"ar", error: string|null }
```

### POST /retrieve
```
Request:  { message: string, k?: number }
Response: { results: [{title, source, article, url, excerpt, score}], language: string }
```

### POST /detect-language
```
Request:  { text: string }
Response: { language: "fr"|"ar", rtl: boolean }
```

### GET /health
```
Response: { status: "ok", model: string }
```

## Current frontend state

The UI already exists visually (no API calls connected yet). It has:

1. **Main chat page** (`/`) — "9anouni" chat interface with:
   - Sidebar: logo, "New conversation" button, "Mirath Calculator" nav button
   - Main area: welcome screen with example questions in French and Arabic
   - Chat message thread (once conversation starts)
   - Input box at bottom with a language indicator (FR/AR)
   - "New" and "Clear" buttons in header
   - "Mirath Calculator" shortcut button in header

2. **Calculators page** (`/calculators`) — grid of 3 legal calculators:
   - Mirath Calculator (inheritance)
   - Prescription (civil/criminal deadlines)
   - Délais de recours (appeal deadlines)

3. **Mirath Calculator** (`/calculators/mirath`) — form with:
   - Sexe du défunt (Male/Female)
   - Masse successorale (optional TND amount)
   - Number inputs for 15 heirs: Epoux, Epouse, Père, Mère, Fils, Fille, Petit-fils, Petite-fille, Frère germain, Soeur germaine, Frère consanguin, Soeur consanguine, Frère utérin, Soeur utérine, Grand-père paternel, Grand-mère paternelle, Grand-mère maternelle
   - Calculer / Réinitialiser buttons
   - Shows "Héritiers saisis: N" count

4. **Délais de recours** (`/calculators/delais`) — form with:
   - Niveau de juridiction (Tribunal de première instance / Cour d'appel / Cour de cassation)
   - Matière (Civil / Pénal / Administratif / Commercial)
   - Nature du jugement (Contradictoire / Par défaut / Avant dire droit)
   - Date du jugement (date picker)
   - Mode de notification (Signification à la partie / Signification à parquet / Dépôt au greffe)
   - Date de notification (date picker)
   - Calculer / Réinitialiser buttons

5. **Prescription** (`/calculators/prescription`) — form with:
   - Type (Civil / Pénal)
   - Nature de l'action
   - Date du fait générateur
   - Interruptions / Suspensions toggle
   - Calculer / Réinitialiser buttons

## What you need to build

### 1. API service layer — create `frontend/src/lib/api.ts`

A typed API client with these functions:
```typescript
sendMessage(message: string, history: Message[]): Promise<ChatResponse>
retrieveChunks(message: string, k?: number): Promise<RetrieveResponse>
detectLanguage(text: string): Promise<{language: string, rtl: boolean}>
checkHealth(): Promise<boolean>
```

Types:
```typescript
interface Message { user: string; assistant: string }
interface Source { title: string; source: string; article: string; url: string; score: number }
interface ChatResponse { answer: string; sources: Source[]; language: string; error: string | null }
```

Base URL should come from `process.env.NEXT_PUBLIC_API_URL` with fallback to `http://localhost:5000`.

Handle network errors gracefully — if the backend is unreachable return a user-friendly error message in both French and Arabic.

### 2. Chat page — wire up `frontend/src/app/page.tsx`

- **State**: messages array, input value, isLoading boolean, conversationHistory array, detected language
- **On send**: call `sendMessage`, add user message immediately, show typing indicator, then add assistant response
- **Conversation history**: maintain last 10 turns for context, pass to API on each message
- **Language detection**: call `detectLanguage` as user types (debounced 500ms), switch input `dir` attribute between `ltr` and `rtl`, update the FR/AR indicator badge
- **Example questions**: clicking one fills the input and sends immediately
- **Sources panel**: after each AI response, show a collapsible "Sources" section with the source cards (title, source name, article number, relevance score as a progress bar)
- **New button**: clears messages and history, returns to welcome screen
- **Clear button**: same as New
- **Error state**: if API returns error, show a styled error message, not a crash
- **Auto-scroll**: scroll to bottom after each new message
- **Loading state**: show animated dots or spinner while waiting for response

### 3. Mirath Calculator — pure frontend logic in `frontend/src/app/calculators/mirath/page.tsx`

This calculator is 100% deterministic — NO API call needed. Implement the Tunisian inheritance law (mawāriṯ) calculation logic directly in TypeScript.

Rules to implement:
- **Fard shares** (fixed fractions from Quran):
  - Spouse (wife of male deceased): 1/4 if children exist, else 1/8... wait no:
    - Husband: 1/2 if no children, 1/4 if children
    - Wife (one or more): 1/4 if no children, 1/8 if children
  - Daughter (no son): 1/2 for one, 2/3 for two or more
  - Father: 1/6 if son exists
  - Mother: 1/6 if children or 2+ siblings, else 1/3
  - Daughter of son: same rules as daughter when no sons
  - Uterine siblings: 1/6 for one, 1/3 for two or more (shared)
- **Asaba** (residual heirs — get what's left): son > father > full brother > paternal brother (in order of priority)
- **Hajb** (exclusion rules):
  - Son excludes: grandson, brother (all types), uncle
  - Father excludes: grandfather, brother (all types)
  - Full brother excludes: paternal brother
  - Two or more daughters exclude: granddaughter (unless grandson present)
- **Awl** (proportional reduction when shares exceed 1): divide estate proportionally
- **Radd** (return excess to heirs when shares < 1 and no asaba): distribute remainder proportionally (excluding spouse)

Display results as:
- Table: Heir | Share fraction | % | Amount in TND (if provided)
- A pie chart using a simple CSS-based visualization or inline SVG
- Total verification row (must sum to 100%)
- Warning if calculation resulted in awl or radd

### 4. Délais de recours calculator — `frontend/src/app/calculators/delais/page.tsx`

Pure frontend logic. Rules based on Tunisian Code de Procédure Civile et Commerciale:

**Appeal (Appel) delays from Tribunal de première instance:**
- Civil contradictoire: 30 days from notification
- Civil par défaut: 15 days opposition + 30 days appel
- Pénal: 10 days from judgment day
- Administratif: 2 months

**Cassation delays from Cour d'appel:**
- Civil: 60 days from notification
- Pénal: 10 days

**Notification mode modifiers:**
- Signification à la partie: delay starts day after notification
- Signification à parquet: add 10 days to deadline
- Dépôt au greffe: add 3 days

**Working day adjustment**: if deadline falls on Friday, Saturday, or Tunisian public holiday, move to next working day.

Display: a timeline showing judgment date → notification date → deadline dates for each available recourse (opposition, appel, cassation). Show days remaining from today in a colored badge (green > 15 days, orange 5-15 days, red < 5 days).

### 5. Prescription calculator — `frontend/src/app/calculators/prescription/page.tsx`

Pure frontend logic. Tunisian prescription periods:

**Civil:**
- Action personnelle générale: 10 ans
- Action en responsabilité civile: 3 ans (from knowledge of damage)
- Action commerciale: 5 ans
- Action en paiement de loyer: 3 ans
- Action en nullité de contrat: 5 ans
- Créances alimentaires: 1 an

**Pénal:**
- Crime: 10 ans from the act
- Délit: 3 ans
- Contravention: 1 an

Show: start date → deadline date, with interruption/suspension adjustments if user enables them.

### 6. Sources display component — `frontend/src/components/SourceCard.tsx`

Reusable card showing:
- Source name (with an icon: ⚖️ for justice.gov.tn, 📜 for legislation-securite.tn, 🏛️ for diwan.tn)
- Document title
- Article/section reference
- Relevance score as a small colored dot (green > 0.8, yellow > 0.6, red otherwise)
- Link to URL if available
- Truncated excerpt on hover (tooltip)

### 7. Environment setup — create `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Style constraints
- keep the same style that's already in the frontend , don't touch it

## Important notes
- The Mirath, Prescription and Délais calculators do NOT call the backend — they are pure deterministic logic
- Only the chat (`/`) calls the backend
- The `/retrieve` endpoint can optionally be used to show a "Related articles" panel in the chat sidebar
- Add loading skeletons, not spinners — the UI must never show a blank flash
- All user-facing text should be bilingual (French default, Arabic when detected)
