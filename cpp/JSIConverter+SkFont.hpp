#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>
#include <memory>

#include "SkiaGlue.hpp"
#include <include/core/SkFont.h>
#include "JsiSkFont.h"

#include "PlatformContextAccessor.hpp"

namespace margelo::nitro {

using namespace facebook;

// C++ SkFont <> JS RNSkia::JsiSkFont host object
template <>
struct JSIConverter<SkFont> final {
  static inline SkFont fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkFont must be a host object (JsiSkFont)");
    }

    jsi::Object obj = arg.asObject(runtime);

    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkFont>(runtime);
      if (host) {
        auto fontPtr = host->getObject();
        if (fontPtr) {
          return *fontPtr;
        }
        return SkFont();
      }
    }

    throw jsi::JSError(
        runtime,
        "SkFont: unsupported JS value. Expected JsiSkFont host object.");
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkFont& font) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    return jsi::Object::createFromHostObject(
        runtime, std::make_shared<RNSkia::JsiSkFont>(ctx, font));
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (!obj.isHostObject(runtime)) return false;
    auto host = obj.asHostObject<RNSkia::JsiSkFont>(runtime);
    return static_cast<bool>(host);
  }
};

} // namespace margelo::nitro

