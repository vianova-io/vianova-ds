# Alerts page — UI spec

For Jimmy, to unblock the backend. The design is the `alerts-workspace` block:
[`apps/www/registry/vianova/blocks/alerts-workspace.tsx`](../apps/www/registry/vianova/blocks/alerts-workspace.tsx),
rendered at `/blocks/alerts-workspace` on the docs site. Where this document
and the block disagree, the block is right — it is the thing that runs.

Ships after 14 Dec, beside Regulations, one page per scope.

---

## 1. What changed on 27 Nov

The first version of this page watched no-parking rules only and edited an
alert as a sentence. It now follows Katell's prototype of 26 Nov screen for
screen, with everything from the call of 26 Nov and her DM added:

- Five things to watch, each one number against one measure.
- **Create alert** asks first and suggests on the same screen.
- The editor is a panel of settings beside the e-mail.
- Zones use the Regulations panel as it is: Library, Draw and Import.
- A repeat is set the way a Gmail event is.
- A no-parking alert starts on its rule, in Regulations, and is handled here.

## 2. Two kinds of row

| | Alert | Reported device |
|---|---|---|
| Made | Here, with **Create alert** | By the **Alerts** switch on a no-parking rule, in Regulations |
| What it does | Sends an e-mail | Files a reported device with its lifecycle, and sends the e-mail |
| What it watches | Chosen here | The rule: its zones, its vehicles, 2 hours. Changed on the rule |
| Recipients, on/off | Here | **Here** |
| Deleted | Here | By turning the switch off on the rule |

The switch on the rule is the one staging calls *Create reports*; Katell asked
for it to read **Alerts** (DM, 26 Nov). The Regulations block in this PR has
it: a row on every no-parking rule, a confirmation when it is turned on, an
*Alerts* badge in the Regulations list, and *Manage in Alerts*. It takes
effect at once, without the regulation's Save.

- **It is only drawn for scopes that have both the Alerts tool and the
  Reported devices tool** (call of 26 Nov). The host works that out and
  passes it as the `alerts` prop.
- **The rows follow the switches.** A rule whose switch is on has a Reported
  device row on the Alerts page; switching it off, or deleting the rule,
  removes the row. A row that already exists keeps its recipients and its
  on/off. A new one starts with every operator's mailbox as its recipients.

## 3. The model the UI assumes

```ts
type WatchType = "battery" | "idle" | "available" | "cap" | "parked" | "no_parking";

type Alert = {
  id: string;
  kind: "alert" | "report";   // "report" = made by a rule, badged Reported device
  name: string;
  watch: WatchType;
  threshold: number;          // %, hours or vehicles, by watch
  regulationId?: string;      // no_parking only
  ruleId?: string;            // no_parking only
  zoneIds: string[];          // [] = the whole scope
  vehicles: Vehicle[];        // [] = every type
  operators: string[];        // [] = every operator
  filters?: FilterGroup;      // conditions on other columns, §5; absent = none
  schedule: AlertSchedule;    // §6
  recipientIds: string[];     // ids into the recipients list
  extraEmails: string[];      // addresses with no VIP account
  createdBy: string;
  createdAt: string;          // ISO 8601
  lastSentAt?: string;        // ISO 8601
  sentLastWeek?: number;      // e-mails in the last 7 days
  on: boolean;
};
```

What each watch needs, kept in the frontend as you suggested on 19 Nov:

| `watch` | In the list | Field label | Unit | Starts at | Step | Data |
|---|---|---|---|---|---|---|
| `battery` | Low battery | Battery below | % | 20 | 5 | live vehicle positions |
| `idle` | Idle vehicles | Not moved for more than | hours | 72 | 12 | live vehicle positions |
| `available` | Too few available | Fewer available than | vehicles | 5 | 5 | fleet availability, every hour |
| `cap` | Above the cap | More vehicles than | vehicles | 2000 | 100 | fleet availability, every hour |
| `parked` | Parked too long | Parked longer than | hours | 24 | 1 | live vehicle positions |
| `no_parking` | not offered; made on the rule | In the zone for more than | hours | 2 | 1 | regulations and live positions |

The block takes a `watchable` list. A measure or a suggestion whose data the
scope lacks cannot be picked, and the page says which data is missing:

- In **Create alert**, under the suggestions: *2 more suggestions need data
  Munich does not send yet: fleet availability.*
- In **What to watch**, the measure stays in the list, greyed: *Above the cap
  · no fleet availability data yet*.
- Asked for in a sentence: *Munich does not send fleet availability yet, so
  this cannot be watched.*

The columns Filters offers, by data:

