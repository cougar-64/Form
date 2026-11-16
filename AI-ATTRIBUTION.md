2026-11-11: package.json (new file), .gitignore (new file), app.json (new file), tsconfig.json (new file), expo-env.d.ts (new file), AI-ATTRIBUTION.md (new file)
 - Tool: Codex (apply_patch, exec_command)
 - Task: Begin approved milestone 1 by creating Form's Expo and TypeScript configuration. Record all file changes with AI attribution.
 - Review: Configuration complete.

2026-11-11: package.json, app.json, tsconfig.json, package-lock.json (new file), AGENTS.md (new file), README.md (new file), src/data/migrations.ts (new file), src/data/settings.ts (new file), src/ui/Screen.tsx (new file), src/ui/WeightPreference.tsx (new file), src/app/_layout.tsx (new file), src/app/(tabs)/_layout.tsx (new file), src/app/(tabs)/index.tsx (new file), src/app/(tabs)/calendar.tsx (new file), src/app/(tabs)/nutrition.tsx (new file), src/app/(tabs)/progress.tsx (new file), tests/migrations.test.ts (new file), AI-ATTRIBUTION.md
 - Tool: Codex (apply_patch, exec_command)
 - Task: Implement approved milestone 1 with four-tab navigation, local SQLite initialization and migrations, a persistent weight preference, migration tests, and local iPhone build instructions. Preserve the user's AI attribution requirement for future file-changing tasks.
 - Review: SQLite initialized through migration.ts. app, data, and ui directories created.

2026-11-12: src/data/migrations.ts, src/data/workouts.ts (new file), src/ui/Screen.tsx, src/ui/Fields.tsx (new file), src/app/_layout.tsx, src/app/(tabs)/calendar.tsx, src/app/(tabs)/index.tsx, src/app/workout/[weekday].tsx (new file), tests/sqlite.ts (new file), tests/workouts.test.ts (new file), .expo/types/router.d.ts, README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Implement approved milestone 2: an editable weekday workout builder with an exercise catalog, custom exercises, planned sets/reps, optional weights, warmup instructions, and independent saved routine revisions. Add migration and integrity checks, refresh generated route types, and document the simulator-first development and review workflow.
• Review: TODO

2026-11-12: README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Add workout routine sharing to the later-version roadmap as a v2/v3 candidate, outside v1, with the exact scope and sharing method deferred.
• Review: TODO

2026-11-13: src/data/migrations.ts, src/data/dates.ts (new file), src/data/schedule.ts (new file), src/data/workouts.ts, src/ui/useLocalToday.ts (new file), src/ui/DatedWorkout.tsx (new file), src/app/templates.tsx (new file), src/app/plan/[date].tsx (new file), src/app/(tabs)/calendar.tsx, src/app/(tabs)/index.tsx, src/app/_layout.tsx, src/app/workout/[weekday].tsx, tests/dates.test.ts (new file), tests/schedule.test.ts (new file), package.json, package-lock.json, .expo/types/router.d.ts, README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Implement approved milestone 3 with a repeating dated weekly calendar, local schedule start, effective-dated routine rules, preserved past plans, and today's planned workout on Home. Add recurrence/upgrade/date-boundary tests, correct Expo Router navigation-context and discard-guard integration found during native validation, and document the simulator review workflow.
• Review: TODO

2026-11-13: src/app/(tabs)/index.tsx, src/app/(tabs)/_layout.tsx, src/app/_layout.tsx, src/app/settings.tsx (new file), src/ui/Screen.tsx, src/ui/Fields.tsx, src/ui/DatedWorkout.tsx, .expo/types/router.d.ts, README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Simplify Home to today's planned workout with centered text, remove weekly shortcuts, and relocate weight-unit preferences to Settings accessible from My Progress. Keep colors, logos, and broader visual design deferred to milestone 9.
• Review: TODO

2026-11-13: src/data/migrations.ts, src/data/schedule.ts, src/data/sessions.ts (new file), src/app/(tabs)/index.tsx, src/app/(tabs)/calendar.tsx, src/app/_layout.tsx, src/app/plan/[date].tsx, src/app/log/[id].tsx (new file), src/app/session/[id].tsx (new file), src/ui/DatedWorkout.tsx, src/ui/Fields.tsx, src/ui/Performance.tsx (new file), src/ui/SessionWorkout.tsx (new file), tests/schedule.test.ts, tests/sessions.test.ts (new file), .expo/types/router.d.ts, README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Implement approved milestone 4 with explicit Start/Finish, preserved session plans and start dates, actual per-set logging/editing, recoverable separate drafts, previous performance, and session-only additional exercises. Add upgrade/integrity/recovery tests, expose recorded workouts through Calendar, and document simulator review and verification.
• Review: TODO

2026-11-13: src/ui/ExerciseSetTable.tsx (new file), src/ui/useSetEntries.ts (new file), src/ui/setEntryQueue.ts (new file), src/ui/usePendingSetGuard.ts (new file), src/ui/SessionWorkout.tsx, src/ui/Performance.tsx, src/app/log/[id].tsx, src/app/session/[id].tsx, src/app/(tabs)/index.tsx, src/data/sessions.ts, tests/sessions.test.ts, README.md, AI-ATTRIBUTION.md
• Tool: Codex (apply_patch, exec_command)
• Task: Replace the confusing logging panels with compact inline exercise tables containing previous performance, set number, editable weight and editable reps, with one Save sets action per exercise. Preserve recoverable edits and existing logging rules, support unperformed blank slots without losing set numbers, and verify shared-write sequencing and the native layout.
• Review: TODO
