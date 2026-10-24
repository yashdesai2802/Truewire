# TrueWire — Live Desk & AI News Verification Platform

> **Independent News Desk · AI Verification**  
> A production-ready, dark-themed real-time newsroom dashboard and AI-powered multi-modal verification platform designed for Indian Hindi broadcasting channels and global wire services.

---

## 1. Overview & Architectural Design

TrueWire delivers a live newsroom command center matching the aesthetics of professional wire services. It combines live Indian Hindi broadcast feeds with a tri-modal fact-checking engine capable of cross-referencing claims against active news stories.

### Visual & Functional Highlights:
- **Pixel-Accurate Interface**: Deep navy background (`#0F1521`), warm gold/amber accents (`#E8A33D`), serif titles and headlines (`Fraunces` / `Noto Serif Devanagari`), and monospaced metadata (`IBM Plex Mono`).
- **Live Masthead**: Features a live pulsating status dot, digital digital clock (`HH:MM:SS`), and dynamic story counter tracking loaded feeds.
- **Continuous News Ticker**: Smoothly scrolls breaking headlines with orange channel attribution badges and pauses on hover.
- **Two-Column Command Center**:
  - **Left Desk (The Verifier)**: Tri-modal verification for **TEXT**, **LINK**, and **IMAGE** claims.
  - **Right Desk (Live Wire)**: Real-time newsroom feed with dynamic countdown timer, instant client filtering, and deep archive search.
- **English UI Guarantee**: The entire dashboard interface, section titles, verdicts, and explanations are delivered in clear English, while original Hindi news headlines are preserved in their native Devanagari script.

---

## 2. Hindi News Channel Integration

TrueWire prioritizes accredited Indian Hindi news channels and national publishers:

| Publisher / Broadcaster | Channel ID | Language | Description |
| :--- | :--- | :--- | :--- |
| **Aaj Tak** | `aaj-tak` | Hindi (`hi`) | India's premier 24x7 Hindi news channel |
| **ABP News** | `abp-news` | Hindi (`hi`) | National Hindi broadcast network |
| **NDTV India** | `ndtv-india` | Hindi (`hi`) | Acclaimed Hindi news division of NDTV |
| **Zee News** | `zee-news` | Hindi (`hi`) | Leading national Hindi news channel |
| **News18 Hindi** | `news18-hindi` | Hindi (`hi`) | Network18's flagship Hindi digital wire |
| **India TV** | `india-tv` | Hindi (`hi`) | High-impact national broadcast desk |
| **Dainik Jagran** | `dainik-jagran` | Hindi (`hi`) | India's most read Hindi daily newspaper |
| **Amar Ujala** | `amar-ujala` | Hindi (`hi`) | Leading northern Hindi broadsheet |
| **BBC News Hindi** | `bbc-news-hindi` | Hindi (`hi`) | International Hindi service of BBC |
| **DD News** | `dd-news` | Hindi (`hi`) | Public service television broadcaster |
| **Optional English Feeds** | `the-hindu`, `indian-express`, `techcrunch`, `bbc-news` | English (`en`) | National & international contextual wires |

---

## 3. Fact-Checking & Verification Workflow

The verification pipeline implements a 7-stage journalistic corroboration protocol:
1. **Factual Claim Extraction**: Separates assertions from rhetoric, opinion, or satire.
2. **Entity & Context Recognition**: Identifies public figures, locations, dates, and institutions.
3. **Live Wire Cross-Referencing**: Searches active stories across 80+ monitored news feeds and Google News search index.
4. **Primary Source Prioritization**: Weights government gazettes, court orders, press releases, and accredited wire reporting over unverified viral social posts.
5. **Timeline & Recency Audit**: Checks when the event reportedly took place versus when reporting began.
6. **Distinction of Evidence**: Evaluates whether contradictory statements exist or if the claim is simply uncorroborated.
7. **Verdict & Limitation Synthesis**: Produces a standardized structured report.

### Standardized Verdicts:
- `SUPPORTED` — Substantiated by multiple accredited primary sources.
- `MOSTLY SUPPORTED` — Substantively true with minor contextual discrepancies.
- `MISLEADING` — Genuine material presented with false framing or out-of-context dates.
- `MOSTLY FALSE` — Key claims are factually inaccurate with incidental factual elements.
- `FALSE` — Contradicted by official records, eyewitnesses, or accredited reporters.
- `UNVERIFIED` — Plausible but absent from accredited wire archives.
- `INSUFFICIENT EVIDENCE` — Missing verifiable provenance or forensic markers.

---

## 4. Project Structure

