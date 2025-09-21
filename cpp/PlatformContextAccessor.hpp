#pragma once

#include <memory>

// Forward declare the base Skia Platform Context to avoid heavy includes
namespace RNSkia { class RNSkPlatformContext; }

namespace margelo::nitro::RNSkiaYoga {

// Minimal accessor to retrieve/set the global platform context without including SkiaYoga.hpp
std::shared_ptr<RNSkia::RNSkPlatformContext> GetPlatformContext();
void SetPlatformContext(std::shared_ptr<RNSkia::RNSkPlatformContext> ctx);

} // namespace margelo::nitro::RNSkiaYoga

