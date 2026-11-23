# OA Lab

**Local-first Online Assessment Practice Environment.**
Timed, AI-assisted repository debugging in a browser IDE (Monaco editor, real terminal, test runner, diff), with every challenge running in an isolated Docker sandbox.

> OA Lab is an independent practice tool. It is not affiliated with Amazon or any other company, and it does not reproduce any proprietary assessment.

## Quick start (students)

Requirements: **Docker Desktop** (running) and `git`.

```bash
git clone https://github.com/rk4u00/oa-lab.git
cd oa-lab
docker compose up
```

The first run builds the image automatically. After `git pull`, use `docker compose up --build`. Then open **http://localhost:3000**, then pick an assessment or any challenge and click **Start**.

The first start builds the sandbox images (Python/Django, Node.js, Java/Spring Boot) and installs each challenge's dependencies the first time you open it, so it takes a few minutes. Later starts are fast.

Without Compose (one `docker run`):

```bash
docker build -t oa-lab .
docker run --rm -p 3000:3000 -p 4000:4000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD/data:/app/data" -e OA_HOST_DATA_DIR="$PWD/data" oa-lab
```

## What's inside

| | |
|---|---|
| **20 debugging challenges** | Django (9), Spring Boot (7), Node.js / Express (5). Each one ships a failing test suite. |
| **3 assessment sets** | Amazon SDE practice OA (Django + Node), *Amazon-debugging-question* set, *Debugging Set 2* |
| **IDE** | File explorer, Monaco tabs + autosave, xterm.js terminal inside the sandbox, test results, git-style diff, task panel, AI-coach prompt |
| **Assessment engine** | Server-side timers, auto-submit on expiry, protected test files restored before grading, score = test pass rate |

## How it works

```
Browser (Next.js, :3000) ──REST/WS──► API (NestJS, :4000) ──docker CLI──► per-session sandbox containers
                                         │                                 (no network, non-root, read-only FS,
                                         └─ SQLite (Prisma)                 CPU/RAM/PID limits)
```

1. **Universal challenge engine.** Every challenge is just an `oa-challenge.json` manifest (`packages/shared/src/schemas.ts`). The UI and API never hard-code a challenge.
2. **Preparation.** Dependency install (`pip install --target`, `npm ci`, a Maven warm-up build) runs **once per challenge, with network**, and is then cached in `data/prepared/`.
3. **Sessions.** Each attempt gets a fresh copy of the repository and its own container. Tests run with **networking disabled**.
4. **Grading.** On submit (or when time runs out), protected paths such as `tests/` are restored from the pristine copy and the full suite runs.

## Repository layout

```
apps/api            NestJS API: content registry, importer, sessions, workspaces, terminal
apps/web            Next.js UI: dashboard, assessment overview, IDE, results
packages/shared     Zod schemas (challenge manifest, assessment) + shared types
packages/execution-engine   Docker/local drivers, JUnit + Jest result parsers
content/amazon      Original OA Lab challenges + Amazon practice profile
content/imported    Third-party practice repos (see ATTRIBUTION.md) + generated manifests
infrastructure/docker  Sandbox runtime Dockerfiles (python, node, java)
prisma              SQLite schema + migrations
scripts             CLI (import / validate), runtime build, container entrypoint
```

## Adding more questions

```bash
pnpm oa import https://github.com/<owner>/<repo>    # detects Django / Spring Boot / Node projects
pnpm validate                                       # validate every manifest
```

The importer writes manifests into `imports/<repo>/.oa-lab/`. To ship them with OA Lab, move the folder into `content/imported/`. You can also import from the dashboard ("Import repository").

## Development (without the app container)

```bash
pnpm install
cp .env.example .env
pnpm runtimes:build        # sandbox images
pnpm db:migrate
pnpm dev                   # web :3000, api :4000
```

`OA_EXECUTION_DRIVER=local` runs challenge code directly on the host, with no isolation. Use it only to develop OA Lab itself.

## Security model

Sandboxes run as uid 1000 with `--cap-drop ALL`, `no-new-privileges`, a read-only root filesystem, tmpfs scratch space, memory/CPU/PID limits, and `--network none` during the assessment. Only the session workspace is mounted. Only the API talks to Docker, and the Docker socket is never exposed to the browser.

## Roadmap

DSA coding section · workstyle survey · behavioral (STAR) answers · more companies.