```
truewire/
├── public/
│   ├── index.html            # Main desktop & mobile dashboard
│   ├── style.css             # Newsroom styling, CSS variables & animations
│   ├── script.js             # Client controller, live clock, ticker & tabs
│   └── assets/               # Favicon, icons & media
├── routes/
│   ├── news.js               # News wire endpoints & search routes
│   └── verify.js             # Text, link, and image verification endpoints
├── services/
│   ├── newsService.js        # Multi-feed RSS parsing, deduplication, caching
│   ├── articleService.js     # SSRF-guarded article reader & HTML extractor
│   └── verificationService.js# AI fact-checking engine & fallback evaluator
├── middleware/
│   └── uploadValidation.js   # Multer file validation with magic byte checks
├── utils/
│   └── validation.js         # SSRF IP address guards, DNS resolution & sanitizers
├── data/
│   └── fallbackStories.json  # Offline fallback news cache
├── test/
│   └── run-tests.js          # Comprehensive 13-point automated test suite
├── server.js                 # Express server with Helmet, CORS & Rate limiting
├── package.json              # Dependencies and run scripts
├── .env.example              # Environment configuration template
├── .env                      # Local environment configuration
├── .gitignore                # Git ignore rules
└── README.md                 # Complete documentation
```

---

## 5. Security & Reliability Architecture

- **SSRF (Server-Side Request Forgery) Guard**:
  - Validates all user-submitted URLs against loopback, private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`), and IPv6 private/link-local ranges (`::1`, `fc00::/7`, `fe80::/10`).
  - Pre-resolves DNS records using `dns.lookup` to ensure domain names do not resolve to internal or cloud metadata endpoints (`169.254.169.254`).
  - Limits redirects to a maximum of 3 hops, re-evaluating each redirected location.
  - Imposes an 8-second request timeout and a 2MB maximum payload limit.
- **Strict File Upload Validation**:
  - Memory-buffered processing via Multer (prevents orphaned files on disk).
  - Inspects file **magic bytes** (binary signatures) to prevent malicious executable files disguised as `.png` or `.jpg`.
  - Enforces a 5MB maximum file size.
- **Centralized Rate Limiting**:
  - General API endpoints: 200 requests / 15 minutes.
  - Verification endpoints: 40 requests / 15 minutes to safeguard external AI quotas.
- **Secure Headers & CSP**:
  - Integrated with Helmet, configuring strict Content Security Policy directives.
  - Safe HTML rendering with text escaping to prevent XSS.

---

## 6. API Configuration Guide

TrueWire supports multiple AI providers configurable via `.env`:

### 1. Google Gemini (Default Recommendation)
```env
AI_PROVIDER=gemini
AI_API_KEY=AIzaSy...your_gemini_api_key_here
AI_MODEL=gemini-1.5-flash
```
*How to obtain*: Visit [Google AI Studio](https://aistudio.google.com/), sign in with your Google account, and click **Create API Key**.

### 2. OpenAI
```env
AI_PROVIDER=openai
AI_API_KEY=sk-proj-...your_openai_api_key_here
AI_MODEL=gpt-4o-mini
```
*How to obtain*: Visit the [OpenAI Platform](https://platform.openai.com/api-keys) and generate a secret key.

### 3. Anthropic Claude
```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...your_anthropic_api_key_here
AI_MODEL=claude-3-5-sonnet-20241022
```
*How to obtain*: Visit the [Anthropic Console](https://console.anthropic.com/).

### Zero-Key Development Mode:
If `AI_API_KEY` is left blank, TrueWire operates in **Live Wire Cross-Check Development Mode**:
- Cross-references queries against the 300+ live wire articles and Google News index.
- Provides authentic evaluations clearly marked with a `Live Wire Engine (Local Evaluation)` badge.
- Never crashes, never fabricates API keys, and never hallucinates sources.

---

## 7. API Endpoints Reference

### News Endpoints
- **`GET /api/news`**
  - Query parameters:
    - `source` (e.g., `aaj-tak`, `ndtv-india`, `all`)
    - `language` (`hi`, `en`, `all`)
    - `search` (case-insensitive title filter)
    - `limit` (default: 80, max: 100)
- **`GET /api/news/search?q=query&lang=hi`**
  - Searches live indexed web articles across Indian news sources.
- **`GET /api/news/sources`**
  - Returns registered publishers and real-time connectivity status.
- **`GET /api/health`**
  - Returns server status, story count, and configuration diagnostics (never reveals secrets).

### Verification Endpoints
- **`POST /api/verify/text`**
  ```json
  {
    "text": "The Reserve Bank of India has announced new digital currency guidelines."
  }
  ```
- **`POST /api/verify/link`**
  ```json
  {
    "url": "https://example.com/breaking-story"
  }
  ```
- **`POST /api/verify/image`**
  - `multipart/form-data` with field `image` (PNG, JPG, or WebP).

---

## 8. Installation & Execution

### Prerequisites
- Node.js version 18.0.0 or higher (Tested on Node.js v24)
- npm version 9.0.0 or higher

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

### Step 3: Run the Application
```bash
# Production mode:
npm start

# Development mode (with auto-reload):
npm run dev
```
Open your browser and navigate to:
**`http://localhost:3000`**

### Step 4: Run the Automated Test Suite
```bash
npm test
```
Runs the 13-point test suite covering SSRF protection, Hindi parsing, image signature audits, empty payload validation, and rate limits.

---

## 9. License & Journalistic Disclaimer

TrueWire is an open-source assistive prototype designed for journalists and researchers. AI-assisted analysis does not replace primary ground reporting. For sensitive or legal assertions, consult certified fact-checking signatories of the International Fact-Checking Network (IFCN).
