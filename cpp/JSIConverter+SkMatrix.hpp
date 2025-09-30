#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>
#include <memory>

#include "SkiaGlue.hpp"
// Keep include consistent with generated headers
#include <include/core/SkMatrix.h>
#include "JsiSkMatrix.h"
#include "PlatformContextAccessor.hpp"

namespace margelo::nitro {

using namespace facebook;

// C++ SkMatrix <> JS Array<number> (length 9 or 16)
template <>
struct JSIConverter<SkMatrix> final {
  static inline SkMatrix fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    std::shared_ptr<SkMatrix> matrix = RNSkia::JsiSkMatrix::fromValue(runtime, arg);

    if (!matrix) {
      throw jsi::JSError(runtime, "Matrix host object is null");
    }

    return *matrix;
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkMatrix& m) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    auto host = std::make_shared<RNSkia::JsiSkMatrix>(ctx, m);
    return jsi::Object::createFromHostObject(runtime, host);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkMatrix>(runtime);
      if (host) return true;
    }
    if (!obj.isArray(runtime)) return false;
    auto array = obj.asArray(runtime);
    auto len = array.size(runtime);
    return len == 9 || len == 16;
  }
};

template <>
struct JSIConverter<std::shared_ptr<SkMatrix>> final {
  static inline std::shared_ptr<SkMatrix> fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return RNSkia::JsiSkMatrix::fromValue(runtime, value);
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::shared_ptr<SkMatrix>& matrix) {
    if (!matrix) {
      return jsi::Value::null();
    }
    return JSIConverter<SkMatrix>::toJSI(runtime, *matrix);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isNull() || value.isUndefined()) {
      return true;
    }
    if (!value.isObject()) {
      return false;
    }

    jsi::Object obj = value.asObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkMatrix>(runtime);
      if (host) {
        return true;
      }
    }
    if (!obj.isArray(runtime)) {
      return false;
    }
    auto array = obj.asArray(runtime);
    auto len = array.size(runtime);
    return len == 9 || len == 16;
  }
};

} // namespace margelo::nitro
