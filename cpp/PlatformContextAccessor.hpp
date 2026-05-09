#pragma once

#include <memory>

// Forward declare the base Skia Platform Context to avoid heavy includes
namespace RNSkia { class RNSkPlatformContext; }

namespace margelo::nitro::RNSkiaYoga {

// Shared store for the installed native platform context used by non-view C++ paths.
std::shared_ptr<RNSkia::RNSkPlatformContext> GetPlatformContext();
void SetPlatformContext(std::shared_ptr<RNSkia::RNSkPlatformContext> ctx);
void ClearPlatformContext();

} // namespace margelo::nitro::RNSkiaYoga
