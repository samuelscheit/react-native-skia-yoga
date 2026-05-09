#include "PlatformContextAccessor.hpp"

namespace margelo::nitro::RNSkiaYoga {

namespace {
std::shared_ptr<RNSkia::RNSkPlatformContext>& platformContextStorage()
{
  static std::shared_ptr<RNSkia::RNSkPlatformContext> platformContext;
  return platformContext;
}
}

std::shared_ptr<RNSkia::RNSkPlatformContext> GetPlatformContext()
{
  return platformContextStorage();
}

void SetPlatformContext(std::shared_ptr<RNSkia::RNSkPlatformContext> ctx)
{
  platformContextStorage() = std::move(ctx);
}

void ClearPlatformContext()
{
  platformContextStorage().reset();
}

} // namespace margelo::nitro::RNSkiaYoga
