# Manual steps left in the ToyBox install

Question: which steps of the current ToyBox install are still manual after `install.sh` and `post-install.sh`, and which of those would stop Make Me Say from starting in that same post-install run when its config block is filled in?

Sources are the ToyBox repo (`Z:\Projects\Torrenting Machine`) as read on 27 Nov 2026, plus the Make Me Say files those templates assume. Live host figures are from a read-only SSH check the same evening. No service was changed, and no env file or `setup.conf` was read.

## Answer

Filling the portfolio block does not start Make Me Say during `post-install.sh`. That script brings stacks up with `docker compose`, and `compose-portfolio.yml` is not one of them. Komodo is itself started that way; its UI is a later registration step and does not launch this stack either.

`install.sh` does copy filled `PORTFOLIO_*` values into `docker/.env`. The clone, the Dockerfile copy, the MySQL data directory, the UFW opening for port 8088, the public hostname, the word seed, and the compose up are all still outside both scripts.

If that same post-install run were extended to `docker compose -p portfolio -f compose-portfolio.yml up -d --build` once the block was filled, two missing manual steps would stop it before any container existed: the Make Me Say repo is not cloned to `PORTFOLIO_DIR`, and the ToyBox Dockerfiles plus `nginx.conf` are not copied into that clone. After those two, the stock image would still fail to stay up. The backend process reads a schema file the runtime image does not contain and exits, and the compose healthcheck requests `/healthz` while the server listens on `/health`. `portfolio-web` waits until the backend is healthy, so the published site would not start.

The word seed, the UFW rule for 8088, the NPM `play` host, the Cloudflare Tunnel hostname, and the Uptime Kuma monitor stay manual. They do not decide whether the containers are launched.

## How stacks start today

`post-install.sh` step 5 is the first start. From `/opt/homeserver/docker` it runs `docker compose up -d` for project `komodo`, then `vpn-arr`, `wireguard-qbt`, `media`, and `infra`. Photos is included only when `IMMICH_DB_PASSWORD` is set and is not a placeholder. `cloudflared` is included only when `CLOUDFLARE_TUNNEL_TOKEN` is set and is not a placeholder. There is no matching branch for portfolio.

Komodo's compose file is started in that step, before the app stacks, so the management UI is up. Setup 3 of `docs/setup-guide.md` then has a person create the first admin and click Deploy on each stack. That Deploy adopts containers post-install already started. The stack table there is `vpn-arr`, `wireguard-qbt`, `media`, `infra`, and `photos` when Immich was configured. Portfolio is absent.

`deploy.ps1` is the usual caller: autoinstall hands off to it, and it runs install, waits for reboot, runs post-install, then `scripts/bootstrap-services.sh`. Bootstrap wires qBittorrent, NPM, Pi-hole DNS, the *arr apps, cross-seed stubs, and Uptime Kuma. Its proxy-host list has no `play` name and no port 8088. Its closing "still manual" list is the *arr / Jellyfin / Seerr / Bazarr / Librarr wizards, Prowlarr indexers, Tailscale split DNS, and Cloudflare Tunnel public hostnames. Portfolio is not on that list.

## What the two scripts already do for Make Me Say

`install.sh` sources `setup.conf` when it is present and writes non-empty portfolio keys into `/opt/homeserver/docker/.env`: `PORTFOLIO_DIR`, `PORTFOLIO_DOMAIN`, `PORTFOLIO_PORT`, `PORTFOLIO_DB_NAME`, `PORTFOLIO_DB_USERNAME`, `PORTFOLIO_DB_PASSWORD`, `PORTFOLIO_DEEPSEEK_API_KEY`, `PORTFOLIO_PASSPHRASE_NAME`. When `DOMAIN` is set and `PORTFOLIO_DOMAIN` is blank, it sets `PORTFOLIO_DOMAIN` to `play.${DOMAIN}` before that copy.

The template block in `setup.conf.example` already names the path and port the design uses: `PORTFOLIO_DIR=/opt/homeserver/portfolio/Make-Me-Say`, `PORTFOLIO_PORT=8088`, database `makemesay`. The password, DeepSeek key, and passphrase name are blank there. The comment on that block says the stack is not started by install or post-install and is deployed by hand. `design-portfolio.md` and the header of `compose-portfolio.yml` say the same thing. Compose project name is `portfolio`. The web service publishes `${PORTFOLIO_PORT:-8088}` to container port 80.

`install.sh` creates the `/mnt/data` tree and does not create a `portfolio/mysql` directory. `post-install.sh` does not mention portfolio.

## Steps still manual after both scripts

### Make Me Say (design §6, none of it is in either script)

