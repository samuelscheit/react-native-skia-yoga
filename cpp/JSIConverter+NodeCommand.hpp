#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include "JSIConverter+SkFont.hpp"
#include "JSIConverter+SkImage.hpp"
#include "JSIConverter+SkParagraph.hpp"
#include "JSIConverter+SkParagraphStyle.hpp"
#include "JSIConverter+SkPath.hpp"
#include "JSIConverter+SkSamplingOptions.hpp"
#include "JSIConverter+SkTextStyle.hpp"
#include "JSIConverter+AnimatedDouble.hpp"
#include "JSIConverter+StrokeOpts.hpp"
#include "NodeCommand.hpp"
#include <NitroModules/JSIConverter+Optional.hpp>
#include <NitroModules/NitroHash.hpp>
#include <array>
#include <cmath>
#include <jsi/jsi.h>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>

namespace margelo::nitro {

using namespace facebook;

namespace {

inline jsi::Object getDataObject(jsi::Runtime& runtime, const jsi::Object& object)
{
    auto dataValue = object.getProperty(runtime, "data");
    if (!dataValue.isObject()) {
        throw jsi::JSError(runtime, "NodeCommand.data must be an object.");
    }

    return dataValue.asObject(runtime);
}

template <typename T>
inline std::optional<T> getOptionalProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* key)
{
    return JSIConverter<std::optional<T>>::fromJSI(runtime, object.getProperty(runtime, key));
}

template <typename T>
inline std::optional<T> getOptionalPropertyWithAlias(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* publicKey,
    const char* aliasKey)
{
    if (object.hasProperty(runtime, publicKey)) {
        return getOptionalProperty<T>(runtime, object, publicKey);
    }
    return getOptionalProperty<T>(runtime, object, aliasKey);
}

template <typename T>
inline T getRequiredProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* key)
{
    return JSIConverter<T>::fromJSI(runtime, object.getProperty(runtime, key));
}

inline margelo::nitro::RNSkiaYoga::NodeCommandKind parseNodeCommandKind(const std::string& kind)
{
    using NodeCommandKind = margelo::nitro::RNSkiaYoga::NodeCommandKind;

    switch (hashString(kind.c_str(), kind.size())) {
    case hashString("rect"):
        return NodeCommandKind::RECT;
    case hashString("rrect"):
        return NodeCommandKind::RRECT;
    case hashString("text"):
        return NodeCommandKind::TEXT;
    case hashString("group"):
        return NodeCommandKind::GROUP;
    case hashString("blurMaskFilter"):
        return NodeCommandKind::BLUR_MASK_FILTER;
    case hashString("image"):
        return NodeCommandKind::IMAGE;
    case hashString("path"):
        return NodeCommandKind::PATH;
    case hashString("paragraph"):
        return NodeCommandKind::PARAGRAPH;
    case hashString("circle"):
        return NodeCommandKind::CIRCLE;
    case hashString("line"):
        return NodeCommandKind::LINE;
    case hashString("oval"):
        return NodeCommandKind::OVAL;
    case hashString("points"):
        return NodeCommandKind::POINTS;
    default:
        throw std::invalid_argument("Invalid NodeCommand.type: " + kind);
    }
}

inline std::optional<std::string> parseImageFit(jsi::Runtime& runtime, const jsi::Value& value)
{
    auto fit = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!fit.has_value()) {
        return std::nullopt;
    }

    switch (hashString(fit->c_str(), fit->size())) {
    case hashString("cover"):
    case hashString("contain"):
    case hashString("fill"):
    case hashString("fitHeight"):
    case hashString("fitWidth"):
    case hashString("none"):
    case hashString("scaleDown"):
        return fit;
    default:
        throw std::invalid_argument("Invalid fit: " + *fit);
    }
}

inline std::string invalidNumericEnumMessage(const char* propertyPath, const char* validValues)
{
    return std::string("Invalid numeric enum value for ") + propertyPath +
        ": expected a finite integer in " + validValues + ".";
}

