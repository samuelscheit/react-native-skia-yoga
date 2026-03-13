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
#include "NodeCommand.hpp"
#include <NitroModules/JSIConverter+Optional.hpp>
#include <NitroModules/NitroHash.hpp>
#include <jsi/jsi.h>

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

inline std::optional<SkBlurStyle> parseBlurStyle(jsi::Runtime& runtime, const jsi::Value& value)
{
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

inline std::optional<SkPaint::Join> parseStrokeJoin(jsi::Runtime& runtime, const jsi::Value& value)
{
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

inline std::optional<SkPaint::Cap> parseStrokeCap(jsi::Runtime& runtime, const jsi::Value& value)
{
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
        .width = getOptionalProperty<float>(runtime, object, "width"),
        .miterLimit = getOptionalProperty<float>(runtime, object, "miterLimit"),
        .precision = getOptionalProperty<float>(runtime, object, "precision"),
        .join = parseStrokeJoin(runtime, object.getProperty(runtime, "join")),
        .cap = parseStrokeCap(runtime, object.getProperty(runtime, "cap")),
    };
}

inline ::SkPoint parsePoint(jsi::Runtime& runtime, const jsi::Value& value)
{
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected point object.");
    }

    auto object = value.asObject(runtime);
    return ::SkPoint::Make(
        static_cast<float>(object.getProperty(runtime, "x").asNumber()),
        static_cast<float>(object.getProperty(runtime, "y").asNumber()));
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
        points.push_back(parsePoint(runtime, array.getValueAtIndex(runtime, index)));
    }
    return points;
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
                                               .cornerRadius = getOptionalProperty<double>(runtime, data, "cornerRadius"),
                                           } };
            case NodeCommandKind::TEXT:
                return NodeCommand { type, TextCommandData {
                                               .font = getOptionalProperty<SkFont>(runtime, data, "font"),
                                               .text = getOptionalProperty<std::string>(runtime, data, "text"),
                                               .textStyle = getOptionalProperty<skia::textlayout::TextStyle>(runtime, data, "textStyle"),
                                           } };
            case NodeCommandKind::GROUP:
                return NodeCommand { type, EmptyNodeCommandData {} };
            case NodeCommandKind::BLUR_MASK_FILTER:
                return NodeCommand { type, BlurMaskFilterCommandData {
                                               .blur = getOptionalProperty<double>(runtime, data, "blur"),
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
                                               .trimEnd = getOptionalProperty<double>(runtime, data, "trimEnd"),
                                               .trimStart = getOptionalProperty<double>(runtime, data, "trimStart"),
                                           } };
            case NodeCommandKind::PARAGRAPH:
                return NodeCommand { type, ParagraphCommandData {
                                               .paragraph = getOptionalProperty<std::shared_ptr<RNSkia::JsiSkParagraph>>(runtime, data, "paragraph"),
                                               .paragraphStyle = getOptionalProperty<skia::textlayout::ParagraphStyle>(runtime, data, "paragraphStyle"),
                                               .text = getOptionalProperty<std::string>(runtime, data, "text"),
                                           } };
            case NodeCommandKind::CIRCLE:
                return NodeCommand { type, CircleCommandData {
                                               .radius = getOptionalProperty<double>(runtime, data, "radius"),
                                           } };
            case NodeCommandKind::LINE:
                return NodeCommand { type, LineCommandData {
                                               .from = parsePoint(runtime, data.getProperty(runtime, "from")),
                                               .to = parsePoint(runtime, data.getProperty(runtime, "to")),
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
            data.setProperty(runtime, "cornerRadius", JSIConverter<std::optional<double>>::toJSI(runtime, payload.cornerRadius));
            break;
        }
        case NodeCommandKind::TEXT: {
            object.setProperty(runtime, "type", "text");
            const auto& payload = std::get<TextCommandData>(arg.data);
            data.setProperty(runtime, "font", JSIConverter<std::optional<SkFont>>::toJSI(runtime, payload.font));
            data.setProperty(runtime, "text", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.text));
            data.setProperty(runtime, "textStyle", JSIConverter<std::optional<skia::textlayout::TextStyle>>::toJSI(runtime, payload.textStyle));
            break;
        }
        case NodeCommandKind::GROUP:
            object.setProperty(runtime, "type", "group");
            break;
        case NodeCommandKind::BLUR_MASK_FILTER: {
            object.setProperty(runtime, "type", "blurMaskFilter");
            const auto& payload = std::get<BlurMaskFilterCommandData>(arg.data);
            data.setProperty(runtime, "blur", JSIConverter<std::optional<double>>::toJSI(runtime, payload.blur));
            break;
        }
        case NodeCommandKind::IMAGE: {
            object.setProperty(runtime, "type", "image");
            const auto& payload = std::get<ImageCommandData>(arg.data);
            data.setProperty(runtime, "fit", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.fit));
            break;
        }
        case NodeCommandKind::PATH:
            object.setProperty(runtime, "type", "path");
            break;
        case NodeCommandKind::PARAGRAPH: {
            object.setProperty(runtime, "type", "paragraph");
            const auto& payload = std::get<ParagraphCommandData>(arg.data);
            data.setProperty(runtime, "text", JSIConverter<std::optional<std::string>>::toJSI(runtime, payload.text));
            break;
        }
        case NodeCommandKind::CIRCLE: {
            object.setProperty(runtime, "type", "circle");
            const auto& payload = std::get<CircleCommandData>(arg.data);
            data.setProperty(runtime, "radius", JSIConverter<std::optional<double>>::toJSI(runtime, payload.radius));
            break;
        }
        case NodeCommandKind::LINE:
            object.setProperty(runtime, "type", "line");
            break;
        case NodeCommandKind::OVAL:
            object.setProperty(runtime, "type", "oval");
            break;
        case NodeCommandKind::POINTS:
            object.setProperty(runtime, "type", "points");
            break;
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
