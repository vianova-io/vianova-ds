# Alerts page — UI spec

For Jimmy, to unblock the backend. The design is the `alerts-workspace` block:
[`apps/www/registry/vianova/blocks/alerts-workspace.tsx`](../apps/www/registry/vianova/blocks/alerts-workspace.tsx),
rendered at `/blocks/alerts-workspace` on the docs site. Where this document
and the block disagree, the block is right — it is the thing that runs.

Ships after 14 Dec, beside Regulations, one page per scope.

---

## 1. The boundary, because it is the whole design

| | Alert rule (this page) | Report rule (10 Dec, Regulations) |
|---|---|---|
| What it does | Sends an e-mail | Files a report with a lifecycle an operator works through |
| Where it is switched | This page | The `Create reports` switch on the regulation |
| Who it goes to | Report contacts, plus plain addresses | Report contacts |
| Editable here | Yes | **No** — listed read-only, badged *Files a report* |

The page carries that sentence at the bottom, under the list. Report rules are
in the list so there is one place to **see** everything that notifies people,
without moving where any of it is **set**. This is your proposal of 19 Nov
(point 2) taken as written.

## 2. Scope of v1

An alert watches **one no-parking rule**. Nothing else.

No threshold builder — no battery, no idle time, no fleet cap. Those datasets
exist and you confirmed on 19 Nov that they run, but a builder holding one data
source reads as a promise of the other nine. They are the obvious v2.

## 3. The model the UI assumes

```ts
type Alert = {
  id: string;
  kind: "alert" | "report";   // "report" rows are read-only
  name: string;
  regulationId: string;
  ruleId: string;             // see below
  breachHours: number;        // Munich: 2
  zoneIds: string[];          // [] = every zone in the rule
  vehicles: Vehicle[];        // [] = every type
  operators: string[];        // [] = every operator
  schedule: AlertSchedule;
  recipientIds: string[];     // ids into the report contacts list
  extraEmails: string[];      // addresses with no VIP account
  createdBy: string;
  createdAt: string;          // ISO 8601
  lastSentAt?: string;        // ISO 8601
  on: boolean;
};
```

### An alert points at a RULE, not a regulation

`reg-parking-baixa-chiado` holds a parking rule **and** a no-parking rule. The
one Munich cares about is the second. Keying an alert on the regulation makes
"No parking outside bays" unaddressable, so the API needs the rule id.

The rule picker lists every `no_parking` rule in the scope, labelled
`<regulation name> · <rule name>`, whatever kind of regulation holds it.

### Zones narrow, they never add

`zoneIds` is a **subset of the rule's own zones**. An alert cannot create a
zone, so the Library / Draw / Import panel from Regulations is **not** reused
here — its job is the opposite one. The editor shows the rule's zones as a
checkbox list with the same thumbnails, and `[]` means all of them.

This is a deliberate departure from Katell's prototype, where `+ Add zones`
opened the full picker. Flagged in §8.

## 4. The list

Columns: **Name** · Sent to · When · Last sent · On.

- The name links into the editor. Under it, a derived one-line summary of the
  rule, never stored and never editable: *"When a scooter or moped breaks No
  parking outside bays for more than 2 hours, in any of its zones."*
- **Sent to** shows the first recipient and `+N`, with the author under it.
- **On** is a switch for alert rows; for report rows it is a static badge with
  a tooltip naming the regulation where the switch lives.
- Filter: search by name, and All / On / Off. Multi-select deletes, and report
  rows cannot be ticked — a Delete that silently skipped half the selection is
  worse than one that cannot select them.
- Sorted newest first.

**From the backend:** `lastSentAt` is the one field you flagged as uncertain on
19 Nov (point 6). If it cannot be served, the column shows "Never" everywhere
and should be dropped rather than left lying.

## 5. The editor

One screen. Sections top to bottom, with the e-mail preview sticky beside them
from `lg` up and below them under it.

**The ask box** sits above the form, not on a page of its own — that two-page
GenAI flow is the thing the 26 Nov call named as the bug. Suggestions are chips
that fill the ask field; Generate then fills the form. It is deliberately the
*second* path: four pickers is not much to fill in, and dictating a sentence to
fill them is slower than filling them. In the block the parsing is faked, as in
your own prototype; the real one is VIA-1071.

