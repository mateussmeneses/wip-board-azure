# Azure DevOps Read-Only API Client — T2.1

> Status: implemented and tested OFFLINE (automated suite green, 318 pass; 90 new
> for this task). Real, signed-in access against a live Azure DevOps tenant is
> NOT yet proven — see section 7. The integration ships behind a feature flag that
> is OFF by default, so the DOM + local-storage runtime is completely unchanged.
>
> Code comments stay in English. User-facing strings stay bilingual (EN / PT-BR);
> this task adds NO UI, so no new string is introduced. No existing feature is
> removed, WIP semantics are preserved, and no commit/push was made by this task.

---

## 1. What this adds

An independent, read-only integration layer with the official Azure DevOps REST
API (api-version 7.1). It can, when enabled AND authenticated, read:

- team iterations (sprints): id, name, path, start/finish dates, timeframe;
- the work item ids of an iteration (duplicate references de-duplicated);
- work items by id, selecting only the needed fields, batched at ≤ 200 per call;
- board columns: order, names, state→column mappings, the outgoing (done) column;
- WIQL query results (read-only POST) resolving to work item ids.

It does NOT yet build any sprint dashboard or indicator (that is T2.2+). It adds
no control to the main experience. With the flag off it issues no request.

---

## 2. Architecture (small, injectable modules)

| Module | Responsibility |
|---|---|
| `src/api/ado-url.js` | Build & validate every URL. Host allow-list, traversal/injection defense, fixed api-version. Only read endpoints + the WIQL POST are expressible. |
| `src/api/ado-errors.js` | One typed error model. Maps status→category, decides retryability, classifies thrown fetch errors, exposes a credential-free safe projection. |
| `src/api/ado-contracts.js` | Pure normalization of raw REST payloads into stable shapes. Keeps `System.State` distinct from the board column; preserves absent fields as UNAVAILABLE. |
| `src/api/ado-auth.js` | Injectable auth provider. Default = same-origin session cookie (no stored token). Null provider for the flag-on/no-auth state. Entra OAuth left as an injectable seam. |
| `src/api/ado-transport.js` | Injectable `fetch` wrapper. Enforces the read-only method policy, attaches auth, applies a timeout, classifies outcomes, retries only transient faults with bounded jittered backoff. |
| `src/api/ado-feature-flag.js` | The single gate. Reads `azureApiEnabled` (default false) from `chrome.storage.sync`; `canMakeRequests` requires BOTH the flag on AND available auth. Fail-safe to disabled. |
| `src/api/ado-client.js` | Composition root. Wires the modules, validates scope, batches work items, dedupes ids, selects the current iteration, and gates every method. |

Responsibilities are deliberately small and the transport/auth are injectable so
the whole client runs offline in tests with mocks (no live network in CI).

```
feature flag (off by default)
      │ gate: flag ON  AND  auth available
      ▼
ado-client ──uses──► ado-url (safe URLs) ──► ado-transport (fetch + retry)
      │                                            │ auth via
      │                                            ▼
      └──normalizes with──► ado-contracts     ado-auth (session cookie / injectable)
                 errors classified by ──► ado-errors
```

---

## 3. Data contracts

- **Scope**: `{ organization, project, team, board, organizationUrl? }`.
- **Iteration**: `{ id, name, path, startDate, finishDate, timeframe }`; absent
  dates are `UNAVAILABLE`, never invented.
- **BoardColumn**: `{ id, name, order, columnType, isDoneColumn, stateMappings,
  itemLimit }`; order = response order (flow order); the `outgoing` column is the
  done column.
- **WorkItem**: `{ id, title, type, state, iterationPath, areaPath, boardColumn,
  boardColumnDone, tags, storyPoints, parentId, relations }`.
- **ApiCapability**: `{ featureFlagEnabled, authStrategy, authAvailable,
  liveAccessProven, endpointsImplemented, notes }`.
- **ApiError (AdoApiError)**: `{ category, status, retryable, retryAfterSeconds,
  message }` with a `toSafeObject()` projection that contains no headers/body.

Correctness rules honored:

- `System.State` is stored in `state`; the visual board column is stored
  SEPARATELY in `boardColumn`. A state literally named "Closed" is never assumed
  to be the board's "Closed" column.
- A field the API did not return is preserved as the frozen `UNAVAILABLE`
  sentinel — the SAME sentinel the snapshot store already recognizes — never
  coerced to `null`, `0` or `""`.

---

## 4. Endpoints implemented (REST 7.1)

| Need | Method | Path | Notes |
|---|---|---|---|
| Iterations | GET | `/{org}/{project}/{team}/_apis/work/teamsettings/iterations` | current sprint via `timeFrame === 'current'`, else null |
| Iteration work items | GET | `.../iterations/{iterationId}/workitems` | ids de-duplicated, order preserved |
| Work items (batch) | GET | `/{org}/{project}/_apis/wit/workitems?ids=…&fields=…` | ≤ 200 ids/call, chunked, field selection |
| Board columns | GET | `/{org}/{project}/{team}/_apis/work/boards/{board}/columns` | order/name/mappings/done column |
| WIQL | POST | `/{org}/{project}/_apis/wit/wiql` | read-only query; the ONLY POST the client can emit |