template <typename T, size_t N>
inline std::optional<T> parseOptionalNumericEnum(
    const jsi::Value& value,
    const char* propertyPath,
    const std::array<T, N>& validValues,
    const char* validValueDescription)
{
    if (value.isUndefined() || value.isNull()) {
        return std::nullopt;
    }

    const auto number = value.asNumber();
    if (!std::isfinite(number) || std::trunc(number) != number) {
        throw std::invalid_argument(invalidNumericEnumMessage(propertyPath, validValueDescription));
    }

    for (const auto validValue : validValues) {
        if (number == static_cast<double>(static_cast<int>(validValue))) {
            return validValue;
        }
    }

    throw std::invalid_argument(invalidNumericEnumMessage(propertyPath, validValueDescription));
}

inline std::optional<SkBlurStyle> parseBlurStyle(jsi::Runtime& runtime, const jsi::Value& value)
{
    if (value.isNumber()) {
        return parseOptionalNumericEnum<SkBlurStyle>(
            value,
            "blurMaskFilter.blurStyle",
            std::array<SkBlurStyle, 4> {
                SkBlurStyle::kNormal_SkBlurStyle,
                SkBlurStyle::kSolid_SkBlurStyle,
                SkBlurStyle::kOuter_SkBlurStyle,
                SkBlurStyle::kInner_SkBlurStyle,
            },
            "[0, 1, 2, 3]");
    }

    auto blurStyle = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!blurStyle.has_value()) {
        return std::nullopt;
    }

    switch (hashString(blurStyle->c_str(), blurStyle->size())) {
    case hashString("normal"):
        return SkBlurStyle::kNormal_SkBlurStyle;
    case hashString("solid"):
        return SkBlurStyle::kSolid_SkBlurStyle;
    case hashString("outer"):
        return SkBlurStyle::kOuter_SkBlurStyle;
    case hashString("inner"):
        return SkBlurStyle::kInner_SkBlurStyle;
    default:
        throw std::invalid_argument("Invalid blurStyle: " + *blurStyle);
    }
}

inline std::optional<SkCanvas::PointMode> parsePointMode(jsi::Runtime& runtime, const jsi::Value& value)
{
    if (value.isNumber()) {
        return parseOptionalNumericEnum<SkCanvas::PointMode>(
            value,
            "points.pointMode",
            std::array<SkCanvas::PointMode, 3> {
                SkCanvas::PointMode::kPoints_PointMode,
                SkCanvas::PointMode::kLines_PointMode,
                SkCanvas::PointMode::kPolygon_PointMode,
            },
            "[0, 1, 2]");
    }

    auto pointMode = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!pointMode.has_value()) {
        return std::nullopt;
    }

    switch (hashString(pointMode->c_str(), pointMode->size())) {
    case hashString("points"):
        return SkCanvas::PointMode::kPoints_PointMode;
    case hashString("lines"):
        return SkCanvas::PointMode::kLines_PointMode;
    case hashString("polygon"):
        return SkCanvas::PointMode::kPolygon_PointMode;
    default:
        throw std::invalid_argument("Invalid pointMode: " + *pointMode);
    }
}

inline std::optional<SkPathFillType> parsePathFillType(jsi::Runtime& runtime, const jsi::Value& value)
{
    if (value.isNumber()) {
        return parseOptionalNumericEnum<SkPathFillType>(
            value,
            "path.fillType",
            std::array<SkPathFillType, 4> {
                SkPathFillType::kWinding,
                SkPathFillType::kEvenOdd,
                SkPathFillType::kInverseWinding,
                SkPathFillType::kInverseEvenOdd,
            },
            "[0, 1, 2, 3]");
    }

    auto fillType = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!fillType.has_value()) {
        return std::nullopt;
    }

    switch (hashString(fillType->c_str(), fillType->size())) {
    case hashString("winding"):
        return SkPathFillType::kWinding;
    case hashString("evenOdd"):
        return SkPathFillType::kEvenOdd;
    case hashString("inverseWinding"):
        return SkPathFillType::kInverseWinding;
    case hashString("inverseEvenOdd"):
        return SkPathFillType::kInverseEvenOdd;
    default:
        throw std::invalid_argument("Invalid fillType: " + *fillType);
    }
}