1. **What to watch** — the rule, and *only when it lasts longer than* N hours.
2. **Where** — all of the rule's zones, or some.
3. **Filters** — vehicles and operators, each "all" unless named.
4. **When to send** — §6.
5. **Recipients** — §7.

Saving uses the house `SaveBar`: always present, says *All changes saved* when
clean. A new alert is dirty from the start.

## 6. Schedule

Four modes, no cron ever shown:

| Mode | Label the user sees | Semantics |
|---|---|---|
| `hourly` | Every hour, new cases only | The hourly check; only vehicles not already sent |
| `daily` | Every day at HH:MM | One e-mail, whole list |
| `weekly` | Every <weekday> at HH:MM | One e-mail, whole list |
| `monthly` | The 1st of the month at HH:MM | One e-mail, whole list |

- **"As soon as it happens" is not offered.** The data is checked once an hour,
  so it would be a lie. Your wording from 19 Nov, kept.
- Hours offered are **06:00–20:00** only, from Katell's prototype.
- The hour is read in the **scope's time zone** and labelled "Munich time" —
  never UTC, never the reader's clock, never `UTC+1 (Europe/Brussels)`. Worth
  switching Munich's scope to `Europe/Berlin` so the name reads right.
- Monthly is the 1st only, because that is all the backend offers.
- **Daily cap** (hourly mode only): *stop after N e-mails a day, starting again
  tomorrow*. **N is a placeholder — `DEFAULT_DAILY_CAP = 10` in the block.** The
  number was unreadable in the prototype capture and nobody has confirmed it.
  Confirm or kill it.

## 7. Recipients

**One list.** The Recipients tab reads and edits the scope's report contacts
(Settings › Report contacts) — your point 4 of 19 Nov, taken as written. Plain
e-mail addresses stay possible for ordinary alerts and live in `extraEmails`.

The editor field is a chip input with type-ahead over contacts, plus:

- **Copy from another alert** — from the 26 Nov call.
- A typed address with an `@` becomes a plain recipient.

The Recipients tab exists for one job Katell named as the painful one: people
change constantly, mostly at the operators, and today a swap is one alert at a
time in Streamlit. So the row action is **Replace**, which takes someone off
every alert they are on and puts someone else on the same ones, in one call.
Remove is the destructive sibling, not the main verb.

**From the backend:** a replace-across-alerts endpoint, or the UI has to fan
out N updates and cannot report a partial failure honestly.

## 8. Open questions

| # | Question | Who |
|---|---|---|
| 1 | Daily cap: real? what number? | Jimmy |
| 2 | `lastSentAt`: can you serve it? | Jimmy |
| 3 | Replace-across-alerts: one call or N? | Jimmy |
| 4 | Zones narrow rather than add — OK? It departs from the prototype | Katell |
| 5 | Hours 06:00–20:00 rather than all 24 — deliberate? | Katell |
| 6 | `Create alert` button on the Regulations page: this PR leaves it out | Katell |
| 7 | Permissions: who may edit or delete someone else's alert? Nothing in the material covers it | Katell |
| 8 | Delivery failure: is there a state for an e-mail that did not arrive? | Jimmy |

## 9. States the block already draws

- **Loading** — skeleton rows.
- **Error** — "We could not load your alerts. The alerts themselves are still
  running. This is the list that failed to load." with Try again.
- **Empty, two kinds** — "No alerts match these filters" (with a way out) and
  "No alerts yet" (with Create alert). Showing the wrong one sends people
  looking for a filter that is not set.
- **A rule with no zones** — tells you to add them in Regulations, because an
  alert cannot.
- **Deleted alert opened by URL** — "This alert no longer exists".

## 10. Out of v1, on purpose

- Threshold conditions on any dataset.
- Editing report rules here.
- Drawing or importing a zone from an alert — it writes to the shared zone
  library and you said it earns its own ticket right after v1.
- Redesigning the e-mail. The preview is a frame around the one we send today,
  down to the attached `records.csv`: your point 5 of 19 Nov.
- A per-alert delivery log.
