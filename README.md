# Life OS

A local-only personal workspace with Calendar, Finance, Compass and validated JSON backup/recovery. The eight MVP milestones are implemented; integrations, deployment and other deferred features are not included.

## Run Locally

Use a supported Node.js LTS release compatible with Vite (Node 24 LTS is a good default), with npm installed. Open the VS Code terminal in this workspace.

For a fresh checkout, install dependencies once:

```powershell
npm.cmd install
```

Start the app:

```powershell
npm.cmd run dev
```

Open http://localhost:5173. Leave the terminal running while using the app; press Ctrl+C in that terminal to stop it. Dependencies are already installed in the current workspace.

The `.cmd` suffix avoids PowerShell script-policy problems on Windows. On macOS/Linux, use `npm` instead of `npm.cmd`.

The development server deliberately uses a fixed port and stops with an error if it is occupied. Prefer stopping an earlier Life OS server rather than changing the URL. If another application needs that port, use `npm.cmd run dev -- --port 5174` and open http://localhost:5174, noting that this is a separate browser storage location.

## Working at This Checkpoint

- Exactly three navigation destinations: Calendar, Finance and Compass.
- Persistent desktop sidebar, compact mobile navigation, visible keyboard focus and a skip link.
- Calendar with a Monday-first monthly grid, previous/next/Today controls, monthly agenda and event creation, editing and confirmed deletion. Use **Add event** or a date in the grid; edit from an event preview or the agenda.
- Finance with monthly take-home income, category budgets, editable categories and expense creation, editing and confirmed deletion. Totals show allocated budgets, unallocated income, spending and remaining budget by category, with overallocation/overspending warnings.
- Compass includes an editable north star, tasks/goals/commitments/dreams, easy Active/Later/Done transitions, editable life areas, weekly settings, manual time logs and planned-versus-actual comparison. Only submitted edits are saved; text still being typed is a draft.
- A versioned data model for the planned features, validated before storage writes and after reads.
- Suggestion-only starter items in Later, with no deadlines or time estimates; no invented financial data or time logs. The editable explanation is an initial draft based on the stated context.
- The maker portfolio is an **outcome**, not a separate time allocation. Its facade and reservoir projects are activities. Outcomes cannot have weekly estimates; only Active activities contribute to planned time.
- Storage status, visible read/write errors and a retry action for failed saves. Unreadable or invalid saved data is preserved, never replaced with starter data.
- Shared **Backup & recovery** controls in every tab: versioned JSON export, validated import preview and explicit replacement confirmation. Unsaved session data and unreadable raw storage can also be downloaded when needed.
- Navigation keeps the selected tab in the URL fragment across reloads. Forms reset after a confirmed discard/restore, with labelled controls and useful keyboard focus.

There are exactly three navigation destinations. Backup controls are shared, not a fourth tab. All scheduling and time logging remain manual.

## Persistence and Limits

Data is saved as one JSON document under `lifeos:v1` in localStorage. Starter data is created only when the key is absent; deleted suggestions are not reintroduced. An empty financial month has no invented income or balance.

Storage is tied to the browser profile and exact origin (scheme, hostname and port). Refreshing or restarting the server at the same origin retains saved data. Another browser, device, private session, port or `127.0.0.1` instead of `localhost` uses different storage. Clearing site data removes it. Use one tab at a time: cross-tab synchronisation and conflict handling are deferred.

This is not encrypted storage and does not sync. JSON exports contain readable personal data; keep them somewhere you trust. Export regularly and before replacing data or clearing browser storage. There is no automatic backup, cloud copy or cross-tab conflict handling.

If saving fails, a visible **Not saved** warning appears above the workspace. The latest submitted changes remain in memory, but will not survive reload. Keep the page open, expand **Backup & recovery**, and choose **Export current session** before retrying or leaving. **Retry saving** clears the warning only after a successful write. The browser may also warn before leaving while a save has failed.

If startup data is unreadable, editing is blocked and the original bytes are left untouched. Download that unreadable data before restoring a valid backup or explicitly choosing **Start fresh**. Starting fresh requires confirmation and only changes the workspace after a successful storage write. No automatic reset occurs after invalid JSON, invalid records, unsupported versions or unavailable storage.

Money uses non-negative integer pennies and safe-integer sums. Time uses whole minutes; hours input is rounded to the nearest minute. Unset values remain distinct from zero. Dates are validated Gregorian `YYYY-MM-DD` strings, not UTC timestamps. Calendar uses UK date labels and Europe/London for Today; the browser's native date/time input appearance follows its own locale. Weekly estimates represent a current standing plan, not historical snapshots.

Calendar events are manual plans and never create actual time logs or change Compass estimates. Duration is 1 to 1440 whole minutes. Event times are entered as London wall-clock times; there is no UTC conversion, recurring-event engine or automatic scheduling. End times use nominal duration, with a next-day marker when crossing midnight. The agenda groups events by their start date, including overnight events. Around daylight-saving transitions, ambiguous/nonexistent local times are retained as entered; this is a planner, not an instant-based reminder system.