| Data | Columns |
|---|---|
| Live vehicle positions | Status, Propulsion, Battery level (%), Idle time (h), Vehicle id |
| Fleet availability | Available vehicles, Deployed vehicles, Hour of the day, Day (weekday / weekend) |

Vehicle type and operator are columns too; they keep their own pickers.

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
- **On** is a switch on every row, a rule's alert included.
- **A bin at the end of every row** deletes that alert, after a confirmation.
  A rule's alert has none: it goes when its switch does, on the rule.
- A row made by a rule carries a **Reported device** badge under its name.
- Filter: search, and All / On / Off.
- **A settings menu at the end of the toolbar**, the same one every workspace
  list has. It turns **Select rows** on (tick boxes, with a bulk Delete),
  hides and shows **columns** (Name and On always stay), and switches
  **dates** between ages and the day and time. A dot on the button says the
  view is not as it opens; *Reset view* puts it back.
- Tick boxes are off until asked for: an alert is switched off far more often
  than it is deleted, and the switch is on the row.
- Sorted newest first.

**From the backend:** `lastSentAt` is the one field you flagged as uncertain on
19 Nov (point 6). If it cannot be served, the column shows "Never" everywhere
and should be dropped rather than left lying.

## 5. Create, and the editor

### Create alert

One dialog: *Say what you want to hear about. You can change everything next.*

- A text box with **Generate** inside it. Enter sends.
- **Suggestions** under it, with a search. Pressing one writes it into the
  box and stops there, so the words can be changed before Generate.
- **Start from scratch** and **Cancel** in the footer.
- Generate opens the editor on a draft, under *Drafted from your sentence.
  Check it.*
- Asking for a no-parking or regulation alert answers *No-parking alerts are
  switched on from the rule itself, in Regulations.* Asking about a silent
  feed answers that the feed status e-mails already cover it.

In the block the reading is faked, as in your prototype; the real one is
VIA-1071. Ask and suggestions share a screen because the two-page GenAI flow
is what the 26 Nov call named as the thing to fix.

### The editor

The alert's name is the band's title, edited in place. A new alert names
itself from its settings until someone types a name. Below the band, from
`lg` up, a 420 px panel on the left and the e-mail on the right; under `lg`
the e-mail follows the panel.

The panel, top to bottom:

1. **On / Off**, *by <creator>*, and *sent N times in the last 7 days*. A new
   alert shows *Draft · by you*.
2. **What to watch**, with *Uses <data>.* under it.
3. **The number**, with a step either side (§3 for labels and steps).
   Changing what is watched resets it to that measure's starting value.
4. **Summary**: *You'll get an e-mail when scooters fall below 15 % battery in
   the whole scope, every hour, new vehicles only.* Built from the fields, so
   it cannot disagree with them.
5. Five sections that fold, each saying what it holds when closed:

| Section | Closed, it says | Open |
|---|---|---|
| Zones | *whole scope* / *2 zones* | The chosen zones with thumbnails, and **Add zones** |
| Filters | *scooters, all operators + 1 more* | Vehicle types and operators, several of each; then **Add a filter** on any other column of the data (§3), with the house filter builder. The conditions read back in the Summary. Changing what is watched to different data clears them |
| Schedule | *Hourly, new vehicles only* | §6 |
| Recipients | *3 recipients* | §7 |
| Advanced | *the query behind it* | The request as JSON, read-only |

6. Footer: **Delete** · **Cancel** · **Create alert** / **Save changes**. Save
   is off until there is a recipient and every filter is finished, and says
   which.

**Add zones** swaps the panel for the Regulations zone panel, unchanged —
Library, Draw, Import — and the e-mail for a map showing what is chosen. A
zone drawn or imported here is saved to the zone library. No zone means the
whole scope.

**The e-mail** is the one sent today: *[Vianova] Alert was triggered: <name>*,
`records.csv` attached, *N records triggered the alert.* and the first rows.
Over it: *If it ran now, this e-mail would list 12 vehicles.*

**From the backend:** that count is the alert API's preview count. In the
block it is an estimate that only moves the right way.

**A Reported device alert** opens in the same panel with the rule in place of
*What to watch* and the number, the rule's zones listed and not editable, no
Vehicles section, the schedule stated (hourly, each vehicle once), and
Recipients and the switch editable. *Open the regulation* is offered when the
host can take you there.

## 6. Schedule

Two choices, each a card with its settings inside. No cron is ever shown.

**Hourly** — *As soon as we have the data: checked every hour, each vehicle
sent once.*

- A tick box: **Stop after N e-mails a day**. Off by default; N starts at 5,
  as in Katell's prototype. *To avoid too many e-mails. It starts again the
  next day.*
