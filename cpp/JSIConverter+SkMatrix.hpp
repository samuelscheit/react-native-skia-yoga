#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>
#include <memory>

// Keep include consistent with generated headers
#include "SkMatrix.h"
#include <react-native-skia/cpp/api/JsiSkMatrix.h>

namespace margelo::nitro {

using namespace facebook;

// C++ SkMatrix <> JS Array<number> (length 9 or 16)
template <>
struct JSIConverter<SkMatrix> final {
  static inline SkMatrix fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkMatrix must be an object/array");
    }

    jsi::Object obj = arg.asObject(runtime);

    // Support RNSkia host object `JsiSkMatrix`
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkMatrix>(runtime);
      if (host) {
        // Unwrap and return the underlying SkMatrix
        return *host->getObject();
      }
    }

    if (!obj.isArray(runtime)) {
      throw jsi::JSError(runtime, "SkMatrix must be a JS array of 9 or 16 numbers or a JsiSkMatrix host object");
    }

    auto array = obj.asArray(runtime);
    auto len = array.size(runtime);

    // 3x3 matrix in row-major order (Skia’s 3x3 form)
    if (len == 9) {
      auto m00 = array.getValueAtIndex(runtime, 0).asNumber();
      auto m01 = array.getValueAtIndex(runtime, 1).asNumber();
      auto m02 = array.getValueAtIndex(runtime, 2).asNumber();
      auto m10 = array.getValueAtIndex(runtime, 3).asNumber();
      auto m11 = array.getValueAtIndex(runtime, 4).asNumber();
      auto m12 = array.getValueAtIndex(runtime, 5).asNumber();
      auto m20 = array.getValueAtIndex(runtime, 6).asNumber();
      auto m21 = array.getValueAtIndex(runtime, 7).asNumber();
      auto m22 = array.getValueAtIndex(runtime, 8).asNumber();
      return SkMatrix::MakeAll(m00, m01, m02, m10, m11, m12, m20, m21, m22);
    }

    // 4x4 matrix (length 16) mapped to Skia's 3x3 (ignore Z components).
    // Mapping inspired by RNSkia’s JsiSkMatrix.getMatrix.
    if (len == 16) {
      auto m11 = array.getValueAtIndex(runtime, 0).asNumber();
      auto m12 = array.getValueAtIndex(runtime, 1).asNumber();
      auto m14 = array.getValueAtIndex(runtime, 3).asNumber();
      auto m21 = array.getValueAtIndex(runtime, 4).asNumber();
      auto m22 = array.getValueAtIndex(runtime, 5).asNumber();
      auto m24 = array.getValueAtIndex(runtime, 7).asNumber();
      auto m41 = array.getValueAtIndex(runtime, 12).asNumber();
      auto m42 = array.getValueAtIndex(runtime, 13).asNumber();
      auto m44 = array.getValueAtIndex(runtime, 15).asNumber();
      return SkMatrix::MakeAll(m11, m12, m14, m21, m22, m24, m41, m42, m44);
    }

    throw jsi::JSError(
        runtime,
        std::string("SkMatrix must be an array of length 9 or 16 (got ") +
            std::to_string(len) + ")");
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkMatrix& m) {
    jsi::Array values(runtime, 9);
    for (int i = 0; i < 9; i++) {
      values.setValueAtIndex(runtime, i, static_cast<double>(m.get(i)));
    }
    return values;
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
    if (value.isNull() || value.isUndefined()) {
      return nullptr;
    }

    if (!value.isObject()) {
      throw jsi::JSError(runtime, "SkMatrix must be an object/array");
    }

    jsi::Object obj = value.asObject(runtime);

    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkMatrix>(runtime);
      if (host) {
        return host->getObject();
      }
    }

    if (!obj.isArray(runtime)) {
      throw jsi::JSError(runtime, "SkMatrix must be a JS array of 9 or 16 numbers or a JsiSkMatrix host object");
    }

    auto matrix = JSIConverter<SkMatrix>::fromJSI(runtime, value);
    return std::make_shared<SkMatrix>(matrix);
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
