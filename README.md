# Form

An offline-first iPhone workout tracker built with Expo, TypeScript, and SQLite.

## Milestone 1

Four-tab shell, light/dark appearance, a persisted weight-unit preference (pounds by default), and transactional, versioned database initialization.

## Milestone 2 — workout builder

Use **Edit weekly templates** from Calendar to open the weekday template list. Monday through Saturday begin unconfigured; Sunday begins as rest. Each day has an independent workout, even when names repeat.

The builder supports workout/rest selection, a name, optional informational warmups, exercise search, custom exercise creation, planned sets, reps or rep ranges, optional weights and units, exercise removal, and reordering. The small starter library makes no training recommendations. New planned sets, reps, and weights are blank until entered. Dumbbells use weight per hand; bars use total load; machines use the displayed setting; bodyweight exercises do not require a load. Separate machine or exercise variations should use distinct names.

Saving a weekday atomically creates a new routine revision and changes only that weekday's current pointer. Older revisions remain intact. Stale edits are rejected rather than overwriting a newer save. Planned values never create actual lifts or personal records. Dated occurrences are introduced in milestone 3 below; recurrence exceptions, workout logging and records remain later milestones.

Custom exercise creation saves the library entry immediately and adds it to the current workout draft. Discarding that workout draft does not delete the library entry. Workout drafts are held in memory: leaving prompts before discarding, but terminating the app can lose unsaved edits. Saved plans persist across restarts.

Builder review checklist:

- Create Monday's Push workout and a different Thursday Push workout; edit Monday and confirm Thursday is unchanged.
- Add a library exercise and a custom dumbbell exercise; enter sets, a rep range such as `8-12`, and an optional fractional weight.
- Add a bodyweight exercise; confirm no external load is required.
- Reorder and remove exercises, save, reopen the editor, and restart the app to verify persistence and order.
- Try blank names, zero sets, reversed rep ranges, negative weights, and duplicate custom names; confirm clear validation.
- Try leaving with unsaved edits; keep editing or explicitly discard. Sunday can be changed from rest to a workout and back.
- Review with larger text, the keyboard open, VoiceOver, and dark appearance.

Milestone 2 verification: all eight automated tests and TypeScript checking pass; the production iOS bundle exports and the final native Release build succeeds. In an isolated iPhone 17 Pro simulator, native initialization upgraded a version 1 fixture to version 2, retained kilograms, and created seven weekday slots. Interactive builder entry, keyboard/discard dialogs, and accessibility still need the owner's simulator review. Existing simulators and the physical iPhone were not modified for these checks.

## Milestone 3 — repeating weekly calendar

Calendar shows dated Monday–Sunday weeks with Previous week, This week, and Next week controls. Each date opens its planned routine and exercises. Home shows today's local date, routine, muscle groups, warmup instructions, planned sets/reps, and optional weights with loading conventions.

Home is limited to today's plan (or a rest/unplanned state), with centered headings and text. Weekly shortcuts and unit controls are not shown there. Weight-unit preferences are available through **My Progress → Settings** in the navigation header; existing saved preferences are preserved. Other screens retain their usual text alignment. Colors, logo, and broader visual design remain in milestone 9.

The repeating schedule begins on the device's local date when the upgraded app first initializes. Version 2 templates and preferences are preserved. Earlier dates show **Before schedule began** and do not create occurrences or missed-workout flags. An unconfigured weekday is distinct from an explicit rest day. The app refreshes today's date when focused, when foregrounded, and periodically while open.

Schema version 3 stores effective-dated weekday rules separately from unique dated occurrences and immutable routine revisions. Rules reconstruct historical plans even for past dates that were never opened. Reading a week creates occurrences on demand with stable IDs. Template saves from today onward atomically update the rule and already-created upcoming occurrences for only that weekday; past plans retain their prior revisions. Calendar date arithmetic uses date-only values, avoiding UTC conversion and daylight-saving offsets in day assignment.

There are no sessions yet: these views do not claim a past workout was completed or skipped. Logging arrives in milestone 4, including freezing the started session's planned context against later same-day edits. One-off edits, moves/swaps, skipped decisions, attention actions, and backfilling stay in milestone 6.

Navigation hooks, theming, and the unsaved-edit guard use Expo Router's own exports so they share its navigation context. The unused external React Navigation dependency was removed. This also corrects a startup/navigation failure exposed by the native calendar check. See the [Expo Router SDK 58 migration guide](https://docs.expo.dev/router/migrate/sdk-57-to-58/) for the updated removal-prevention API.

Calendar review checklist (fully reload Form after this schema change):

- Confirm your saved templates and weight preference remain after upgrading.
- Build a weekday template and check its next occurrence in Calendar; inspect its full dated plan.
- Navigate several weeks forward and backward; weekdays must stay Monday–Sunday, including across New Year.
- Confirm Sunday repeats as rest unless edited, and unconfigured days say **Not planned yet**.
- Open a week before the schedule start; verify earlier dates say **Before schedule began**.
- Edit a template, confirm upcoming occurrences change and other weekdays remain independent, then reopen to check persistence.
- On later days, verify earlier dated plans retain their original exercises after a template edit.

