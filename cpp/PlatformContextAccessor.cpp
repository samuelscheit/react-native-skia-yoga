#include "PlatformContextAccessor.hpp"

namespace margelo::nitro::RNSkiaYoga {

namespace {
  // Backing storage, avoids including SkiaYoga.hpp here
  std::shared_ptr<RNSkia::RNSkPlatformContext> g_platformContext;
}

std::shared_ptr<RNSkia::RNSkPlatformContext> GetPlatformContext() { return g_platformContext; }
void SetPlatformContext(std::shared_ptr<RNSkia::RNSkPlatformContext> ctx) { g_platformContext = std::move(ctx); }

} // namespace margelo::nitro::RNSkiaYoga

