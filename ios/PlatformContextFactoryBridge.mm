#include "PlatformContextFactory.h"

#include <memory>

#include "SkiaYoga.hpp"
#include "RNSkApplePlatformContext.h"
#include <React-callinvoker/ReactCommon/CallInvoker.h>

using margelo::nitro::RNSkiaYoga::SkiaYoga;

extern "C" void* SkiaYogaCreatePlatformContext(void* bridge, void* callInvokerSharedPtr) {
  auto* sharedPtr = static_cast<std::shared_ptr<facebook::react::CallInvoker>*>(callInvokerSharedPtr);
  if (!sharedPtr || !*sharedPtr) {
    return nullptr;
  }
    auto ctx = std::make_shared<RNSkia::RNSkApplePlatformContext>((__bridge RCTBridge*)bridge, *sharedPtr);
  SkiaYoga::platformContext = ctx; // store globally for C++ side
  return ctx.get();
}

extern "C" void SkiaYogaDestroyPlatformContext(void) {
  SkiaYoga::platformContext.reset();
}
