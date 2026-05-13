#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <include/core/SkPaint.h>
#include <jsi/jsi.h>
#include <cmath>
#include <optional>
#include <stdexcept>
#include <string>

#include "SkiaGlue.hpp"
#include "Drawings.h"

namespace margelo::nitro {

using namespace facebook;

namespace {

inline std::optional<float> getOptionalFloatProperty(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const char* propertyPath) {
  const auto value = object.getProperty(runtime, key);
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }
  const auto number = value.asNumber();
  const auto narrowed = static_cast<float>(number);
  if (!std::isfinite(number) || !std::isfinite(narrowed)) {
    throw std::invalid_argument(
        std::string("Invalid numeric stroke value for ") + propertyPath +
        ": expected a finite number.");
  }
  return narrowed;
}

inline std::optional<float> getOptionalFloatPropertyWithAlias(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* publicKey,
    const char* aliasKey,
    const char* publicPropertyPath,
    const char* aliasPropertyPath) {
  if (object.hasProperty(runtime, publicKey)) {
    return getOptionalFloatProperty(
        runtime,
        object,
        publicKey,
        publicPropertyPath);
  }
  return getOptionalFloatProperty(runtime, object, aliasKey, aliasPropertyPath);
}

inline std::optional<SkPaint::Join> getOptionalStrokeJoin(
    jsi::Runtime& runtime,
    const jsi::Object& object) {
  const auto value = object.getProperty(runtime, "join");
  if (value.isUndefined() || value.isNull()) {
    return std::nullopt;
  }
  if (value.isNumber()) {
    return static_cast<SkPaint::Join>(static_cast<int>(value.asNumber()));
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
    return static_cast<SkPaint::Cap>(static_cast<int>(value.asNumber()));
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
    opts.width = getOptionalFloatProperty(
        runtime,
        object,
        "width",
        "stroke.width");
    opts.miter_limit = getOptionalFloatPropertyWithAlias(
        runtime,
        object,
        "miter_limit",
        "miterLimit",
        "stroke.miter_limit",
        "stroke.miterLimit");
    opts.precision = getOptionalFloatProperty(
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
