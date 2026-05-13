#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <include/core/SkPaint.h>
#include <jsi/jsi.h>
#include <array>
#include <cmath>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>

#include "SkiaGlue.hpp"
#include "Drawings.h"

namespace margelo::nitro {

using namespace facebook;

namespace {

[[noreturn]] inline void throwInvalidNumericStrokeValue(
    const char* propertyPath) {
  throw std::invalid_argument(
      std::string("Invalid numeric stroke value for ") + propertyPath +
      ": expected a finite native float.");
}

inline bool isValidNativeStrokeFloat(double value) {
  return std::isfinite(value) &&
      std::abs(value) <=
          static_cast<double>(std::numeric_limits<float>::max());
}

inline std::optional<float> getOptionalNativeStrokeFloatProperty(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const char* propertyPath) {
  const auto value = object.getProperty(runtime, key);
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }
  const auto number = value.asNumber();
  if (!isValidNativeStrokeFloat(number)) {
    throwInvalidNumericStrokeValue(propertyPath);
  }
  return static_cast<float>(number);
}

inline std::optional<float> getOptionalNativeStrokeFloatPropertyWithAlias(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* publicKey,
    const char* aliasKey,
    const char* publicPropertyPath,
    const char* aliasPropertyPath) {
  if (object.hasProperty(runtime, publicKey)) {
    return getOptionalNativeStrokeFloatProperty(
        runtime,
        object,
        publicKey,
        publicPropertyPath);
  }
  return getOptionalNativeStrokeFloatProperty(
      runtime,
      object,
      aliasKey,
      aliasPropertyPath);
}

inline std::string invalidNumericStrokeEnumMessage(
    const char* propertyPath,
    const char* validValues) {
  return std::string("Invalid numeric enum value for ") + propertyPath +
      ": expected a finite integer in " + validValues + ".";
}

template <typename T, size_t N>
inline std::optional<T> parseOptionalStrokeNumericEnum(
    const jsi::Value& value,
    const char* propertyPath,
    const std::array<T, N>& validValues,
    const char* validValueDescription) {
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }

  const auto number = value.asNumber();
  if (!std::isfinite(number) || std::trunc(number) != number) {
    throw std::invalid_argument(
        invalidNumericStrokeEnumMessage(propertyPath, validValueDescription));
  }

  for (const auto validValue : validValues) {
    if (number == static_cast<double>(static_cast<int>(validValue))) {
      return validValue;
    }
  }

  throw std::invalid_argument(
      invalidNumericStrokeEnumMessage(propertyPath, validValueDescription));
}

inline std::optional<SkPaint::Join> getOptionalStrokeJoin(
    jsi::Runtime& runtime,
    const jsi::Object& object) {
  const auto value = object.getProperty(runtime, "join");
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }
  if (value.isNumber()) {
    return parseOptionalStrokeNumericEnum<SkPaint::Join>(
        value,
        "stroke.join",
        std::array<SkPaint::Join, 3> {
            SkPaint::Join::kMiter_Join,
            SkPaint::Join::kRound_Join,
            SkPaint::Join::kBevel_Join,
        },
        "[0, 1, 2]");
  }

  if (value.isString()) {
    auto join = value.asString(runtime).utf8(runtime);
    if (join == "miter") {
      return SkPaint::Join::kMiter_Join;
    }
    if (join == "round") {
      return SkPaint::Join::kRound_Join;
    }
    if (join == "bevel") {
      return SkPaint::Join::kBevel_Join;
    }
    throw std::invalid_argument("Invalid stroke join: " + join);
  }

  throw std::invalid_argument("Invalid stroke join.");
}

inline std::optional<SkPaint::Cap> getOptionalStrokeCap(
    jsi::Runtime& runtime,
    const jsi::Object& object) {
  const auto value = object.getProperty(runtime, "cap");
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }
  if (value.isNumber()) {
    return parseOptionalStrokeNumericEnum<SkPaint::Cap>(
        value,
        "stroke.cap",
        std::array<SkPaint::Cap, 3> {
            SkPaint::Cap::kButt_Cap,
            SkPaint::Cap::kRound_Cap,
            SkPaint::Cap::kSquare_Cap,
        },
        "[0, 1, 2]");
  }

  if (value.isString()) {
    auto cap = value.asString(runtime).utf8(runtime);
    if (cap == "butt") {
      return SkPaint::Cap::kButt_Cap;
    }
    if (cap == "round") {
      return SkPaint::Cap::kRound_Cap;
    }
    if (cap == "square") {
      return SkPaint::Cap::kSquare_Cap;
    }
    throw std::invalid_argument("Invalid stroke cap: " + cap);
  }

  throw std::invalid_argument("Invalid stroke cap.");
}

} // namespace

template <>
struct JSIConverter<RNSkia::StrokeOpts> final {
  static inline RNSkia::StrokeOpts fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw std::runtime_error("Invalid prop value for StrokeOpts received");
    }

    const auto object = arg.asObject(runtime);
    RNSkia::StrokeOpts opts;
    opts.width = getOptionalNativeStrokeFloatProperty(
        runtime,
        object,
        "width",
        "stroke.width");
    opts.miter_limit = getOptionalNativeStrokeFloatPropertyWithAlias(
        runtime,
        object,
        "miter_limit",
        "miterLimit",
        "stroke.miter_limit",
        "stroke.miterLimit");
    opts.precision = getOptionalNativeStrokeFloatProperty(
        runtime,
        object,
        "precision",
        "stroke.precision");
    opts.join = getOptionalStrokeJoin(runtime, object);
    opts.cap = getOptionalStrokeCap(runtime, object);
    return opts;
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const RNSkia::StrokeOpts& arg) {
    jsi::Object obj(runtime);
    if (arg.width.has_value()) {
      obj.setProperty(runtime, "width", arg.width.value());
    }
    if (arg.miter_limit.has_value()) {
      obj.setProperty(runtime, "miter_limit", arg.miter_limit.value());
    }
    if (arg.precision.has_value()) {
      obj.setProperty(runtime, "precision", arg.precision.value());
    }
    if (arg.join.has_value()) {
      obj.setProperty(runtime, "join", static_cast<double>(arg.join.value()));
    }
    if (arg.cap.has_value()) {
      obj.setProperty(runtime, "cap", static_cast<double>(arg.cap.value()));
    }
    return obj;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject();
  }
};

} // namespace margelo::nitro