inline std::optional<SkPaint::Join> parseStrokeJoin(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const char* propertyPath)
{
    if (value.isNumber()) {
        return parseOptionalNumericEnum<SkPaint::Join>(
            value,
            propertyPath,
            std::array<SkPaint::Join, 3> {
                SkPaint::Join::kMiter_Join,
                SkPaint::Join::kRound_Join,
                SkPaint::Join::kBevel_Join,
            },
            "[0, 1, 2]");
    }

    auto join = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!join.has_value()) {
        return std::nullopt;
    }

    switch (hashString(join->c_str(), join->size())) {
    case hashString("miter"):
        return SkPaint::Join::kMiter_Join;
    case hashString("round"):
        return SkPaint::Join::kRound_Join;
    case hashString("bevel"):
        return SkPaint::Join::kBevel_Join;
    default:
        throw std::invalid_argument("Invalid stroke join: " + *join);
    }
}

inline std::optional<SkPaint::Cap> parseStrokeCap(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const char* propertyPath)
{
    if (value.isNumber()) {
        return parseOptionalNumericEnum<SkPaint::Cap>(
            value,
            propertyPath,
            std::array<SkPaint::Cap, 3> {
                SkPaint::Cap::kButt_Cap,
                SkPaint::Cap::kRound_Cap,
                SkPaint::Cap::kSquare_Cap,
            },
            "[0, 1, 2]");
    }

    auto cap = JSIConverter<std::optional<std::string>>::fromJSI(runtime, value);
    if (!cap.has_value()) {
        return std::nullopt;
    }

    switch (hashString(cap->c_str(), cap->size())) {
    case hashString("butt"):
        return SkPaint::Cap::kButt_Cap;
    case hashString("round"):
        return SkPaint::Cap::kRound_Cap;
    case hashString("square"):
        return SkPaint::Cap::kSquare_Cap;
    default:
        throw std::invalid_argument("Invalid stroke cap: " + *cap);
    }
}

inline std::optional<float> getOptionalFiniteStrokeProperty(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const char* propertyPath)
{
    auto parsed = getOptionalProperty<float>(runtime, object, key);
    if (parsed.has_value() && !std::isfinite(*parsed)) {
        throw std::invalid_argument(
            std::string("Invalid numeric stroke value for ") + propertyPath + ": expected a finite number.");
    }
    return parsed;
}

inline std::optional<float> getOptionalFiniteStrokePropertyWithAlias(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* publicKey,
    const char* aliasKey,
    const char* publicPropertyPath,
    const char* aliasPropertyPath)
{
    if (object.hasProperty(runtime, publicKey)) {
        return getOptionalFiniteStrokeProperty(runtime, object, publicKey, publicPropertyPath);
    }
    return getOptionalFiniteStrokeProperty(runtime, object, aliasKey, aliasPropertyPath);
}

inline std::optional<margelo::nitro::RNSkiaYoga::PathCommandData::StrokeOptsData> parseStrokeOpts(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    if (value.isUndefined() || value.isNull()) {
        return std::nullopt;
    }
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected stroke object.");
    }

    auto object = value.asObject(runtime);
    return margelo::nitro::RNSkiaYoga::PathCommandData::StrokeOptsData {
        .width = getOptionalFiniteStrokeProperty(runtime, object, "width", "path.stroke.width"),
        .miterLimit = getOptionalFiniteStrokePropertyWithAlias(
            runtime,
            object,
            "miter_limit",
            "miterLimit",
            "path.stroke.miter_limit",
            "path.stroke.miterLimit"),
        .precision = getOptionalFiniteStrokeProperty(runtime, object, "precision", "path.stroke.precision"),
        .join = parseStrokeJoin(runtime, object.getProperty(runtime, "join"), "path.stroke.join"),
        .cap = parseStrokeCap(runtime, object.getProperty(runtime, "cap"), "path.stroke.cap"),
    };
}

