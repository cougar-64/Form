# Form

An offline-first iPhone workout tracker built with Expo, TypeScript, and SQLite.

## Milestone 1

Four-tab shell, light/dark appearance, a persisted weight-unit preference (pounds by default), and transactional, versioned database initialization. The remaining screens describe upcoming features; they do not contain sample personal data.

## Local development

Use Node 24 LTS, npm, and Xcode with iOS development tools installed.

Native builds also require CocoaPods (`brew install cocoapods`).

```sh
npm ci
npm run typecheck
npm test
npm run ios
```

`npm run ios` generates the native iOS project, installs native dependencies, builds for a simulator, and starts the development server. Generated `ios/`, dependencies, and build output are ignored rather than maintained as source.

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

Physical iPhone signing/installation, changing the preference through the interface across restarts/upgrades, VoiceOver/large-text interaction, and the full airplane-mode check remain pending. No physical iPhone was connected during implementation. CocoaPods was installed through Homebrew to enable the native build.

No workout schema or personal data is seeded yet. Future milestones add the builder, schedule, logging, backup/restore, calendar exceptions, nutrition, and progress in the approved order. Personal Goals and nutrition progress summaries are deferred.

The initial dependency audit reports three moderate advisories through Expo's fingerprint/minimatch build-tool dependency chain. npm's suggested automatic fix downgrades Expo to an older major; it has not been applied. Recheck compatible upstream fixes before release.

## AI attribution

After each file-changing task, append an entry to `AI-ATTRIBUTION.md` using the date, every changed/new project file, tool, requested task, and `Review: TODO`. The developer fills in the review line.