## Backup and Restore

1. Submit any open forms first. In any tab, expand **Backup & recovery** and choose **Export JSON** (or **Export current session** after a failed save).
2. Check your browser's Downloads list or save prompt. The filename includes schema version 1 and a UTC date/time, for example `lifeos-v1-2026-10-30T12-34-56-000Z.json`. **Download requested** does not mean the browser has finished saving the file; confirm it exists.
3. Keep the JSON file intact. It includes the north star, life areas, weekly settings, all Calendar events, all budget months/categories/expenses, all Compass items and all actual time logs. Submitted session edits are included even when localStorage saving failed. Unsubmitted form drafts and view filters are not included.
4. To restore, choose the JSON file under **Choose JSON backup**. Validation checks the supported version, record structure, unique IDs within each record list, genuine dates/times, enums, numeric bounds, safe sums and references. Unsupported or malformed files are rejected without changing current data.
5. Review the incoming north star, export date, version and record counts. Choose **Cancel import** to leave data untouched, or **Replace current data** and accept the explicit confirmation. Restore replaces everything, not a merge, including removal of records absent from the incoming backup.
6. Only a successful browser storage write replaces the current session and resets open editors. Cancelled or failed restores leave both previous browser data and session data unchanged. A failed restore shows an error; it never reports success.

For a safe restore test, open a **private/incognito browser window** at http://localhost:5173 and restore there. Its browser storage is separate from your normal window, so your main records are not replaced. Closing the private window usually removes that test copy; keep the exported file outside the browser.

For corrupt storage, **Download unreadable data** preserves the original text in a dated `.txt` file. This is a recovery copy, not a validated JSON backup. A valid JSON backup can then restore the app. **Start fresh** is a destructive last resort with its own confirmation; download the unreadable data first.

Imports are limited to 10 MB, and browser storage quotas may be lower. If a valid backup cannot be saved, free space/check browser permissions or use another browser profile and retry; existing data is not overwritten. Use one Life OS tab at a time.

## Finance Rules

- Start with no income, allocations or expenses entered. Starter category names are suggestions, not spending or balances. Existing saved data is never cleared when opening Finance.
- Income and allocations belong to the selected month; category names are shared across months. There is no automatic carryover or copying. Choose **Save monthly budget** to save income and allocations together; displayed totals reflect saved values, not unsaved inputs.
- Blank income is unset. Entering `0` records zero income; clearing the field and saving makes it unset again. A blank or zero allocation means no budget for that category; saving removes that allocation entry.
- Enter money without currency symbols or grouping commas, with up to two decimal places. Calculations and formatting use integer pennies, including safety checks on totals. Expenses must be positive; refunds/negative expenses are not supported today.
- Total allocated is the sum of category budgets. Unallocated income is income minus allocations, or **Income not set** when unset. Total spent comes from expenses dated in the selected month. Category remaining is its allocation minus its spending; negative amounts are shown, never clamped to zero.
- These are budgets, not bank balances. Allocating to Savings or New York does not represent a bank transfer, payment or existing balance.
- Editing an expense's date moves spending into the appropriate month; editing its category reallocates that spending. The view follows the saved expense's month. Expenses do not change income, allocations, Calendar or Compass.
- Renaming a category retains its ID and updates its name across every month and expense. To delete a category used anywhere, first clear its allocations in all months and remove or reassign its expenses. Unused categories and expenses require confirmation before deletion.

## Checks

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

The build includes TypeScript checking. The 29 tests cover foundation calculations/storage, Calendar dates/persistence, Finance totals/persistence, Compass planning/logging, and backup/recovery. Backup cases cover dated full-data round-trips, structure/version/ID/value/reference validation, unchanged storage on failure, and preserved unreadable bytes.

Disposable integrated-browser checks exercised generated export payloads through the file-input/preview/confirmation/restore path, cancelled and invalid imports, failed writes, session export/retry, corrupt recovery, selected-tab reloads, editor discards, keyboard focus and empty layouts at 320px, 375px and 1280px. Real browser data was not replaced. The embedded browser does not expose a download-completion notification to the test tool, so verify that the downloaded file actually reaches your Downloads folder manually.

## Manual Foundation Check

1. Open the local URL and navigate all three destinations. Calendar should show the current London month; Finance should show monthly budgets without invented financial amounts.
2. In Compass, expand **Edit north star**, change the direction and explanation, choose **Save direction**, and check for **Saved in this browser**.
3. Refresh, reopen Compass, and confirm both submitted edits remain. Restarting the server at the same URL should retain them too.
4. Choose **Later** in **View status** to see unactivated starter suggestions. They should have no invented hours or dates. The portfolio should be an outcome with no separate time allocation, while its two projects are activities.
5. Narrow the browser to phone width and use Tab/Enter to navigate and save. Check readable labels, visible focus, and no horizontal page overflow.

## Manual Calendar Check

