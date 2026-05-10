# Worker 034 tmux challenger: next-target recommendation

## Verdict

Keep the provisional top target, but define it narrowly as **example JS bundle feedback-loop hygiene**: add a repo-owned, bounded Expo export/bundle smoke command that writes to a temp directory and cleans up, and remove the repo-owned Metro config dump. This is the strongest next unblocked target because it turns the only currently working app-level feedback loop into a repeatable verifier before the repo attempts riskier product-source changes.

The strongest product-source follow-up is **RN Skia private import cleanup in `src/YogaCanvas.tsx`**, but I would rank it second unless the worker is explicitly allowed to accept JS-bundle-only validation for native ID allocation behavior.

## Evidence

- `example/metro.config.js:8-24` builds a custom Metro config, then `example/metro.config.js:26` prints the full object with `console.log(finalConfig)`. My live export reproduced the full config dump, including absolute local paths, before bundling.
- `package.json:34-48` has root checks for package surface, lifecycle, install isolation, archive discovery, YogaNode lifetime/runtime, lint, typecheck, and specs, but no script for the working Expo bundle/export smoke. `example/package.json:5-14` also has no bundle smoke script.
- Live command passed: `cd example && perl -e 'alarm shift; exec @ARGV' 180 bun --bun ./node_modules/.bin/expo export --platform ios --output-dir "$tmp" --no-bytecode --no-minify`; exit 0, bundled 1744 modules, then temp output was removed.
- `src/YogaCanvas.tsx:2` imports a private RN Skia declaration file, and `src/YogaCanvas.tsx:50-51` runtime-requires `@shopify/react-native-skia/src/views/SkiaViewNativeId`; `src/YogaCanvas.tsx:89` increments that private counter and `src/YogaCanvas.tsx:351` passes it as `nativeID`.
- Diagnostic resolution is fragile: `node -p "require.resolve('@shopify/react-native-skia/src/views/SkiaViewNativeId')"` failed with `MODULE_NOT_FOUND`, while `node -p "require.resolve('@shopify/react-native-skia/src/views/SkiaViewNativeId.ts')"` succeeded. The current Metro export succeeds because Metro resolves `ts` source extensions, not because this is a stable public package API.
- RN Skia currently publishes the underlying files: `node_modules/@shopify/react-native-skia/package.json:40-44` includes `src/**` and `lib/**`, and `node_modules/@shopify/react-native-skia/src/views/SkiaViewNativeId.ts:1` defines the counter. That lowers the immediate breakage priority but not the upgrade risk.
- Native ID semantics are real native behavior: `cpp/SkiaYoga.cpp:28-37` looks up `RNSkia::ViewRegistry` by native ID, iOS assigns the `nativeID` prop into Skia's native view at `ios/SkiaYogaView.mm:191-193` and `ios/SkiaYogaViewManager.mm:36-38`, and Android registers the native ID through `android/src/main/java/com/margelo/nitro/skiayoga/SkiaYogaView.java:78-82` and `android/src/main/cpp/jni/include/JniSkiaYogaView.h:65-66`.
- Platform-native verification is still blocked locally: `xcode-select -p` returns `/Library/Developer/CommandLineTools`; `xcodebuild -version` exits 1 because full Xcode is not selected; `pod`, `gradle`, `adb`, `cmake`, and `ninja` are not on `PATH`; `java -version` cannot locate a Java runtime.
- Worker 034 tmux evidence shows the worker ran the same JS-only export, observed the Metro dump, then stalled waiting on a managed nested challenger retry. That does not weaken the underlying command evidence.

## Ranking

1. **Example JS bundle feedback-loop hygiene / Metro config console cleanup.** This is fully unblocked, repo-owned, and directly improves maintainability of the verification matrix. It also reduces local-path disclosure in logs and prevents Metro config noise from obscuring real bundle failures. Performance/runtime behavior is unchanged.
2. **RN Skia private import cleanup in `YogaCanvas`.** This is more important product debt than the Metro `console.log`, but it is a second target because replacing the shared RN Skia ID counter risks collisions or registration drift in the native `ViewRegistry`. The current JS bundle passes, and full iOS/Android build-run validation is unavailable on this machine. A follow-up worker should remove the private imports only with an explicit native-ID strategy and should use the new bundle smoke as part of acceptance.
3. **`src/SkiaYogaObject.ts` product import side effects.** `src/SkiaYogaObject.ts:18` logs on import and `src/SkiaYogaObject.ts:24` writes `globalThis.SkiaYoga`. This is plausible hygiene/security debt, but `turboModule.install()` and Nitro initialization need a narrower audit before changing global exposure.
4. **Platform-native build/run verification.** Still blocked by local prerequisites, so it should not consume the next implementation slot.

## Quality, maintainability, performance, security

- Quality: a guarded Expo export catches JS/Metro integration failures that lint/typecheck/spec generation cannot.
- Maintainability: owning the command avoids relying on one-off temp shell commands and makes later `YogaCanvas` private-import work safer.
- Performance: removing `console.log(finalConfig)` only reduces command/log overhead; no app runtime path changes.
- Security: the Metro dump leaks absolute local paths and resolver internals into logs. This is low severity but easy to remove.
- Private-import risk remains: `YogaCanvas` depends on RN Skia internals and should be the next product-source cleanup after the bundle verifier exists.

## Final status captured

```text
## worker/034-next-root-cause-audit
?? worker-progress/worker-034-next-root-cause-audit-tmux-challenger.md
```
