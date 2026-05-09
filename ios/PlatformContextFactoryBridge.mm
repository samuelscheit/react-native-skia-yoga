#include "PlatformContextFactory.h"

#include <memory>

#include "PlatformContextAccessor.hpp"
#include "RNSkApplePlatformContext.h"
#include <React-callinvoker/ReactCommon/CallInvoker.h>

extern "C" void* SkiaYogaCreatePlatformContext(void* bridge, void* callInvokerSharedPtr) {
  auto* sharedPtr = static_cast<std::shared_ptr<facebook::react::CallInvoker>*>(callInvokerSharedPtr);
  if (!sharedPtr || !*sharedPtr) {
    return nullptr;
  }
  auto ctx = std::make_shared<RNSkia::RNSkApplePlatformContext>((__bridge RCTBridge*)bridge, *sharedPtr);
  margelo::nitro::RNSkiaYoga::SetPlatformContext(ctx);
  return ctx.get();
}

extern "C" void SkiaYogaDestroyPlatformContext(void) {
  margelo::nitro::RNSkiaYoga::ClearPlatformContext();
}
