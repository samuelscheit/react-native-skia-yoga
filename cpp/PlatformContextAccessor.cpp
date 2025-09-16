#include "PlatformContextAccessor.hpp"
#include "SkiaYoga.hpp"

namespace margelo::nitro::RNSkiaYoga {

std::shared_ptr<RNSkia::RNSkPlatformContext> GetPlatformContext() {
  return SkiaYoga::getPlatformContext();
}

} // namespace margelo::nitro::RNSkiaYoga

