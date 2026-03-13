#pragma once

#include "JsiSkParagraph.h"
#include "JSIConverter+AnimatedDouble.hpp"
#include "SkiaGlue.hpp"
#include <include/core/SkBlurTypes.h>
#include <include/core/SkFont.h>
#include <include/core/SkImage.h>
#include <include/core/SkPath.h>
#include <include/core/SkCanvas.h>
#include <include/core/SkPoint.h>
#include <include/core/SkSamplingOptions.h>
#include <modules/skparagraph/include/ParagraphStyle.h>
#include <modules/skparagraph/include/TextStyle.h>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace margelo::nitro::RNSkiaYoga {

enum class NodeCommandKind {
    RECT,
    RRECT,
    TEXT,
    GROUP,
    BLUR_MASK_FILTER,
    IMAGE,
    PATH,
    PARAGRAPH,
    CIRCLE,
    LINE,
    OVAL,
    POINTS,
};

struct EmptyNodeCommandData {
};

struct GroupCommandData {
    std::optional<bool> rasterize;
};

struct RoundedRectCommandData {
    AnimatedDouble cornerRadius;
};

struct TextCommandData {
    std::optional<SkFont> font;
    std::optional<std::string> text;
    std::optional<skia::textlayout::TextStyle> textStyle;
};

struct ParagraphCommandData {
    std::optional<std::shared_ptr<RNSkia::JsiSkParagraph>> paragraph;
    std::optional<skia::textlayout::ParagraphStyle> paragraphStyle;
    std::optional<std::string> text;
};

struct PathCommandData {
    std::optional<SkPathFillType> fillType;
    SkPath path;
    struct StrokeOptsData {
        std::optional<float> width;
        std::optional<float> miterLimit;
        std::optional<float> precision;
        std::optional<SkPaint::Join> join;
        std::optional<SkPaint::Cap> cap;
    };
    std::optional<StrokeOptsData> stroke;
    AnimatedDouble trimEnd;
    AnimatedDouble trimStart;
};

struct LineCommandData {
    ::SkPoint from;
    ::SkPoint to;
};

struct PointsCommandData {
    std::optional<SkCanvas::PointMode> pointMode;
    std::vector<::SkPoint> points;
};

struct BlurMaskFilterCommandData {
    AnimatedDouble blur;
    std::optional<SkBlurStyle> blurStyle;
    std::optional<bool> respectCTM;
};

struct CircleCommandData {
    AnimatedDouble radius;
};

struct ImageCommandData {
    std::optional<std::string> fit;
    std::optional<sk_sp<SkImage>> image;
    std::optional<SkSamplingOptions> sampling;
};

using NodeCommandPayload = std::variant<
    EmptyNodeCommandData,
    GroupCommandData,
    RoundedRectCommandData,
    TextCommandData,
    ParagraphCommandData,
    PathCommandData,
    LineCommandData,
    PointsCommandData,
    BlurMaskFilterCommandData,
    CircleCommandData,
    ImageCommandData>;

struct NodeCommand {
    NodeCommandKind type;
    NodeCommandPayload data;
};

} // namespace margelo::nitro::RNSkiaYoga
