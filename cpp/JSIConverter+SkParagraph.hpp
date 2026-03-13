#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>
#include <memory>

#include "SkiaGlue.hpp"
#include "JsiSkParagraph.h"

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<std::shared_ptr<RNSkia::JsiSkParagraph>> final {
  static inline std::shared_ptr<RNSkia::JsiSkParagraph> fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    if (arg.isNull() || arg.isUndefined()) {
      return nullptr;
    }
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkParagraph must be a JsiSkParagraph host object");
    }

    auto object = arg.asObject(runtime);
    return object.getHostObject<RNSkia::JsiSkParagraph>(runtime);
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const std::shared_ptr<RNSkia::JsiSkParagraph>& arg) {
    if (!arg) {
      return jsi::Value::null();
    }
    return jsi::Object::createFromHostObject(runtime, arg);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isNull() || value.isUndefined()) {
      return true;
    }
    if (!value.isObject()) {
      return false;
    }
    auto object = value.getObject(runtime);
    return object.isHostObject(runtime) &&
           static_cast<bool>(object.asHostObject<RNSkia::JsiSkParagraph>(runtime));
  }
};

} // namespace margelo::nitro
