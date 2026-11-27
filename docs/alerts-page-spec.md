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

The tool's band carries its name and **Create alert**. Under it, two tabs with
counts — **Alerts** and **Recipients** — the way Feeds draws *Your feeds* and
*Catalogue*.

Columns, as in Katell's prototype: **Name** · Created by · Created · Sent to ·
Last sent · On.

- The name links into the editor.
- **Created by** is the shared creator cell every workspace list uses: a mark,
  the name, and the address under it. The platform's own rows get a square
  mark and no address.
- **Created** and **Last sent** are ages — *Just now*, *3 h ago*, *3 d ago* —
  and the date itself once it is more than a week old. The exact day and time,
  on the scope's clock, is on hover. An alert that has never sent says *Never
  sent*.
- **Sent to** shows the names themselves while there are one or two, then the
  first name and a **+ N more** chip. A name opens that recipient, in Recipients;
  the chip opens the whole list for that alert, with *Open the alert* in its
  footer. An address with no VIP account is shown as text, not a link.
- **On** is a switch for alert rows; for report rows it is a static badge with
  a tooltip naming the regulation where the switch lives.
- Filter: search, and All / On / Off.
- **Tick boxes are off until asked for.** A small toggle at the end of the
  toolbar brings them in, with a bulk Delete; releasing it takes them away
  again. An alert is switched off far more often than it is deleted, and the
  switch is on the row. Every workspace list works this way.
- Sorted newest first.

**From the backend:** `lastSentAt` is the one field you flagged as uncertain on
19 Nov (point 6). If it cannot be served, the column shows "Never" everywhere
and should be dropped rather than left lying.

## 5. The editor

The editor **is a sentence**, and every part you can change is a word you can
press:

> When **a scooter or moped** from **any operator** stays in **any zone** of
> **No parking outside bays** for more than **2 hours**, e-mail **Anja Reiter
> and 2 others** **every day at 08:00**.

Seven slots, each opening its own picker:

| Slot | Field | Picker |
|---|---|---|
| a scooter or moped | `vehicles` | checklist, "Any vehicle" on top |
| any operator | `operators` | checklist, "Any operator" on top |
| any zone | `zoneIds` | the rule's zones with thumbnails |
| No parking outside bays | `ruleId` | every no-parking rule, regulation named under it |
| 2 hours | `breachHours` | a number, with 1 / 2 / 4 / 8 / 24 |
| Anja Reiter and 2 others | `recipientIds` + `extraEmails` | §7 |
| every day at 08:00 | `schedule` | §6 |

There is no form beside the sentence saying the same thing in fields, so
nothing can disagree with it. It is your layout B of 18 Nov, without the
parsing step: the sentence is built, not typed and then read back.

One line under it carries what the words cannot — for hourly, *"Only vehicles
you have not been told about yet, and never more than 10 e-mails a day"*; for a
summary, *"One e-mail with the whole list. The hour is Munich time."*

**A report rule opens as the same sentence with nothing pressable**, ending
*"…file a report and e-mail…"*, under a banner that says where it is set.

**The ask field** sits under the sentence on a new alert, not on a page of its
own — that two-page GenAI flow is the thing the 26 Nov call named as the bug.
Suggestions are chips that fill the field; Generate then fills the sentence. It
is deliberately the *second* path: seven words to press is not much, and
describing them is slower than pressing them. In the block the parsing is
faked, as in your own prototype; the real one is VIA-1071.

The e-mail preview sits beside the sentence from `lg` up, and under it below.
The alert's name is the band's title, edited in place. Saving uses the house
`SaveBar`: always present, *All changes saved* when clean; a new alert is dirty
from the start.

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

The recipients slot opens a chip input with type-ahead over contacts. While
nothing is typed, the list under it is the other alerts — **copy from another
alert** (26 Nov call) is one press, not a dialog. A typed address with an `@`
becomes a plain recipient.

### The Recipients tab

As in Katell's prototype. Two columns — **Recipient** and **Gets these
alerts** — with a search, an All / Members / Operators filter, and **Add
recipient** in the band.

- A recipient is a name over an address, or a bare address with an operator
  chip when there is no person behind it (*Set up by Vianova* under the ones
  the scope came with). *Invited* marks a member who has not signed in yet.
- **A name opens that recipient.** First name and last name (both optional),
  e-mail, type (Member / Operator), operator, and the alerts they get as chips
  with a search to add more.
- **Changing the address is how someone is replaced.** People change
  constantly, mostly at the operators, and today a swap is one alert at a time
  in Streamlit. Here the address is edited once and every alert they were on
  follows. There is no separate Replace action.
- **A VIP user of the organisation is locked**: name and e-mail come from the
  Members page, so the dialog only chooses their alerts and offers no Delete.
- **Add recipient** is the same dialog, empty. A new member gets a read-only
  invitation to VIP. **Paste many e-mails** in its footer takes a pasted list
  or a CSV — commas, semicolons and new lines all separate,
  `Name <address>` keeps the name — with *Also add them to* one alert. The
  button counts what will be added, and addresses already on the list are
  skipped and said to be.
- **Bulk Delete matters most here**: people leave in groups. The tick boxes
  are behind the same toolbar toggle as on the alerts list.
- A name in the alerts list's *Sent to* column, or in its *+ N more* dialog,
  opens that recipient here.

**From the backend:** editing a contact's address must carry their alert
memberships, and saving a recipient sets their memberships across N alerts in
one call — or the UI fans out N updates and cannot report a partial failure
honestly. Report rules are not offered in *Gets these alerts*: who they tell is
set on the regulation.

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