No create/update/delete endpoint exists in the client. The read-only guarantee is
structural: the URL builder cannot assemble a mutating URL, and the transport
rejects any non-GET method except the WIQL POST (routed with an explicit flag).

---

## 5. Authentication strategy & its limitations

- **Default (implemented): same-origin session cookie.** A content script injected
  into the live `dev.azure.com` page can issue a same-origin `fetch` with
  `credentials: 'include'`, reusing the user's EXISTING browser session. The
  extension reads no cookie, stores no token, and adds no Authorization header.
- **No PAT.** No personal access token is embedded in code or persisted in
  extension storage (explicit non-goal).
- **Recommended for a distributed extension: Microsoft Entra ID OAuth**
  (authorization code + PKCE via `chrome.identity.launchWebAuthFlow`), NOT a
  legacy/implicit flow and NOT a stored PAT. This depends on an Entra app
  registration, which is an ADMINISTRATIVE dependency not available here. It is
  left as an injectable provider seam so it can be supplied later without changing
  the client.

Limitation: the same-origin session-cookie path is HYPOTHESIZED and unit-tested
with mocks; it is NOT yet proven against a live tenant (section 7). Until a
signed-in spike confirms it, `liveAccessProven` stays `false` and delivery modules
must degrade to DOM + local snapshots.

---

## 6. Security posture

- Feature flag OFF by default; `canMakeRequests` also requires available auth, so
  a half-configured state issues nothing.
- Host allow-list (`dev.azure.com`, `*.visualstudio.com`); HTTPS only; every path
  segment validated and encoded (blocks `../` traversal, `//host` injection and
  query smuggling). An arbitrary URL cannot be reached.
- Read-only by construction (no mutating URL builder; transport rejects writes).
- No token in the repo, no embedded credential, no insecure persistence.
- No log ever contains Authorization headers or bodies; the logger receives only
  the safe error projection (category/status).
- Least privilege: no new manifest permission; the existing `host_permissions`
  already cover the same-origin fetch.
- Insufficient permissions (403) are surfaced explicitly and never retried.

---

## 7. Capabilities proven vs simulated

| Capability | Status | Evidence |
|---|---|---|
| Safe URL construction + host/traversal defense | PROVEN (offline) | `test/ado-url.test.js` |
| Read-only method policy (only GET + WIQL POST) | PROVEN (offline) | `test/ado-transport.test.js`, `test/ado-client.test.js` |
| Normalization (iterations/columns/work items) | PROVEN (offline) | `test/ado-contracts.test.js` |
| State ≠ board column; UNAVAILABLE for absent fields | PROVEN (offline) | `test/ado-contracts.test.js`, `test/ado-client.test.js` |
| Batching > 200 ids; duplicate id dedupe | PROVEN (offline) | `test/ado-client.test.js` |
| 401/403/404/429/5xx, timeout, network/CORS, malformed | PROVEN (offline) | `test/ado-errors.test.js`, `test/ado-transport.test.js` |
| Bounded retry + backoff (never infinite) | PROVEN (offline) | `test/ado-transport.test.js` |
| Feature flag off ⇒ no request; MV3 unchanged | PROVEN (offline) | `test/ado-feature-flag.test.js`, `test/ado-manifest-safety.test.js` |
| **Live, signed-in REST access to a real tenant** | **NOT PROVEN** | pending the spike in `DATA_ACCESS_SPIKE.md §3` |

The task is complete as "client implemented and tested offline". Real access
remains an unproven capability gated on an administrative/sign-in dependency.

---

## 8. Tests executed

`npm test` (Node's built-in runner, single-run) — **318 pass, 0 fail** (228 prior
+ 90 new). New files:

- `test/ado-url.test.js`
- `test/ado-errors.test.js`
- `test/ado-contracts.test.js`
- `test/ado-auth.test.js`
- `test/ado-feature-flag.test.js`
- `test/ado-transport.test.js`
- `test/ado-client.test.js`
- `test/ado-manifest-safety.test.js`
- `test/helpers/mock-fetch.js` (zero-dependency fetch/auth/storage mocks)

Regression: the full prior suite (WIP logic, DOM reader, snapshot store, Daily
Commitment/Picker/Projected/Comparison/History, MutationObserver R1, runtime
stability, i18n parity) stays green, proving no regression in WIP calculation, the
R1 observer fix, or the Daily modules.

---

## 9. Risks & dependencies

- **Live access unproven.** The same-origin session-cookie assumption must be
  confirmed by the signed-in spike before T2.2 depends on real data.
- **Entra OAuth needs an app registration** (administrative). Recorded as a
  dependency; a provider seam is ready.
- **DOM selector fragility (R2)** is unrelated to this layer but still the basis
  of the DOM fallback the delivery modules rely on when the API is unavailable.

---

## 10. Next increment

T2.2 — Sprint Scope & Goal: use `getCurrentIteration` + `getIterationWorkItemIds`
+ `getWorkItems` to compute the current sprint's period, goal, planned scope and
later scope changes, labeling the metric as delivery (not WIP). It consumes this
client behind the same flag and degrades to DOM + snapshots when the API is off.
