# OA Lab

**Local-first Online Assessment Practice Environment.**
Timed, AI-assisted repository debugging in a browser IDE (Monaco editor, real terminal, test runner, diff), with every challenge running in an isolated Docker sandbox.

> OA Lab is an independent practice tool. It is not affiliated with Amazon or any other company, and it does not reproduce any proprietary assessment.

## Quick start (students)

Requirements: **Docker Desktop** (running) and `git`. In Docker Desktop → Settings → Resources, give Docker at least **4 GB** of memory (**6 GB** or more for Spring Boot questions).

```bash
git clone https://github.com/rk4u00/oa-lab.git
cd oa-lab
docker compose up
```

Open **http://localhost:3000**, pick an assessment or a single challenge, and click **Start**.

Supported stacks: **Python/Django** (pytest), **Node.js/Express** (Jest / node:test), **Java/Spring Boot** (Maven), **C++/CMake** (CTest, or graded program output).

- **First run is slow (a few minutes).** It builds the app image and the sandbox images (Python/Django, Node.js, Java/Spring Boot), and installs each challenge's dependencies the first time you open it. Later starts are fast.
- **After `git pull`**, rebuild with `docker compose up --build`.
- **To stop**, press `Ctrl+C` or run `docker compose down`. Your attempts are kept in `./data`.

### Docker commands

Run these from the `oa-lab` folder.

| What you want | Command |
|---|---|
| Start OA Lab (builds automatically the first time) | `docker compose up` |
| Start it in the background | `docker compose up -d` |
| Watch the logs (useful while a question is preparing) | `docker compose logs -f` |
| See whether it is running | `docker compose ps` |
| Stop OA Lab (attempts are kept in `./data`) | `docker compose down` |
| Restart it | `docker compose restart` |
| Update to the latest version | `git pull` then `docker compose up --build` |
| Rebuild from scratch (after a broken build) | `docker compose build --no-cache` then `docker compose up` |
| Rebuild the sandbox images too | `docker rmi oa-lab-python oa-lab-node oa-lab-java oa-lab-cpp` then `docker compose up` (they are rebuilt on start) |
| List running question sandboxes | `docker ps --filter label=oa-lab=workspace` |
| Stop all question sandboxes | `docker rm -f $(docker ps -aq --filter label=oa-lab=workspace)` |
| Reset everything (deletes all attempts) | `docker compose down` then delete the `data/` folder |

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
| **21 debugging challenges** | Django (9), Spring Boot (7), Node.js / Express (4), C++ / CMake (1). Each one ships a failing test suite or graded output. |
| **3 assessment sets** | Amazon SDE practice OA (Django + Node), *Amazon-debugging-question* set, *Debugging Set 2* |
| **IDE** | Question panel, file explorer, Monaco editor with tabs and autosave, Ctrl/Cmd+click Go to Definition, Find References, Markdown preview, a real terminal inside the sandbox, test results, diff of your changes, AI-coach prompt |
| **Assessment engine** | Server-side timers, auto-submit on expiry, protected test files restored before grading, score = test pass rate |

## Using the IDE

| Action | How |
|---|---|
| Run the tests | **Run Tests** button, or `Ctrl/Cmd+'` |
| Run some of the tests | Type a target in the Test Results tab: a file such as `tests/test_m1_python.py`, a `-k` expression, or a Java test class |
| Save | Files autosave. `Ctrl/Cmd+S` saves immediately |
| Go to a function's definition | `Ctrl/Cmd+click` it, or `F12`. It opens the file and jumps to the line |
| Peek a definition / find all usages | `Alt+F12` / `Shift+F12` |
| Find / replace, command palette | `Ctrl/Cmd+F`, `Ctrl/Cmd+H`, `F1` |
| Read Markdown nicely | `.md` files open rendered. Switch between **Preview**, **Split** and **Edit** in the tab bar |
| Undo all your changes | Reset button (↺) in the Files panel |
| Re-attempt a finished section | **Retry** on the assessment page, next to an expired or submitted section. You get a fresh repository and a new timer, and the previous score stays in the attempt's timeline |
| Get AI help | **AI Coach** tab. It copies a prompt with the task and your failing tests for Claude, Cursor, Copilot and others |

Test files are locked (🔒). If you change them from the terminal anyway, the originals are restored before final grading.

## How it works

```
Browser (Next.js, :3000) ──REST/WS──► API (NestJS, :4000) ──docker CLI──► per-session sandbox containers
                                         │                                 (no network, non-root, read-only FS,
                                         └─ SQLite (Prisma)                 CPU/RAM/PID limits)
```

