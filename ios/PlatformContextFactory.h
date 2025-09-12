#pragma once

// Thin C ABI for creating/destroying the shared RNSkApplePlatformContext from Objective-C++ code
// without pulling the heavy Skia/React Native headers into multiple translation units.
// We purposely use only void* in the signature to avoid including Objective-C headers here.

#ifdef __cplusplus
extern "C" {
#endif

// Creates (or recreates) the global platform context and returns the raw pointer.
// Parameters:
//   bridge                - (RCTBridge*) passed as void*
//   callInvokerSharedPtr  - (std::shared_ptr<facebook::react::CallInvoker>*) passed as void*
// Returns:
//   RNSkia::RNSkApplePlatformContext* as void* (cast on the caller side)
void* SkiaYogaCreatePlatformContext(void* bridge, void* callInvokerSharedPtr);

// Resets the stored shared_ptr and clears the global platform context reference.
void SkiaYogaDestroyPlatformContext(void);

#ifdef __cplusplus
} // extern "C"
#endif