1. Open Calendar and try previous month, next month and **Today**.
2. Choose **Add event** (or a day in the grid). Enter title, date, start time, duration and life area; optionally add notes, then **Save event**. Confirm it appears in the grid and agenda.
3. Use the event's pencil button in the agenda. Change the title/time/date, then save. Moving it to another month should open that month.
4. Refresh and navigate to the event's month if needed. Confirm all edits remain and your saved Compass direction is unchanged.
5. Use the event's bin button, confirm deletion and refresh. Check it is still gone. Cancelling deletion should keep it.

Scheduled events do not count as actual time logs.

## Manual Finance Check

1. Open Finance, choose a month, enter your take-home income and category allocations, then choose **Save monthly budget**. Blank income should show **Income not set**; entering and saving `0` should show zero instead.
2. Add/rename a category. Add an expense with amount, date, category and description. Check total spent and that category's remaining budget. Allocating above income or spending above a category budget should show clear warnings.
3. Edit the expense's category and confirm spending moves between categories. Change its date to another month; confirm spending disappears from the original month and appears in the new one.
4. Refresh, reopen Finance and select the relevant month. Confirm your budget and expense edits remain, and your Calendar and Compass data are unchanged.
5. Delete an expense: cancel once to keep it, then confirm to remove it. Unused categories can also be deleted; a category used in any month must be cleared or reassigned first.

## Compass Rules

- North star and explanation remain freely editable under **Edit north star**. New items default to Later. Choose a type and life area; due dates, estimates and notes are optional, so an undated dream is valid. Existing saved statuses and edits are preserved; starters are never automatically activated.
- **Active**, **Later** and **Done** are changed with each item's Status selector or its edit form. Later preserves an idea and any estimate without adding to the active plan; Done also stops contributing. Reactivating restores its contribution. Editing/adopting an item removes its starter-suggestion label.
- Weekly estimates count once for Active activities of every type. The maker portfolio remains an overarching outcome with no estimate field, so its project estimates are not counted twice. Active activities with blank estimates are listed explicitly and excluded from totals; an intentional zero estimate is not missing.
- Expand **Weekly settings** to set available hours outside work/essential needs and your maker-project target. Either may be blank (unset) or zero. The maker-project life area is a stable ID that can be intentionally changed in settings, independent of its display name. Hours accept up to two decimals, round to whole minutes and cannot exceed 168 per week.
- Warnings are arithmetic only: Active estimated minutes above your available time, or maker-project estimates below your chosen target. Unset settings do not act as zero or generate those warnings. Music, health and relationships are not scored or treated as distractions.
- **Week containing** accepts any date and selects its Monday-Sunday week, shown explicitly. **This week** uses London Today. Comparisons always use the **current standing weekly plan**, including for historical actuals; no historical plan snapshots are recorded.
- Actual time comes only from manually created logs. Enter a date, life area and 1 to 1440 whole minutes. Edit or confirm deletion using the log's actions. Moving a log's date changes its weekly totals and opens its new week. Calendar events never create logs or count as actual time.
- The comparison includes every life area, showing planned and actual time separately. Area renames retain IDs and update labels everywhere, including Calendar. An area cannot be deleted while referenced by any item (including Later/Done), calendar event, time log or maker-project setting; reassign those references first.
- Submit forms before leaving them or changing tabs; unfinished drafts are not persisted. Status changes save immediately. The selected week and filters are view controls, not saved planning history.

## Manual Compass Check

1. Edit and save the north star. Add a dream in Later with no due date or estimate. Confirm it remains visible under Later.
2. Activate a project, edit its weekly estimate, and check **Current planned time** updates. Move it to Later/Done and back to verify exclusion/reactivation. The portfolio outcome must not add another estimate.
3. Activate an item without an estimate and confirm it is listed under **Active without estimates**. Set available hours and maker target under **Weekly settings**; try a threshold that triggers each warning, and compare blank settings with zero.
4. Log actual time for a selected week. Edit its date/life area/duration, check the comparison moves the actuals correctly, then cancel/confirm deletion. Viewing a historical week should change actuals, not the current standing plan.
5. Rename a life area and check its item, Calendar and comparison labels retain their references. Refresh and verify direction, items, settings and logs persist; Calendar and Finance should remain unchanged.

## Five-Minute Acceptance Check

1. **Calendar:** add an event, edit it and refresh. Check it remains on the intended London date and the Calendar tab remains selected.
2. **Finance:** save your chosen income/allocations, add an expense and check allocated/spent/remaining totals. Refresh and verify the saved month data remains; changing an expense's date/category should move its spending.
3. **Compass:** capture an undated dream in Later, activate a project with an estimate, set weekly targets and log actual time. Check planned versus actual remains separate, missing estimates are visible and the portfolio outcome adds no extra estimate.
4. **Backup:** export JSON and confirm the dated file exists. In a separate private window, import it, inspect the summary and cancel once. Then import again and confirm replacement only in that test window; refresh and inspect all three tabs.
5. **Usability:** narrow the window, use Tab/Enter to navigate and edit, and check readable labels, visible focus, empty states and the browser-only storage disclosure. Close the private test window when finished; retain your backup file.