1. Clone the repo to `PORTFOLIO_DIR` and chown that directory.
2. Copy `docker/portfolio/Dockerfile.backend` to `backend/Dockerfile`, `Dockerfile.web` to `frontend/Dockerfile`, and `nginx.conf` to `frontend/nginx.conf`.
3. Create `${DATA_DIR}/portfolio/mysql` on the LUKS volume and chown it. With a single data disk, `DATA_DIR` is the `/mnt/data` tree; with USB disks pooled, `design-storage-management.md` sets `DATA_DIR` to `/mnt/pool`.
4. `docker compose -p portfolio -f compose-portfolio.yml up -d --build` from `/opt/homeserver/docker`.
5. Seed target words once the stack is healthy: `docker compose -p portfolio -f compose-portfolio.yml run --rm portfolio-backend npx tsx scripts/seedWords.ts`.
6. NPM proxy host `play.<domain>` to port 8088, websockets on, no Authentik forward auth.
7. Cloudflare Tunnel public hostname `play.<domain>` to `http://localhost:80` (NPM).
8. UFW allow from `192.168.0.0/16` to TCP 8088. `install.sh` step 9 does not open 8088, and the UFW table in `design-v2-overview.md` does not list it.
9. Uptime Kuma HTTP monitor for `:8088` or the public name.

`docker/portfolio/README.md` also says to check five assumptions in those templates before trusting the build. Two of them fail against the current Make Me Say tree, and they matter for a start. They are recorded in the next section.

### The rest of the install

`post-install.sh` prints a required-manual list when it finishes: qBittorrent web UI (localhost bypass, password, quarantine command, `wg0`), Radarr/Sonarr/Lidarr/Librarr roots and download clients, Bazarr, Seerr, a second bootstrap after the *arr wizards so Unpackerr gets API keys, iDrive (Setup 2), USB disks when `DATA_USB_DRIVES` was empty (Setup 2b), Prowlarr indexers plus `cross-seed` `config.js`, Uptime Kuma monitors, the NPM admin password, Obsidian clients (Setup 7), and the Immich admin account when photos was started. `install.sh` also leaves `backup-b2.timer` disabled until Feb 2027, and leaves Tailscale unactivated when `AUTO_CONFIRM=yes` and `TAILSCALE_AUTHKEY` is empty.

`bootstrap-services.sh` is not part of either script. `deploy.ps1` runs it after post-install and covers the qBittorrent prefs, NPM admin and proxy hosts, Pi-hole local DNS, *arr roots and download clients, Recyclarr, cross-seed stubs, and Kuma when those credentials are set. After that script, a person still does the first-run wizards and DNS that Setup 1's "where you are" names, plus Setup 2 through Setup 10: iDrive, optional USB pool, Komodo UI, Prowlarr indexers and the remaining download-pipeline checks, Jellyfin and Seerr, Tdarr, router DNS plus Tailscale split DNS plus the Cloudflare Tunnel and Access policy, Obsidian clients, Immich admin, and the proof pass.

None of those media, backup, or DNS steps gate the portfolio compose file. They are the rest of what stays manual. They would not stop a portfolio start inside the post-install run.

## What would stop Make Me Say in that same run

Assume the config block is filled, so `install.sh` has written the portfolio keys and `PORTFOLIO_DB_PASSWORD`, `PORTFOLIO_DEEPSEEK_API_KEY`, and `PORTFOLIO_PASSPHRASE_NAME` are real values. Photos shows the pattern post-install already uses for "start this optional stack when its secret is set." Portfolio has no such test, so the run ends with the stack unstarted. That is the gap that stops it today.

The manual steps that would still stop a compose up added to that same run:

| Still-manual step | Effect on a start in that run |
|---|---|
| Clone to `PORTFOLIO_DIR` | Stops it. Both build contexts (`${PORTFOLIO_DIR}/backend` and `frontend`) are missing, so `up --build` fails before containers are created. |
| Copy the three templates into the clone | Stops it. Compose expects `backend/Dockerfile` and `frontend/Dockerfile`. The templates live under ToyBox `docker/portfolio/` until someone copies them. |
| Create `${DATA_DIR}/portfolio/mysql` | Documented, and not done by `install.sh`. It is not the first failure. Docker's `--volume` form creates a missing bind source as a directory ([bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)). The compose file uses that short syntax. The schema mount is a file (`database/schema.mysql` → `/docker-entrypoint-initdb.d/01-schema.sql`). A missing file is also created as a directory, which breaks MySQL init. Cloning the repo provides the file, so the clone is the step that matters. |
| `docker compose up -d --build` | This is the start. Nothing in post-install issues it. |
| Adjust the backend image so startup can see the schema | Stops a lasting start even after the clone and the copy. `backend/src/db/init.ts` reads `path.join(__dirname, '../../../database/schema.mysql')`. `tsconfig.json` emits `src/db/init.ts` to `dist/db/init.js`, so inside the image that path is `/database/schema.mysql`. `Dockerfile.backend` copies `dist/`, production `node_modules`, and `package.json` into the runtime stage and does not copy `database/`. `initializeDatabase()` throws, and `startServer()` exits 1. MySQL's own init mount is on the database container only, so a successful MySQL init does not give the backend process that file. |
| Point the healthcheck at `/health` | Stops `portfolio-web`. The server registers `GET /health`. The compose healthcheck requests `GET /healthz`. `portfolio-web` has `depends_on` with `condition: service_healthy` on the backend, so the published container is not started while that check fails. `docker/portfolio/README.md` assumption 4 already says to change the probe when the app has no `/healthz`. |
| Seed words | Does not stop the process. `checkDatabaseHealth()` warns when `target_words` is empty and still returns. The documented seed command also cannot run in this image: the runtime stage omits `tsx`, `scripts/`, and `backend/words/`. The script exists in the repo at `backend/scripts/seedWords.ts`. |
| UFW 8088, NPM `play` host, Tunnel hostname, Kuma monitor | Do not stop the containers. They are how other machines reach a stack that is already up. Bootstrap's NPM host list does not include `play`. |