1. **Universal challenge engine.** Every challenge is just an `oa-challenge.json` manifest (`packages/shared/src/schemas.ts`). The UI and API never hard-code a challenge.
2. **Preparation.** Dependency install (`pip install --target`, `npm ci`, a Maven warm-up build) runs **once per challenge, with network**, and is then cached in `data/prepared/`.
3. **Sessions.** Each attempt gets a fresh copy of the repository and its own container. Tests run with **networking disabled**.
4. **Grading.** On submit (or when time runs out), the sandbox is stopped (closing any terminal), protected paths such as `tests/` are restored from the pristine copy, and the final suite runs in a fresh container.
5. **Hidden tests.** A challenge can keep expected results out of the workspace (`execution.hiddenDir`). They are copied in only for final grading and deleted right after. Failure messages for hidden tests say which field is wrong, never the expected value.
6. **Output-graded programs.** For programs judged on their output (like the C++ *Category Browse Engine*), a grader in `execution.supportDir` runs the program and writes one test per input line. Run Tests uses the visible sample, and Submit adds the hidden results.

## Resource usage

A sandbox container is created per attempt, but only the question you are working on has one running. It is removed when you submit.

| Setting | Default | What it does |
|---|---|---|
| `OA_IDLE_STOP_MINUTES` | `10` | Stops a sandbox after N minutes without activity (editing, tests, terminal). It is recreated automatically the next time you use it, and your files are kept. |
| `OA_RETENTION_DAYS` | `7` | Deletes finished attempts' files after N days. Scores, test results and diffs stay in the database. |

At startup, OA Lab also removes sandbox containers left over from a crash or restart. One user needs about 4 GB RAM for Django/Node questions and 8 GB for Spring Boot questions.

## Repository layout

```
apps/api            NestJS API: content registry, importer, sessions, workspaces, terminal
apps/web            Next.js UI: dashboard, assessment overview, IDE, results
packages/shared     Zod schemas (challenge manifest, assessment) + shared types
packages/execution-engine   Docker/local drivers, JUnit + Jest result parsers
content/amazon      Original OA Lab challenges + Amazon practice profile
content/imported    Third-party practice repos (see ATTRIBUTION.md) + generated manifests
infrastructure/docker  Sandbox runtime Dockerfiles (python, node, java, cpp)
prisma              SQLite schema + migrations
scripts             CLI (import / validate), runtime build, container entrypoint
```

## Adding more questions

```bash
pnpm oa import https://github.com/<owner>/<repo>    # detects Django / Spring Boot / Node projects
pnpm validate                                       # validate every manifest
```

C++ projects with a `CMakeLists.txt` are detected too: they are built with CMake and scored with CTest. For a program graded on its output, see `content/amazon/debugging/cpp/category-engine-001/` (`oa-challenge.json`, `support/grade.py`, `hidden/`, `solution/reference.py`).

The importer writes manifests into `imports/<repo>/.oa-lab/`. You can also import from the dashboard ("Import repository"); when OA Lab runs in Docker those land in `data/imports/`. To ship them with OA Lab for everyone, copy the folder into `content/imported/` (without its `.git`) and commit it.

## Development (without the app container)

```bash
pnpm install
cp .env.example .env
pnpm runtimes:build        # sandbox images
pnpm db:migrate
pnpm dev                   # web :3000, api :4000
```

`OA_EXECUTION_DRIVER=local` runs challenge code directly on the host, with no isolation. Use it only to develop OA Lab itself.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` / "Docker unavailable" badge | Start Docker Desktop, wait until it's running, then `docker compose up` again. |
| A question stays on "Preparing your workspace" | The first open of a question installs its dependencies (Spring Boot takes the longest). Watch progress with `docker compose logs -f`. |
| Spring Boot tests are killed or very slow | Give Docker Desktop more memory (6–8 GB). |
| Terminal says "session closed" | Press **Reconnect**. Stopped sandboxes are recreated automatically. |
| `ERR_PNPM_OUTDATED_LOCKFILE` while building | Run `git pull` to get the latest lockfile, then `docker compose up --build`. |
| Start completely fresh | `docker compose down`, then delete the `data/` folder. |

## Hosting on a server

OA Lab is built for one user on their own machine. If you host it:
- **Add a login first.** There is none yet, and anyone who can open the page gets a terminal inside the sandboxes, so put it behind a VPN, SSH tunnel, or a reverse proxy with authentication.
- **Rebuild for the server's address.** Pass `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` as build arguments (for example `https://oa.example.com:4000`).
- **Size:** 2 vCPU / 4 GB RAM is enough for Django/Node questions; use 4 vCPU / 8 GB for Spring Boot.

## Security model

Sandboxes run as uid 1000 with `--cap-drop ALL`, `no-new-privileges`, a read-only root filesystem, tmpfs scratch space, memory/CPU/PID limits, and `--network none` during the assessment. Only the session workspace is mounted. Only the API talks to Docker, and the Docker socket is never exposed to the browser.

## Roadmap

DSA coding section · workstyle survey · behavioral (STAR) answers · more companies.