[[noreturn]] inline void throwInvalidCommandAnimatedDoubleValue(jsi::Runtime& runtime, const std::string& propertyPath)
{
    throw jsi::JSError(
        runtime,
        "Invalid numeric AnimatedDouble command value for " + propertyPath + ": expected a finite native float.");
}

inline bool isValidStaticAnimatedDoubleNativeFloat(double value)
{
    return std::isfinite(value) && std::abs(value) <= static_cast<double>(std::numeric_limits<float>::max());
}

inline margelo::nitro::RNSkiaYoga::AnimatedDouble parseStaticFiniteAnimatedDouble(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const char* propertyPath)
{
    auto animated = JSIConverter<margelo::nitro::RNSkiaYoga::AnimatedDouble>::fromJSI(runtime, value);
    if (!animated.isDynamic() && animated.value.has_value() && !isValidStaticAnimatedDoubleNativeFloat(animated.value.value())) {
        throwInvalidCommandAnimatedDoubleValue(runtime, propertyPath);
    }
    return animated;
}

[[noreturn]] inline void throwInvalidCommandPointValue(jsi::Runtime& runtime, const std::string& propertyPath)
{
    throw jsi::JSError(
        runtime,
        "Invalid numeric command point value for " + propertyPath + ": expected a finite number.");
}

inline double parseFinitePointNumber(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& pointPath)
{
    const auto value = object.getProperty(runtime, key).asNumber();
    if (!std::isfinite(value)) {
        throwInvalidCommandPointValue(runtime, pointPath + "." + key);
    }
    return value;
}

inline ::SkPoint parsePoint(jsi::Runtime& runtime, const jsi::Value& value, const std::string& pointPath)
{
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected point object.");
    }

    auto object = value.asObject(runtime);
    return ::SkPoint::Make(
        static_cast<float>(parseFinitePointNumber(runtime, object, "x", pointPath)),
        static_cast<float>(parseFinitePointNumber(runtime, object, "y", pointPath)));
}

inline std::vector<::SkPoint> parsePoints(jsi::Runtime& runtime, const jsi::Value& value)
{
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected points array.");
    }

    auto array = value.asObject(runtime).asArray(runtime);
    std::vector<::SkPoint> points;
    const auto size = array.size(runtime);
    points.reserve(size);
    for (size_t index = 0; index < size; ++index) {
        points.push_back(parsePoint(
            runtime,
            array.getValueAtIndex(runtime, index),
            "points.points[" + std::to_string(index) + "]"));
    }
    return points;
}

template <typename T>
inline jsi::Value optionalNumericEnumToJSI(jsi::Runtime& runtime, const std::optional<T>& value)
{
    (void)runtime;
    if (!value.has_value()) {
        return jsi::Value::undefined();
    }
    return jsi::Value(static_cast<double>(static_cast<int>(value.value())));
}

inline jsi::Object pointToJSI(jsi::Runtime& runtime, const ::SkPoint& point)
{
    jsi::Object object(runtime);
    object.setProperty(runtime, "x", static_cast<double>(point.x()));
    object.setProperty(runtime, "y", static_cast<double>(point.y()));
    return object;
}

inline jsi::Array pointsToJSI(jsi::Runtime& runtime, const std::vector<::SkPoint>& points)
{
    jsi::Array array(runtime, points.size());
    for (size_t index = 0; index < points.size(); ++index) {
        array.setValueAtIndex(runtime, index, jsi::Value(runtime, pointToJSI(runtime, points[index])));
    }
    return array;
}

inline jsi::Value pathStrokeOptsToJSI(
    jsi::Runtime& runtime,
    const std::optional<margelo::nitro::RNSkiaYoga::PathCommandData::StrokeOptsData>& stroke)
{
    if (!stroke.has_value()) {
        return jsi::Value::undefined();
    }

    RNSkia::StrokeOpts opts;
    opts.width = stroke->width;
    opts.miter_limit = stroke->miterLimit;
    opts.precision = stroke->precision;
    opts.join = stroke->join;
    opts.cap = stroke->cap;
    return JSIConverter<RNSkia::StrokeOpts>::toJSI(runtime, opts);
}