One further template mismatch does not stop the containers and would stop a browser on another machine from calling the API. The web Dockerfile sets build arg `REACT_APP_API_BASE_URL=/api`. The client reads `REACT_APP_BACKEND_URL` and otherwise uses `http://localhost:3001` (`frontend/src/utils/api/client.ts`). The frontend is Create React App (`react-scripts` build → `build/`), which matches `Dockerfile.web`'s `COPY --from=build /app/build`. Assumption 2 in the portfolio README (Vite vs CRA) does not apply to this tree.

## Host memory

Read-only, `toybox@192.168.1.65`, host clock `23:01:38` on 27 Nov 2026. `free -h`, `nproc`, and `uptime` only. No sudo.

| | |
|---|---|
| RAM | 11 GiB total, 5.5 GiB used, 816 MiB free, 368 MiB shared, 6.5 GiB buff/cache, 6.1 GiB available |
| Swap | 6.9 GiB total, 2.3 GiB used, 4.6 GiB free |
| CPUs | 8 |
| Uptime | 30 days, 2 hours, 33 minutes; 3 users |
| Load | 8.68, 7.54, 6.57 |

`scripts/setup-memory-guard.sh` asks zram for `ram / 4` (about 2.8 GiB of the 11 GiB `free` reports). The live swap total is 6.9 GiB. `swapon` was not re-read, so this note does not say how much of that 6.9 GiB is zram. The README's hardware table lists 12 GB installed.

## Sources

ToyBox, `Z:\Projects\Torrenting Machine`:

- `install/install.sh` — portfolio env copy and `play.${DOMAIN}` derivation; `/mnt/data` directories; UFW rules; reboot then post-install.
- `install/post-install.sh` — step 5 compose projects, photos and tunnel conditionals, required-manual list, bootstrap reminder.
- `docs/setup-guide.md` — Setup 1 through Setup 10; Komodo adopts already-started stacks; manual alternative is install, post-install, then bootstrap.
- `docs/autoinstall.md` — autoinstall stops before Docker; `deploy.ps1` runs the scripts.
- `docs/design-portfolio.md` — optional stack, project `portfolio`, port 8088, §6 procedure.
- `docs/design-v2-overview.md` — service and port rows for Make Me Say; UFW table; `setup.conf` includes portfolio.
- `docs/design-storage-management.md` — `DATA_DIR` on `/mnt/data` or `/mnt/pool`.
- `docker/compose-portfolio.yml` — build contexts, schema bind, `/healthz`, `depends_on` health, host port.
- `docker/portfolio/README.md`, `Dockerfile.backend`, `Dockerfile.web`, `nginx.conf`.
- `setup.conf.example` — portfolio block and the "not started" comment. The live `setup.conf` was not read.
- `scripts/bootstrap-services.sh` — what the third script configures, and what it still leaves.
- `scripts/setup-memory-guard.sh` — zram size `ram / 4`.
- `README.md` — Docker Compose runtime, Komodo as the management UI, quick start via `deploy.ps1`, 12 GB RAM.

Make Me Say, this repo:

- `backend/src/index.ts` — `GET /health`; startup exits when database init throws.
- `backend/src/db/init.ts` — schema path; empty word list is a warning.
- `backend/src/config/env.ts` — a DeepSeek or OpenRouter key is required or the process exits at import. A filled `PORTFOLIO_DEEPSEEK_API_KEY` satisfies that.
- `backend/tsconfig.json` — `rootDir` `src`, `outDir` `dist`.
- `frontend/src/utils/api/client.ts` — `REACT_APP_BACKEND_URL`.
- `frontend/package.json` — `react-scripts` build.
- `backend/scripts/seedWords.ts` — present in the repo, not copied by the ToyBox runtime image.

Docker: [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/). `--volume` creates a missing source as a directory. `--mount` errors unless the source exists.
