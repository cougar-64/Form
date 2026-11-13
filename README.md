# Form

An offline-first iPhone workout tracker built with Expo, TypeScript, and SQLite.

## Milestone 1

Four-tab shell, light/dark appearance, a persisted weight-unit preference (pounds by default), and transactional, versioned database initialization.

## Milestone 2 — workout builder

Home's **Plan your week** action and the Calendar tab open the weekday template list. Monday through Saturday begin unconfigured; Sunday begins as rest. Each day has an independent workout, even when names repeat.

The builder supports workout/rest selection, a name, optional informational warmups, exercise search, custom exercise creation, planned sets, reps or rep ranges, optional weights and units, exercise removal, and reordering. The small starter library makes no training recommendations. New planned sets, reps, and weights are blank until entered. Dumbbells use weight per hand; bars use total load; machines use the displayed setting; bodyweight exercises do not require a load. Separate machine or exercise variations should use distinct names.

Saving a weekday atomically creates a new routine revision and changes only that weekday's current pointer. Older revisions remain intact. Stale edits are rejected rather than overwriting a newer save. Planned values never create actual lifts or personal records. Dated occurrences, recurrence exceptions, workout logging and records remain later milestones.

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

Schema version 2 adds the exercise catalog, weekday templates, immutable saved routine revisions, and their planned exercises. It preserves the version 1 weight preference. Tests additionally cover independent same-name weekdays, retained revision contents, stale edit rejection, failed-save rollback, custom identity, rep ranges, loading conventions, units, file reopen, and invalid input. Future milestones add dated scheduling, logging, backup/restore, calendar exceptions, nutrition, and progress in the approved order. Personal Goals and nutrition progress summaries are deferred.

The initial dependency audit reports three moderate advisories through Expo's fingerprint/minimatch build-tool dependency chain. npm's suggested automatic fix downgrades Expo to an older major; it has not been applied. Recheck compatible upstream fixes before release.

## Later-version roadmap

- **Routine sharing (v2/v3 candidate):** Share a planned workout routine with another person. Define the sharing format, whether recipients can import an editable copy, and how custom exercises are included before implementation. Keep personal workout history, records, nutrition, and body measurements out of routine-sharing content. The release version and delivery method remain undecided; this is outside v1.

## AI attribution

After each file-changing task, append an entry to `AI-ATTRIBUTION.md` using the date, every changed/new project file, tool, requested task, and `Review: TODO`. The developer fills in the review line.