- "As soon as it happens" is not offered. Your wording from 19 Nov, kept.

**Repeat** — *One e-mail with the full list of matching vehicles.*

- A short list: **Daily**, **Weekly**, **Monthly, on the 1st**, **Custom…**,
  then *at* an hour.
- Weekly shows the seven days as round toggles. More than one can be on.
- **Custom…** opens Gmail's custom recurrence, the benchmark Katell posted on
  26 Nov: *Repeat every N days / weeks / months*, *Repeat on* for weeks, *On
  day* 1–28 for months, and *Ends*: never, on a date, or after N e-mails.
- Hours offered are **06:00–20:00**, from Katell's prototype.
- The hour is read in the **scope's time zone** and labelled "Munich time".

```ts
type AlertSchedule = {
  mode: "hourly" | "repeat";
  dailyCap?: number;                    // hourly; absent = no cap
  every?: number;                       // repeat; default 1
  unit?: "day" | "week" | "month";
  weekdays?: Weekday[];                 // week
  monthDay?: number;                    // month, 1–28
  hour?: string;                        // "HH:mm", scope time
  ends?: { kind: "never" } | { kind: "on"; date: string } | { kind: "after"; count: number };
};
```

**From the backend:** on 19 Nov you said the scheduler does every hour, every
day, every week and every month, and nothing finer. Several weekdays, every N
and an end date are new. See §8.

## 7. Recipients

**One list.** The Recipients tab reads and edits the scope's report contacts
(Settings › Report contacts) — your point 4 of 19 Nov, taken as written. Plain
e-mail addresses stay possible and live in `extraEmails`.

In the editor, four ways in, all ending in the same chips:

- **Type a name or e-mail**: it completes from the list, members and
  operators both. A full address that is not on the list is added as it is.
- **Add an operator e-mail**: the operators' mailboxes, in a list.
- **Copy from another alert**: its people are added to this one.
- **Paste many e-mails**: a pasted list or a CSV. It counts the new
  addresses, the ones already on the alert and the unreadable ones before
  anything is added.

**Manage recipients** goes to the Recipients tab.

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
  are behind *Select rows* in the same settings menu as on the alerts list.
- A name in the alerts list's *Sent to* column, or in its *+ N more* dialog,
  opens that recipient here.

**From the backend:** editing a contact's address must carry their alert
memberships, and saving a recipient sets their memberships across N alerts in
one call — or the UI fans out N updates and cannot report a partial failure
honestly. A rule's alert is offered in *Gets these alerts* like any other.

## 8. Open questions

| # | Question | Who |
|---|---|---|
| 1 | Repeat: can the scheduler do several weekdays, every N, a day of the month other than the 1st, and an end? If not, which of them do we drop from Custom? | Jimmy |
| 2 | Daily cap: is it real? The prototype has it optional, starting at 5 | Jimmy |
| 3 | `lastSentAt` and `sentLastWeek`: can you serve both? | Jimmy |
| 4 | The preview count: is the alert API's the one to call on every change? | Jimmy |
| 5 | Replace-across-alerts: one call or N? | Jimmy |
| 6 | A rule's alert: are its recipients the same list as Settings › Report contacts, edited from both places? | Jimmy |
| 7 | Vehicles and operators take several values here; the prototype took one. OK? | Katell |
| 11 | Filters: the column lists in §3 are my reading of the MDS feed and the availability table. Which columns can the alert query really filter on? | Jimmy |
| 8 | Hours 06:00–20:00 rather than all 24 — deliberate? | Katell |
| 9 | Permissions: who may edit or delete someone else's alert? | Katell |
| 10 | Delivery failure: is there a state for an e-mail that did not arrive? | Jimmy |

## 9. States the block already draws

- **Loading** — skeleton rows.
- **Error** — "We could not load your alerts. The alerts themselves are still
  running. This is the list that failed to load." with Try again.
- **Empty, two kinds** — "No alerts match these filters" (with a way out) and
  "No alerts yet" (with Create alert). Showing the wrong one sends people
  looking for a filter that is not set.
- **Deleted alert opened by URL** — "This alert no longer exists".

## 10. Out, on purpose

- "Regulation broken" and "Data stopped" in *What to watch*. The first is the
  switch on the rule; the second is the feed status e-mails.
- Type icons in the list. The name already says what an alert watches.
- Redesigning the e-mail. The preview is a frame around the one we send today,
  down to the attached `records.csv`: your point 5 of 19 Nov.
- A per-alert delivery log.
- A phone layout for drawing a zone. Below `lg` the map follows the panel.
