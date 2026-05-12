# React Native Skia Yoga Worker Brief

This file is for workers. `ORCHESTRATOR.md` is for the orchestrator role only.

## Mission

Build `react-native-skia-yoga` into a React Native C++ library that combines
Yoga layout with Skia rendering for declarative, complex, animated, and
interactive UI.

Breaking changes are acceptable when they remove root causes instead of
preserving weak contracts.

## Worker Rules

- Work only on your assigned objective and write scope.
- You are running as a managed Codex subagent launched by the orchestrator with
  `goal: true`. The orchestrator creates worker goal state during launch; do
  not perform, check, or report separate goal lifecycle steps. Your final
  response and progress report must end with `Goal finished.`
- The orchestrator did not start a tmux/Codex subprocess for you. Treat tmux,
  `.codex.log`, `.exitcode`, and process-status references in older reports or
  prompts as archival history, not current worker lifecycle requirements.
- Use the assigned git worktree path from your prompt for all reads, edits, and
  verification commands. Do not edit the root checkout or another worker's
  worktree unless the prompt explicitly assigns that location.
- Your files may overlap with other active workers when the orchestrator chose
  parallelism. Do not revert or overwrite other workers; make your change
  internally coherent and document overlap risks for the orchestrator.
- Record durable progress and final evidence in
  `worker-progress/<worker-id>.md`.
- The orchestrator monitors your lifecycle through subagent status, progress
  messages, and your progress report. There is no tmux pane, `.codex.log`,
  `.exitcode`, or numeric process status for subagent workers.
- You may spawn managed Codex subagents, explorers, nested agents, or parallel
  agent tools inside this worker when useful for hypothesis testing or
  verification. Summarize delegated checks that affect your conclusions.
- Worker-internal nested agents do not count against the orchestrator's
  30-top-level-worker cap.
- Plan and research before implementing.
- Find root causes; do not patch symptoms.
- Separate proven behavior from proof boundaries and overclaim risks.
- Regenerable artifacts such as `node_modules/`, `example/node_modules/`,
  generated example native folders, `lib/`, and `tsconfig.tsbuildinfo` do not
  need cleanup merely because they exist. Remove or document them only if they
  are stale, ambiguous, user-owned, or diff-polluting.
- Do not take over orchestration, worker assignment, merge policy, or
  project-wide planning unless your task explicitly asks for a recommendation.

## Handoff Requirements

Before finishing, review your work for quality, maintainability, performance,
and security implications.

Your final report must include:

- Summary
- Changed files
- Commands run
- Evidence gathered
- Proof boundary and overclaim risks
- Cleanup status
- Recommended next tasks

The last line of the report must be exactly:

`Goal finished.`