Milestone 3 verification: all 17 automated tests and TypeScript checking pass, the production iOS bundle exports, and the final native Release build succeeds. A fresh native upgrade of an isolated version 2 fixture reached version 3, retained its custom routine and kilograms, set the local schedule start date, and created today's dated occurrence. Home was visually checked with the routine, warmups, rep range, and per-hand weight displayed. Interactive week navigation, template/discard actions, and accessibility remain owner-review checks.

## Local development

Use Node 24 LTS, npm, and Xcode with iOS development tools installed.

Native builds also require CocoaPods (`brew install cocoapods`).

```sh
npm ci
npm run typecheck
npm test
npm exec -- expo prebuild --platform ios
open ios/Form.xcworkspace
```

On a fresh checkout, prebuild generates the native project and installs native dependencies. In Xcode choose the Form scheme and an **iPhone simulator**, then Run. Xcode 27 uses Device Hub for simulated devices. Generated `ios/`, dependencies, and build output are ignored rather than maintained as source.

For everyday sessions, start `npm start -- --localhost` in WebStorm's terminal, leave it running, then launch Form from Xcode with a simulator destination. If the development client needs a server address, use `http://localhost:8081` (or the port printed in the terminal). Do not press `i` or use `npm run ios` in this workflow: Xcode launches the simulator, avoiding WebStorm-to-System Events automation. The physical iPhone stays disconnected with Developer Mode off. Stop the app and server and close the tools between sessions; saved simulator data remains unless the app or simulator is deleted/reset.

`npm run ios` remains available as an alternative CLI launcher, but simulator launch may request Automation permissions. No such permission is needed for the Xcode-first workflow. Ordinary TypeScript changes use Fast Refresh; database migration changes require a full app reload so initialization runs again. Newly added routes get their TypeScript declarations from Expo when the development server starts.

After the milestone 3 dependency/import change, restart the server with `npm start -- --localhost --clear`, then stop/run Form in Xcode using your simulator. This clears cached navigation modules and reruns database initialization.

For a physical iPhone, enable Developer Mode, connect and trust it, add your Apple Account in Xcode, then use `npm run ios:device`. Signing may require selecting your Personal Team in the generated Xcode project. The bundle identifier is `com.samuelbird.form`; change it in `app.json` before first installation if it is unavailable.

Free Personal Team signing expires after seven days. Rebuild/reinstall rather than deleting the app: deletion removes local data. Installation and signing must be verified on your phone before relying on Form.

For gym/offline checks use `npm run ios:release`. This builds with bundled JavaScript rather than relying on Metro. Development builds use `npm start` for live editing; they are not the offline acceptance build.

## Persistence and verification

`src/data/migrations.ts` initializes `form.db` through `expo-sqlite`. Initialization runs before screens open. Each schema upgrade must be transactional, preserve existing data, and advance `PRAGMA user_version`. A newer unsupported schema is rejected without resetting it.

Tests exercise the production migration SQL against Node's real SQLite engine, covering file reopen, repeated migration, forward-version rejection, and rollback. They do not replace testing Expo SQLite on an iPhone.

Device acceptance checklist:

- Open each of the four tabs with large text and VoiceOver; check light and dark appearance.
- Change pounds to kilograms, force-close, and reopen; confirm kilograms remains selected.
- Install an updated build over the existing installation; confirm the preference remains.
- Open a Release build in airplane mode with the laptop disconnected.
- Restore pounds after verification if preferred.

Verified during milestone 1: TypeScript checking; three SQLite migration tests; production iOS JavaScript export; native Release compilation and launch on an iPhone 17 Pro simulator running iOS 26.5. The running native app created schema version 1 and loaded the default pounds preference. The native verification project and build artifacts were generated in temporary storage outside this repository.

The owner subsequently confirmed that all four tabs opened on the physical iPhone and the weight preference survived closing/reopening. The phone app was then deleted and Developer Mode switched off. Further work uses the simulator by default. VoiceOver/large-text interaction, preference persistence across app upgrades, and the full airplane-mode check remain pending. CocoaPods was installed through Homebrew to enable the native build.

Schema version 2 adds the exercise catalog, weekday templates, immutable saved routine revisions, and their planned exercises. It preserves the version 1 weight preference. Schema version 3 adds the calendar as described above. Tests cover independent same-name weekdays, retained revision contents, stale edit rejection, failed-save rollback, custom identity, rep ranges, loading conventions, units, file reopen, invalid input, schedule upgrades, recurrence, historical reconstruction, and timezone/date boundaries. Future milestones add logging, backup/restore, calendar exceptions, nutrition, and progress in the approved order. Personal Goals and nutrition progress summaries are deferred.

The initial dependency audit reports three moderate advisories through Expo's fingerprint/minimatch build-tool dependency chain. npm's suggested automatic fix downgrades Expo to an older major; it has not been applied. Recheck compatible upstream fixes before release.

## Later-version roadmap

- **Routine sharing (v2/v3 candidate):** Share a planned workout routine with another person. Define the sharing format, whether recipients can import an editable copy, and how custom exercises are included before implementation. Keep personal workout history, records, nutrition, and body measurements out of routine-sharing content. The release version and delivery method remain undecided; this is outside v1.

## AI attribution

After each file-changing task, append an entry to `AI-ATTRIBUTION.md` using the date, every changed/new project file, tool, requested task, and `Review: TODO`. The developer fills in the review line.