inline void rejectUnsupportedTextCommandTextStyleField(
    jsi::Runtime& runtime,
    const jsi::Object& textStyle,
    const char* key)
{
    if (!textStyle.hasProperty(runtime, key)) {
        return;
    }

    throw jsi::JSError(
        runtime,
        std::string("text.textStyle.") + key + " is not rendered by TextCmd; supported text.textStyle fields are fontSize and color.");
}

inline void rejectUnsupportedTextCommandTextStyleFields(
    jsi::Runtime& runtime,
    const jsi::Object& data)
{
    auto textStyleValue = data.getProperty(runtime, "textStyle");
    if (textStyleValue.isUndefined() || textStyleValue.isNull() || !textStyleValue.isObject()) {
        return;
    }

    auto textStyle = textStyleValue.asObject(runtime);
    const char* unsupportedKeys[] = {
        "backgroundColor",
        "decoration",
        "decorationColor",
        "decorationStyle",
        "decorationThickness",
        "fontFamilies",
        "fontFeatures",
        "fontStyle",
        "fontVariations",
        "foregroundColor",
        "halfLeading",
        "height",
        "heightMultiplier",
        "letterSpacing",
        "locale",
        "shadows",
        "textBaseline",
        "wordSpacing",
    };

    for (const auto* key : unsupportedKeys) {
        rejectUnsupportedTextCommandTextStyleField(runtime, textStyle, key);
    }
}

inline jsi::Value textCommandTextStyleToJSI(
    jsi::Runtime& runtime,
    const std::optional<skia::textlayout::TextStyle>& textStyle)
{
    if (!textStyle.has_value()) {
        return jsi::Value::undefined();
    }

    jsi::Object object(runtime);
    object.setProperty(runtime, "fontSize", static_cast<double>(textStyle->getFontSize()));
    object.setProperty(runtime, "color", static_cast<double>(textStyle->getColor()));
    return object;
}

} // namespace

