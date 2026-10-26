# Data Access Spike — Azure DevOps (read-only)

> Purpose: determine, without assuming, whether the extension can read delivery data
> (sprints, iterations, work item history) beyond what the board DOM exposes, and at
> what cost/risk. The goal explicitly forbids assuming API access and forbids
> introducing credentials into code.

---

## 1. What the DOM already gives us (verified)

Evidence from the captured sample `elementos estruturados do board.html` in this repo
(counts via regex over the file):

| Signal | Occurrences | Selector |
|---|---|---|
| Cards with stable id | 73 | `.wit-card[data-itemid]` |
| Column headers | 12 | `.kanban-board-column-header` |
| Assignee blocks | 73 | `.identity-display-name` |
| `Aging` field mentions | 86 | `.field-container` label `aging` |
| `Target Date` field mentions | 76 | `.field-container` label `target date` |

One extracted card confirms a stable id and the org/project path:

```
<div data-itemid="620906" ... class="wit-card ...">
  ... <span class="...selectable-text">620906</span>
  <a class="title ..." href="/sda-iatec/Sda.Arms/_workitems/edit/620906"> ...
  ... <div class="work-item-state-name"><span>New</span></div>
```

So from DOM alone we reliably get: **work item id, org (`sda-iatec`), project
(`Sda.Arms`), type, state, column, assignee, aging, target date, tags**. This is enough
for a DOM-only Daily Commitment MVP (snapshot of column-per-id per day).

What the DOM does **not** reliably give: iteration/sprint boundaries and goals,
scope-change history, state-transition timestamps, Epic/Feature parent links, and the
Approved→Closed lifecycle needed for Sprint and Roadmap intelligence.

## 2. Can a read-only REST call work from this extension?

### 2.1 The origin question (the real decision)

Public reports of Azure DevOps REST calls failing with CORS `origin: null`
([Stack Overflow](https://stackoverflow.com/questions/79105217/i-want-to-detect-in-the-client-side-script-that-i-have-gotten-a-401-error-when-f),
[Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1166597/(solved)-web-request-from-azure-devops-server-exte))
come from pages served off a `null`/foreign origin (local files, sandboxed iframes,
separate web apps). Our case is different: this extension runs a **content script
injected into the live `dev.azure.com` page**, so a relative `fetch('/<org>/<project>/_apis/...')`
is **same-origin** and sends the user's existing session cookie automatically. No PAT,
no OAuth flow, no stored secret. _Content was rephrased for compliance with licensing
restrictions._

> Decision status: **plausible and the intended path, but NOT yet executed against a
> live tenant.** This document records the hypothesis and the exact test; the test must
> be run signed-in on a real board before any delivery module depends on the API. Until
> then, delivery modules must degrade to DOM + local snapshots.

### 2.2 Endpoints relevant to the delivery modules

Confirmed from official REST docs (api-version 7.1):

| Need | Endpoint | Notes |
|---|---|---|
| Single work item | `GET /{org}/{project}/_apis/wit/workitems/{id}?api-version=7.1` | Fields incl. `System.State`, `System.Tags`, `System.IterationPath` |
| Work item **as of a date** | `...workitems/{id}?asOf=2017-12-21T19:42:54Z&api-version=7.1` | Enables point-in-time snapshots |
| Field change history | `GET .../wit/workItems/{id}/updates` | State transitions, scope/field changes → History module |
| Revisions | `GET .../wit/workItems/{id}/revisions` | Full revision list |
| Batch read | `POST /{org}/{project}/_apis/wit/workitemsbatch?api-version=7.1` | Up to 200 ids per call — ideal for a board |
| Query by WIQL | `POST /{org}/{project}/_apis/wit/wiql?api-version=7.1` | Resolve ids for a sprint/area |
| Iterations (sprints) | `GET /{org}/{project}/{team}/_apis/work/teamsettings/iterations?api-version=7.1` | Period + path for Sprint Intelligence |
| Iteration work items | `GET .../teamsettings/iterations/{iterationId}/workitems?api-version=7.1` | Sprint scope |

Source: [Get Work Item](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-7.1)
and [REST API getting started](https://learn.microsoft.com/en-us/azure/devops/integrate/how-to/call-rest-api?view=azure-devops).
The `asOf` sample response and `workItemUpdates` / `workItemRevisions` `_links` are
shown directly in the Get Work Item reference. _Content was rephrased for compliance
with licensing restrictions._

### 2.3 Permissions impact

`manifest.json` already grants `host_permissions` for `https://dev.azure.com/*` and
`https://*.visualstudio.com/*`, so a same-origin `fetch` from the content script needs
**no manifest change**. No new broad permission is required for read-only API use.

## 3. Executable spike (must be run signed-in, not assumed)

Paste into the DevTools console **on an open Azure DevOps board tab** (same origin):

```js
// Read-only probe. Derives org/project from the current URL, counts as evidence only.
(async () => {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\//);
  if (!m) return console.warn('Not on an org/project URL');
  const [_, org, project] = m;
  const base = `/${org}/${project}/_apis`;
  const probe = async (label, url, init) => {
    try {
      const r = await fetch(url, { credentials: 'include', ...init });
      console.log(label, r.status, r.ok);
      return r.ok ? await r.json() : null;
    } catch (e) { console.warn(label, 'FAILED', e.message); return null; }
  };
  await probe('connectionData', `/${org}/_apis/connectionData?api-version=7.1`);
  await probe('iterations',
    `/${org}/${project}/_apis/work/teamsettings/iterations?api-version=7.1`);
  await probe('workitemsbatch',
    `${base}/wit/workitemsbatch?api-version=7.1`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [620906], fields: ['System.State','System.IterationPath'] }) });
})();
```

Record for each endpoint: HTTP status, whether `credentials: 'include'` was sufficient,
and whether any CSRF/`X-VSS` header was required. Capture results back into this file
under a new "Spike results" section with the date and tenant (no secrets, no tokens).

## 4. Data availability summary

| Capability | DOM today | REST (pending live test) |
|---|---|---|
| Live WIP count | ✅ | n/a (keep DOM) |
| Current state / column per id | ✅ | ✅ |
| Aging / target date | ✅ | ✅ (computed from fields) |
| Daily snapshot (column per id per day) | ✅ via local store | ✅ richer |
| Sprint period + goal + scope | ❌ | ✅ iterations API |
| % completion Approved→Closed | ❌ | ✅ (states over scope) |
| State-transition / scope-change history | ❌ | ✅ `/updates`, `asOf` |
| Epic/Feature → sprint links | ❌ | ✅ relations / WIQL |

**Conclusion:** DOM-only is sufficient for the first Daily Commitment increment and
must be the fallback everywhere. Sprint/Roadmap/History need the REST client, which is
architecturally viable at zero credential cost but is **gated on running the spike in
section 3 against a live, signed-in tenant** before any module depends on it.
