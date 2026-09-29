# Eight-player runtime deployment

This patch improves render/loading cost and bounds LLM concurrency. It does NOT
make independent Vercel function instances share world state. Production eight-player
acceptance remains blocked on choosing and provisioning a persistent host.

## Topology

Keep the public `/cyber-hutong/` URL. Once a host is selected, change its existing
portfolio rewrite to forward the entire subpath (assets, auth, game APIs and SSE)
to one always-on Node 24 container. No browser cross-origin auth is required.
Run exactly ONE replica/worker: world state, leases, chats, the director and LLM
pool are process-owned. Do not use PM2 cluster or autoscaling multiple replicas.
The existing authenticated Turso database remains the account authority.

Build with `docker build -t cyber-hutong .`. Run with port 8787 exposed only through
an HTTPS proxy. Supply secrets at runtime, never as build arguments:

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: existing dedicated Hutong database.
- `DASHSCOPE_API_KEY`, optional `BAILIAN_MODEL`: existing LLM configuration.
- `HUTONG_ALLOWED_HOSTS=hanjing-laura.vercel.app`: public origin allowlist.
- `HUTONG_BASE_PATH=/cyber-hutong` (container default).

Mount a writable persistent volume at `/app/data` (owned by container user node)
for chats, modes and world checkpoints. Keep minimum replicas 1; disable sleep.
Proxy SSE without buffering, permit long-lived connections, and forward trusted
`Host`/`X-Forwarded-Host` and `X-Forwarded-Proto` headers. Do not expose an untrusted
forwarded-header path directly to the internet. Use restart policy and volume backups.

## Limits and acceptance

- Simulation 20 Hz; held keyboard input refreshes at 5 Hz, direction changes immediate.
- Movement/renewal no longer trigger redundant full-world broadcasts per user input.
- LLM pool: 2 active generations, 8 waiting, 8-second queue expiry; one active
  reply chain per conversation. Provider call timeout 10 seconds, chain deadline
  22 seconds. Human movement does not wait for LLM completion.
- These are per-process limits, NOT deployment-wide limits on current Vercel.
- Authentication is still checked for each request; no stale-auth cache introduced.

Before switching the rewrite, verify eight independent accounts across eight
browser contexts, movement/scene changes visible to all, private chat isolation,
LLM takeover cancellation, latency/packet loss, reconnect, and container restart
with the mounted volume. The automated local test covers eight API actors while
a mock LLM is blocked, not real internet latency, provider capacity, or Vercel
multi-instance consistency. No hosting provider or paid resource is provisioned.