template <>
struct JSIConverter<margelo::nitro::RNSkiaYoga::NodeCommand> final {
    static inline margelo::nitro::RNSkiaYoga::NodeCommand fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    {
        using namespace margelo::nitro::RNSkiaYoga;

        jsi::Object object = arg.asObject(runtime);
        const auto typeName = JSIConverter<std::string>::fromJSI(runtime, object.getProperty(runtime, "type"));
        const auto type = parseNodeCommandKind(typeName);
        jsi::Object data = getDataObject(runtime, object);

        try {
            switch (type) {
            case NodeCommandKind::RECT:
                return NodeCommand { type, EmptyNodeCommandData {} };
            case NodeCommandKind::RRECT:
                return NodeCommand { type, RoundedRectCommandData {
                                               .cornerRadius = parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "cornerRadius"), "rrect.cornerRadius"),
                                           } };
            case NodeCommandKind::TEXT:
                rejectUnsupportedTextCommandTextStyleFields(runtime, data);
                return NodeCommand { type, TextCommandData {
                                               .font = getOptionalProperty<SkFont>(runtime, data, "font"),
                                               .text = getOptionalProperty<std::string>(runtime, data, "text"),
                                               .textStyle = getOptionalProperty<skia::textlayout::TextStyle>(runtime, data, "textStyle"),
                                           } };
            case NodeCommandKind::GROUP:
                return NodeCommand { type, GroupCommandData {
                                               .rasterize = getOptionalProperty<bool>(runtime, data, "rasterize"),
                                           } };
            case NodeCommandKind::BLUR_MASK_FILTER:
                return NodeCommand { type, BlurMaskFilterCommandData {
                                               .blur = parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "blur"), "blurMaskFilter.blur"),
                                               .blurStyle = parseBlurStyle(runtime, data.getProperty(runtime, "blurStyle")),
                                               .respectCTM = getOptionalProperty<bool>(runtime, data, "respectCTM"),
                                           } };
            case NodeCommandKind::IMAGE:
                return NodeCommand { type, ImageCommandData {
                                               .fit = parseImageFit(runtime, data.getProperty(runtime, "fit")),
                                               .image = getOptionalProperty<sk_sp<SkImage>>(runtime, data, "image"),
                                               .sampling = getOptionalProperty<SkSamplingOptions>(runtime, data, "sampling"),
                                           } };
            case NodeCommandKind::PATH:
                return NodeCommand { type, PathCommandData {
                                               .fillType = parsePathFillType(runtime, data.getProperty(runtime, "fillType")),
                                               .path = getRequiredProperty<SkPath>(runtime, data, "path"),
                                               .stroke = parseStrokeOpts(runtime, data.getProperty(runtime, "stroke")),
                                               .trimEnd = parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimEnd"), "path.trimEnd"),
                                               .trimStart = parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimStart"), "path.trimStart"),
                                           } };
            case NodeCommandKind::PARAGRAPH:
                return NodeCommand { type, ParagraphCommandData {
                                               .paragraph = getOptionalProperty<std::shared_ptr<RNSkia::JsiSkParagraph>>(runtime, data, "paragraph"),
                                               .paragraphStyle = getOptionalProperty<skia::textlayout::ParagraphStyle>(runtime, data, "paragraphStyle"),
                                               .text = getOptionalProperty<std::string>(runtime, data, "text"),
                                           } };
            case NodeCommandKind::CIRCLE:
                return NodeCommand { type, CircleCommandData {
                                               .radius = parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "radius"), "circle.radius"),
                                           } };
            case NodeCommandKind::LINE:
                return NodeCommand { type, LineCommandData {
                                               .from = parsePoint(runtime, data.getProperty(runtime, "from"), "line.from"),
                                               .to = parsePoint(runtime, data.getProperty(runtime, "to"), "line.to"),
                                           } };
            case NodeCommandKind::OVAL:
                return NodeCommand { type, EmptyNodeCommandData {} };
            case NodeCommandKind::POINTS: {
                auto points = parsePoints(runtime, data.getProperty(runtime, "points"));
                return NodeCommand { type, PointsCommandData {
                                               .pointMode = parsePointMode(runtime, data.getProperty(runtime, "pointMode")),
                                               .points = std::move(points),
                                           } };
            }
            }
        } catch (const std::exception& error) {
            throw jsi::JSError(runtime, "NodeCommand conversion failed for type \"" + typeName + "\": " + error.what());
        }
    }

    static inline jsi::Value toJSI(jsi::Runtime& runtime, const margelo::nitro::RNSkiaYoga::NodeCommand& arg)
    {
        using namespace margelo::nitro::RNSkiaYoga;

        jsi::Object object(runtime);
        jsi::Object data(runtime);

        switch (arg.type) {
        case NodeCommandKind::RECT:
            object.setProperty(runtime, "type", "rect");
            break;
        case NodeCommandKind::RRECT: {
            object.setProperty(runtime, "type", "rrect");
            const auto& payload = std::get<RoundedRectCommandData>(arg.data);
            data.setProperty(runtime, "cornerRadius", JSIConverter<AnimatedDouble>::toJSI(runtime, payload.cornerRadius));
            break;
        }
        case NodeCommandKind::TEXT: {
            object.setProperty(runtime, "type", "text");
            const auto& payload = std::get<TextCommandData>(arg.data);
            data.setProperty(runtime, "font", JSIConverter<std::optional<SkFont>>::toJSI(runtime, payload.font));
            data.setProperty(runtime, "text", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.text));
            data.setProperty(runtime, "textStyle", textCommandTextStyleToJSI(runtime, payload.textStyle));
            break;
        }
        case NodeCommandKind::GROUP:
            object.setProperty(runtime, "type", "group");
            data.setProperty(
                runtime,
                "rasterize",
                JSIConverter<std::optional<bool>>::toJSI(
                    runtime,
                    std::get<GroupCommandData>(arg.data).rasterize));
            break;
        case NodeCommandKind::BLUR_MASK_FILTER: {
            object.setProperty(runtime, "type", "blurMaskFilter");
            const auto& payload = std::get<BlurMaskFilterCommandData>(arg.data);
            data.setProperty(runtime, "blur", JSIConverter<AnimatedDouble>::toJSI(runtime, payload.blur));
            data.setProperty(runtime, "blurStyle", optionalNumericEnumToJSI(runtime, payload.blurStyle));
            data.setProperty(runtime, "respectCTM", JSIConverter<std::optional<bool>>::toJSI(runtime, payload.respectCTM));
            break;
        }
        case NodeCommandKind::IMAGE: {
            object.setProperty(runtime, "type", "image");
            const auto& payload = std::get<ImageCommandData>(arg.data);
            data.setProperty(runtime, "fit", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.fit));
            data.setProperty(runtime, "image", JSIConverter<std::optional<sk_sp<SkImage>>>::toJSI(runtime, payload.image));
            data.setProperty(runtime, "sampling", JSIConverter<std::optional<SkSamplingOptions>>::toJSI(runtime, payload.sampling));
            break;
        }
        case NodeCommandKind::PATH: {
            object.setProperty(runtime, "type", "path");
            const auto& payload = std::get<PathCommandData>(arg.data);
            data.setProperty(runtime, "fillType", optionalNumericEnumToJSI(runtime, payload.fillType));
            data.setProperty(runtime, "path", JSIConverter<SkPath>::toJSI(runtime, payload.path));
            data.setProperty(runtime, "stroke", pathStrokeOptsToJSI(runtime, payload.stroke));
            data.setProperty(runtime, "trimEnd", JSIConverter<AnimatedDouble>::toJSI(runtime, payload.trimEnd));
            data.setProperty(runtime, "trimStart", JSIConverter<AnimatedDouble>::toJSI(runtime, payload.trimStart));
            break;
        }
        case NodeCommandKind::PARAGRAPH: {
            object.setProperty(runtime, "type", "paragraph");
            const auto& payload = std::get<ParagraphCommandData>(arg.data);
            data.setProperty(runtime, "paragraph", JSIConverter<std::optional<std::shared_ptr<RNSkia::JsiSkParagraph>>>::toJSI(runtime, payload.paragraph));
            data.setProperty(runtime, "paragraphStyle", JSIConverter<std::optional<skia::textlayout::ParagraphStyle>>::toJSI(runtime, payload.paragraphStyle));
            data.setProperty(runtime, "text", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.text));
            break;
        }
        case NodeCommandKind::CIRCLE: {
            object.setProperty(runtime, "type", "circle");
            const auto& payload = std::get<CircleCommandData>(arg.data);
            data.setProperty(runtime, "radius", JSIConverter<AnimatedDouble>::toJSI(runtime, payload.radius));
            break;
        }
        case NodeCommandKind::LINE: {
            object.setProperty(runtime, "type", "line");
            const auto& payload = std::get<LineCommandData>(arg.data);
            data.setProperty(runtime, "from", pointToJSI(runtime, payload.from));
            data.setProperty(runtime, "to", pointToJSI(runtime, payload.to));
            break;
        }
        case NodeCommandKind::OVAL:
            object.setProperty(runtime, "type", "oval");
            break;
        case NodeCommandKind::POINTS: {
            object.setProperty(runtime, "type", "points");
            const auto& payload = std::get<PointsCommandData>(arg.data);
            data.setProperty(runtime, "pointMode", optionalNumericEnumToJSI(runtime, payload.pointMode));
            data.setProperty(runtime, "points", pointsToJSI(runtime, payload.points));
            break;
        }
        }

        object.setProperty(runtime, "data", data);
        return object;
    }

    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    {
        if (!value.isObject()) {
            return false;
        }

        const auto object = value.getObject(runtime);
        const auto typeValue = object.getProperty(runtime, "type");
        return typeValue.isString() && object.getProperty(runtime, "data").isObject();
    }
};

} // namespace margelo::nitro
