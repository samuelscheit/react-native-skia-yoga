#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
// Skia headers
#include <include/core/SkPaint.h>
#include "JsiSkPaint.h"

// Access platform context without including SkiaYoga.hpp to avoid include cycles
#include "PlatformContextAccessor.hpp"

namespace margelo::nitro {

using namespace facebook;

// C++ SkPaint <> JS RNSkia::JsiSkPaint host object
template <>
struct JSIConverter<SkPaint> final {
  static inline SkPaint fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkPaint must be a host object (JsiSkPaint)");
    }
    jsi::Object obj = arg.asObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkPaint>(runtime);
      if (host) {
        return *host->getObject();
      }
    }
    throw jsi::JSError(runtime, "SkPaint: unsupported JS value. Expected JsiSkPaint host object.");
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkPaint& paint) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    return jsi::Object::createFromHostObject(
        runtime, std::make_shared<RNSkia::JsiSkPaint>(ctx, SkPaint(paint)));
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (!obj.isHostObject(runtime)) return false;
    auto host = obj.asHostObject<RNSkia::JsiSkPaint>(runtime);
    return static_cast<bool>(host);
  }
};

} // namespace margelo::nitro
