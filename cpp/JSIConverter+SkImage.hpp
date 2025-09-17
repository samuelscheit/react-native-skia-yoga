#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>
#include <memory>

#include "PlatformContextAccessor.hpp"

#include <react-native-skia/cpp/api/JsiSkImage.h>

#include "SkImage.h"

namespace margelo::nitro {

using namespace facebook;

// C++ sk_sp<SkImage> <> JS RNSkia::JsiSkImage host object
// Allows bridging Skia images between JS and native Skia Yoga nodes.
template <>
struct JSIConverter<sk_sp<SkImage>> final {
  static inline sk_sp<SkImage> fromJSI(jsi::Runtime& runtime,
                                       const jsi::Value& arg) {
    if (arg.isNull() || arg.isUndefined()) {
      return nullptr;
    }

    if (!arg.isObject() || !arg.asObject(runtime).isHostObject(runtime)) {
      throw jsi::JSError(runtime,
                         "SkImage must be a host object (JsiSkImage) or null");
    }

    auto host = arg.asObject(runtime)
                    .asHostObject<RNSkia::JsiSkImage>(runtime);
    if (!host) {
      throw jsi::JSError(runtime,
                         "SkImage host object could not be resolved");
    }

    return host->getObject();
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime,
                                 const sk_sp<SkImage>& image) {
    if (!image) {
      return jsi::Value::null();
    }

    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    return jsi::Object::createFromHostObject(
        runtime, std::make_shared<RNSkia::JsiSkImage>(ctx, image));
  }

  static inline bool canConvert(jsi::Runtime& runtime,
                                const jsi::Value& value) {
    if (value.isNull() || value.isUndefined()) {
      return true;
    }
    if (!value.isObject()) {
      return false;
    }
    auto obj = value.getObject(runtime);
    if (!obj.isHostObject(runtime)) {
      return false;
    }
    auto host = obj.asHostObject<RNSkia::JsiSkImage>(runtime);
    return static_cast<bool>(host);
  }
};

} // namespace margelo::nitro
