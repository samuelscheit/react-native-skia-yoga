#pragma once

#include "SkiaGlue.hpp"
#include "SkiaYoga.hpp"
// Ensure JSIConverter specializations are visible before Nitro-generated headers
#include "JSIConverter+SkFont.hpp"
#include "JSIConverter+SkImage.hpp"
#include "JSIConverter+SkMatrix.hpp"
#include "JSIConverter+NodeCommand.hpp"
#include "JSIConverter+SkPaint.hpp"
#include "JSIConverter+SkParagraph.hpp"
#include "JSIConverter+SkParagraphStyle.hpp"
#include "JSIConverter+SkPath.hpp"
#include "JSIConverter+SkSamplingOptions.hpp"
#include "JSIConverter+SkTextStyle.hpp"
#include "JSIConverter+SkRRect.hpp"
#include "JSIConverter+SkRect.hpp"
#include "JSIConverter+StrokeOpts.hpp"

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"


#include "ColorParser.hpp"
#include "NodeCommand.hpp"
#include "JsiSkRuntimeEffect.h"
#include "Drawings.h"
#include "JsiSkFontMgr.h"
#include "JsiSkFontMgrFactory.h"
#include "JsiSkColor.h"
#include "JsiSkTextStyle.h"
#include "JsiSkParagraphStyle.h"
#include "JsiSkParagraph.h"
#include "Command.h"
#include <include/core/SkBlurTypes.h>
#include <include/core/SkFontMgr.h>
#include <include/core/SkMaskFilter.h>
#include <include/core/SkSpan.h>
#include <include/core/SkTypeface.h>
#include <include/private/base/SkTypeTraits.h>
#include <modules/skparagraph/include/FontCollection.h>
#include <modules/skparagraph/include/ParagraphBuilder.h>
#include <modules/skparagraph/include/ParagraphStyle.h>
#include <algorithm>
#include <string>
#include <unordered_map>
#include <vector>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {
class YogaNode;
}

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

namespace para = skia::textlayout;

namespace detail {

    using CornerRadii = std::array<SkVector, 4>;

    struct FamilyCacheKey {
        std::string name;
        bool isDefault = false;

        static FamilyCacheKey From(const char* familyName)
        {
            FamilyCacheKey key;
            if (familyName == nullptr) {
                key.isDefault = true;
            } else {
                key.name = familyName;
            }
            return key;
        }

        bool operator==(const FamilyCacheKey& other) const
        {
            return isDefault == other.isDefault && name == other.name;
        }
    };

    struct FamilyCacheKeyHash {
        std::size_t operator()(const FamilyCacheKey& key) const noexcept
        {
            std::size_t hash = std::hash<std::string> {}(key.name);
            if (key.isDefault) {
                static constexpr std::size_t salt = static_cast<std::size_t>(0x9e3779b97f4a7c15ULL);
                hash ^= salt;
            }
            return hash;
        }
    };

    struct FontStyleKey {
        int weight = 0;
        int width = 0;
        SkFontStyle::Slant slant = SkFontStyle::kUpright_Slant;

        explicit FontStyleKey(const SkFontStyle& style)
            : weight(style.weight())
            , width(style.width())
            , slant(style.slant())
        {
        }

        bool operator==(const FontStyleKey& other) const noexcept
        {
            return weight == other.weight && width == other.width && slant == other.slant;
        }
    };

    struct FontStyleKeyHash {
        std::size_t operator()(const FontStyleKey& key) const noexcept
        {
            std::size_t hash = std::hash<int> {}(key.weight);
            hash ^= (std::hash<int> {}(key.width) + 0x9e3779b9 + (hash << 6) + (hash >> 2));
            hash ^= (std::hash<int> {}(static_cast<int>(key.slant)) + 0x9e3779b9 + (hash << 6) + (hash >> 2));
            return hash;
        }
    };

    // Cache style sets per family and nested typefaces per style key.
    struct FontCacheEntry {
        bool styleSetInitialized = false;
        sk_sp<SkFontStyleSet> styleSet;
        std::unordered_map<FontStyleKey, sk_sp<SkTypeface>, FontStyleKeyHash> typefaces;
    };

    inline std::unordered_map<FamilyCacheKey, FontCacheEntry, FamilyCacheKeyHash>& fontFamilyCache()
    {
        static std::unordered_map<FamilyCacheKey, FontCacheEntry, FamilyCacheKeyHash> cache;
        return cache;
    }

    inline std::mutex& fontFamilyCacheMutex()
    {
        static std::mutex mutex;
        return mutex;
    }

    inline sk_sp<SkTypeface> getCachedTypeface(SkFontMgr* fontMgr, const char* familyName, const SkFontStyle& style)
    {
        if (fontMgr == nullptr) {
            return nullptr;
        }

        auto familyKey = FamilyCacheKey::From(familyName);
        const FontStyleKey styleKey(style);

        std::lock_guard<std::mutex> lock(fontFamilyCacheMutex());
        auto& cache = fontFamilyCache();
        FontCacheEntry& entry = cache[familyKey];

        if (!entry.styleSetInitialized) {
            entry.styleSet = fontMgr->matchFamily(familyName);
            entry.styleSetInitialized = true;
        }

        const auto tfIt = entry.typefaces.find(styleKey);
        if (tfIt != entry.typefaces.end()) {
            return tfIt->second;
        }

        sk_sp<SkTypeface> typeface;
        if (entry.styleSet) {
            typeface = entry.styleSet->matchStyle(style);
        } else {
            typeface = fontMgr->matchFamilyStyle(familyName, style);
        }

        entry.typefaces.emplace(styleKey, typeface);
        return typeface;
    }

    inline SkMatrix calculateLayoutTransform(const SkRect& bounds, const YogaNodeLayout& layout)
    {
        SkMatrix transform;
        transform.setIdentity();

        const auto boundsWidth = bounds.width();
        const auto boundsHeight = bounds.height();
        const bool hasWidth = boundsWidth > 0.0f;
        const bool hasHeight = boundsHeight > 0.0f;

        if (!hasWidth && !hasHeight) {
            return transform;
        }

        const auto layoutWidth = static_cast<float>(layout.width);
        const auto layoutHeight = static_cast<float>(layout.height);

        float widthRatio = std::numeric_limits<float>::max();
        if (hasWidth) {
            widthRatio = layoutWidth <= 0.0f ? 0.0f : layoutWidth / boundsWidth;
        }

        float heightRatio = std::numeric_limits<float>::max();
        if (hasHeight) {
            heightRatio = layoutHeight <= 0.0f ? 0.0f : layoutHeight / boundsHeight;
        }

        float scale = 1.0f;
        if (hasWidth && hasHeight) {
            const auto candidate = std::min(widthRatio, heightRatio);
            if (candidate != std::numeric_limits<float>::max()) {
                scale = candidate;
            }
        } else if (hasWidth) {
            if (widthRatio != std::numeric_limits<float>::max()) {
                scale = widthRatio;
            }
        } else if (hasHeight) {
            if (heightRatio != std::numeric_limits<float>::max()) {
                scale = heightRatio;
            }
        }

        if (scale < 0.0f) {
            scale = 0.0f;
        }

        transform.preTranslate(-bounds.left(), -bounds.top());
        if (scale != 1.0f) {
            transform.preScale(scale, scale);
        }
        transform.postTranslate(bounds.left(), bounds.top());

        return transform;
    }

    inline SkRRect makeRoundedRect(const YogaNodeLayout& layout, const CornerRadii& radii)
    {
        return SkRRect::MakeRectRadii(
            SkRect::MakeXYWH(0, 0, layout.width, layout.height),
            radii.data());
    }

} // namespace detail

class YogaNodeCommand {
public:
    virtual ~YogaNodeCommand() = default;

    virtual void setLayout(const YogaNodeLayout& layout) = 0;
    virtual void draw(RNSkia::DrawingCtx* ctx) = 0;
    virtual bool isDynamic() const { return false; }
    virtual bool rasterizesSubtree() const { return false; }

protected:
    explicit YogaNodeCommand(YogaNode* node)
        : node(node)
    {
    }

    YogaNode* node;
};

enum class YogaNodeCommandKind {
    NONE,
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

class YogaNode : public HybridYogaNodeSpec {
public:
    // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
    YogaNode();
    ~YogaNode();
    void setStyle(const NodeStyle& style) override;
    void setCommand(NodeCommand command) override;
    void insertChild(const std::shared_ptr<HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<HybridYogaNodeSpec>>>& index) override;
    void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;

    jsi::Value getChildren(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

    void computeLayout(std::optional<double> width, std::optional<double> height) override;
    void recursiveSetLayout();
    YogaNodeLayout getLayout() override;
    void setLayout(const YogaNodeLayout& layout) override;
    void invalidateLayout();
    void invalidateRasterCache();

    void removeAllChildren() override;

    jsi::Value draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    void drawInternal(RNSkia::DrawingCtx& ctx);
    void drawChildren(RNSkia::DrawingCtx& ctx);
    bool subtreeHasDynamicRasterContent() const;

    std::string getName() const { return "YogaNode"; }

    YGNodeRef _node;
    YogaNodeCommandKind _commandKind = YogaNodeCommandKind::NONE;
    bool _hasLayoutBeenComputed = false;
    YogaNodeLayout _layout;
    std::unique_ptr<YogaNodeCommand> _command;
    YogaNode* _parent = nullptr;
    std::vector<std::shared_ptr<YogaNode>> _children;
    NodeStyle _style;
    SkPaint _paint;
    std::optional<SkPaint> _layerPaint;
    bool _clipsToBounds = false;
    std::optional<SkPath> _clipPath;
    std::optional<SkRRect> _clipRRect;
    std::optional<detail::CornerRadii> _clipToBoundsRadii;
    std::optional<SkRect> _clipRect;
    std::shared_ptr<SkMatrix> _matrix;
    sk_sp<SkImage> _rasterCache;
    bool _rasterCacheDirty = true;
    int _rasterCacheHeight = 0;
    int _rasterCacheWidth = 0;

    void loadHybridMethods() override
    {
        // register base protoype
        HybridYogaNodeSpec::loadHybridMethods();
        // register all methods we override here
        registerHybrids(this, [](Prototype& prototype) {
            prototype.registerRawHybridMethod("draw", 0, &YogaNode::draw);
            prototype.registerRawHybridMethod("getChildren", 0, &YogaNode::getChildren);
        });
    }
};

class GroupCmd : public YogaNodeCommand {
public:
    GroupCmd(YogaNode* node)
        : YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
    }

    void draw(RNSkia::DrawingCtx* ctx) override { }
    bool rasterizesSubtree() const override { return _rasterize; }
    void updateProps(const GroupCommandData& props)
    {
        _rasterize = props.rasterize.value_or(false);
    }

private:
    bool _rasterize = false;
};

struct BlurMaskFilterProps {
    SkBlurStyle style = SkBlurStyle::kNormal_SkBlurStyle;
    bool respectCTM = false;
};

class BlurMaskFilterCmd : public YogaNodeCommand {
public:
    explicit BlurMaskFilterCmd(YogaNode* node)
        : YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        (void)layout;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        const auto blur = static_cast<float>(_blur.resolve().value_or(0.0));
        auto maskFilter = SkMaskFilter::MakeBlur(_props.style, blur, _props.respectCTM);
        ctx->getPaint().setMaskFilter(maskFilter);
    }
    bool isDynamic() const override { return _blur.isDynamic(); }

    void updateProps(const BlurMaskFilterCommandData& props);

private:
    BlurMaskFilterProps _props;
    AnimatedDouble _blur;
};

class RectCmd : public RNSkia::RectCmd, public YogaNodeCommand {
public:
    RectCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::RectCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.rect = SkRect::MakeXYWH(0, 0, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        if (node->_clipToBoundsRadii.has_value()) {
            ctx->canvas->drawRRect(
                detail::makeRoundedRect(node->_layout, *node->_clipToBoundsRadii),
                ctx->getPaint());
            return;
        }

        if (!this->props.rect.has_value()) {
            throw std::runtime_error("Call computeLayout before drawing");
        }
        RNSkia::RectCmd::draw(ctx);
    }
};

class RRectCmd : public RNSkia::RRectCmd, public YogaNodeCommand {
public:
    RRectCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::RRectCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
    }

    void updateProps(const RoundedRectCommandData& props)
    {
        _cornerRadius = props.cornerRadius;
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        auto radius = this->props.r.value_or(RNSkia::Radius { 0, 0 });
        this->props.rect = SkRRect::MakeRectXY(SkRect::MakeXYWH(0, 0, layout.width, layout.height), radius.rX, radius.rY);
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        const auto radius = static_cast<float>(_cornerRadius.resolve().value_or(0.0));
        this->props.r = RNSkia::Radius { .rX = radius, .rY = radius };
        this->props.rect = SkRRect::MakeRectXY(
            SkRect::MakeXYWH(0, 0, node->_layout.width, node->_layout.height),
            radius,
            radius);
        RNSkia::RRectCmd::draw(ctx);
    }
    bool isDynamic() const override { return _cornerRadius.isDynamic(); }

private:
    AnimatedDouble _cornerRadius;
};

class OvalCmd : public RNSkia::OvalCmd, public YogaNodeCommand {
public:
    OvalCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::OvalCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        const auto width = std::max(0.0f, static_cast<float>(layout.width));
        const auto height = std::max(0.0f, static_cast<float>(layout.height));
        this->props.rect = SkRect::MakeXYWH(0, 0, width, height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {

        RNSkia::OvalCmd::draw(ctx);
    }

private:
};

class CircleCmd : public RNSkia::CircleCmd, public YogaNodeCommand {
public:
    CircleCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::CircleCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
    }

    void updateProps(const CircleCommandData& props)
    {
        _radius = props.radius;
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        const float width = std::max(0.0f, static_cast<float>(layout.width));
        const float height = std::max(0.0f, static_cast<float>(layout.height));

        const float cx = width * 0.5f;
        const float cy = height * 0.5f;
        const ::SkPoint center = ::SkPoint::Make(cx, cy);
        this->props.c = center;

        if (!_hasExplicitRadius) {
            const float radius = std::max(0.0f, std::min(width, height) * 0.5f);
            this->props.r = radius;
        }
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        const auto resolvedRadius = _radius.resolve();
        if (resolvedRadius.has_value()) {
            setRadius(static_cast<float>(resolvedRadius.value()));
        } else {
            clearRadius();
            setLayout(node->_layout);
        }
        RNSkia::CircleCmd::draw(ctx);
    }
    bool isDynamic() const override { return _radius.isDynamic(); }


    void setRadius(float radius)
    {
        this->props.r = radius;
        _hasExplicitRadius = true;
    }

    void clearRadius()
    {
        this->props.r = 0.0f;
        _hasExplicitRadius = false;
    }

    bool hasExplicitRadius() const { return _hasExplicitRadius; }

private:
    AnimatedDouble _radius;
    bool _hasExplicitRadius = false;
};

class TextCmd : public RNSkia::TextCmd, public YogaNodeCommand {
public:
    TextCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::TextCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;

        if (!sDefaultFont) {
            auto context = margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext();
            auto fontMgr = RNSkia::JsiSkFontMgrFactory::getFontMgr(context);
            const auto style = SkFontStyle::Normal();

            auto typeface = detail::getCachedTypeface(fontMgr.get(), nullptr, style);
            if (!typeface) {
                typeface = detail::getCachedTypeface(fontMgr.get(), "Arial", style);
            }

            sDefaultFont = SkFont(typeface, 14.0f);
        }

        this->props.font = *sDefaultFont;
    }

    void updateProps(const TextCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        ctx->canvas->translate(0, this->props.font->getSize());

        RNSkia::TextCmd::draw(ctx);
    }

private:
    static std::optional<SkFont> sDefaultFont;
};

class ImageCmd : public RNSkia::ImageCmd, public YogaNodeCommand {
public:
    ImageCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::ImageCmd(SkiaYoga::getPlatformContext(), runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;
    }

    void updateProps(const ImageCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.width = static_cast<float>(layout.width);
        this->props.height = static_cast<float>(layout.height);
        this->props.rect = SkRect::MakeXYWH(layout.left, layout.top, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::ImageCmd::draw(ctx); }
};

class PathCmd : public RNSkia::PathCmd, public YogaNodeCommand {
public:
    YogaNodeLayout _baseLayout;

    PathCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::PathCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
        , _basePath(this->props.path)
    {
        this->props.start = 0.0f;
        this->props.end = 1.0f;
    }

    void updateProps(const PathCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.path = _basePath;
        _baseLayout = layout;

        auto bounds = _basePath.getBounds();

        const auto transform = detail::calculateLayoutTransform(bounds, layout);
        this->props.path.transform(transform);
    }

    void setBasePath(const SkPath& path) { _basePath = path; }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        this->props.start = static_cast<float>(_trimStart.resolve().value_or(0.0));
        this->props.end = static_cast<float>(_trimEnd.resolve().value_or(1.0));
        RNSkia::PathCmd::draw(ctx);
    }
    bool isDynamic() const override
    {
        return _trimStart.isDynamic() || _trimEnd.isDynamic();
    }

private:
    SkPath _basePath;
    AnimatedDouble _trimEnd;
    AnimatedDouble _trimStart;
};

class LineCmd : public RNSkia::LineCmd, public YogaNodeCommand {
public:
    LineCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::LineCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
        , _baseP1(this->props.p1)
        , _baseP2(this->props.p2)
    {
    }

    void updateProps(const LineCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
        auto minX = std::min(_baseP1.x(), _baseP2.x());
        auto minY = std::min(_baseP1.y(), _baseP2.y());
        auto maxX = std::max(_baseP1.x(), _baseP2.x());
        auto maxY = std::max(_baseP1.y(), _baseP2.y());

        SkRect bounds = SkRect::MakeLTRB(minX, minY, maxX, maxY);

        const auto transform = detail::calculateLayoutTransform(bounds, layout);
        this->props.p1 = transform.mapPoint(_baseP1);
        this->props.p2 = transform.mapPoint(_baseP2);
    }

    void setBasePoint1(const ::SkPoint& p) { _baseP1 = p; }
    void setBasePoint2(const ::SkPoint& p) { _baseP2 = p; }
    const ::SkPoint& basePoint1() const { return _baseP1; }
    const ::SkPoint& basePoint2() const { return _baseP2; }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::LineCmd::draw(ctx); }

private:
    ::SkPoint _baseP1;
    ::SkPoint _baseP2;
};
class PointsCmd : public RNSkia::PointsCmd, public YogaNodeCommand {
public:
    PointsCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::PointsCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
        , _basePoints(this->props.points)
        , _baseBounds(computeBounds(_basePoints))
    {
        this->props.mode = SkCanvas::PointMode::kPoints_PointMode;
    }

    void updateProps(const PointsCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.points = _basePoints;

        if (_basePoints.empty()) {
            return;
        }

        const auto transform = detail::calculateLayoutTransform(_baseBounds, layout);

        const auto count = static_cast<size_t>(this->props.points.size());
        if (count > 0) {
            SkSpan<::SkPoint> span(this->props.points.data(), count);
            transform.mapPoints(span);
        }
    }

    void setBasePoints(const std::vector<::SkPoint>& points)
    {
        _basePoints = points;
        _baseBounds = computeBounds(_basePoints);
    }

    const std::vector<::SkPoint>& basePoints() const { return _basePoints; }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::PointsCmd::draw(ctx); }

private:
    static SkRect computeBounds(const std::vector<::SkPoint>& points)
    {
        if (points.empty()) {
            return SkRect::MakeEmpty();
        }

        float minX = std::numeric_limits<float>::max();
        float minY = std::numeric_limits<float>::max();
        float maxX = std::numeric_limits<float>::lowest();
        float maxY = std::numeric_limits<float>::lowest();

        for (const auto& p : points) {
            minX = std::min(minX, p.x());
            minY = std::min(minY, p.y());
            maxX = std::max(maxX, p.x());
            maxY = std::max(maxY, p.y());
        }

        if (minX == std::numeric_limits<float>::max() || minY == std::numeric_limits<float>::max()) {
            return SkRect::MakeEmpty();
        }
        return SkRect::MakeLTRB(minX, minY, maxX, maxY);
    }

    std::vector<::SkPoint> _basePoints;
    SkRect _baseBounds;
};

class ParagraphCmd : public RNSkia::ParagraphCmd, public YogaNodeCommand {
public:
    static constexpr float kInitialParagraphLayoutWidth = 100000.0f;

    ParagraphCmd(YogaNode* node, jsi::Runtime& runtime, RNSkia::Variables& variables)
        : RNSkia::ParagraphCmd(runtime, jsi::Object(runtime), variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;
    }

    void updateProps(const ParagraphCommandData& props);

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.width = layout.width;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        SkPaint debugPaint;
        const auto debugWidth = std::max(24.0f, this->props.width > 0 ? this->props.width : static_cast<float>(node->_layout.width));
        const auto debugHeight = std::max(24.0f, static_cast<float>(node->_layout.height));

        if (!this->props.paragraph) {
            debugPaint.setStyle(SkPaint::kFill_Style);
            debugPaint.setColor(SK_ColorRED);
            ctx->canvas->drawRect(
                SkRect::MakeXYWH(this->props.x, this->props.y, debugWidth, debugHeight),
                debugPaint);
            return;
        }

        auto paragraph = this->props.paragraph->getObject();
        auto layoutWidth = this->props.width > 0 ? this->props.width : kInitialParagraphLayoutWidth;
        paragraph->layout(layoutWidth);

        debugPaint.setStyle(SkPaint::kStroke_Style);
        debugPaint.setStrokeWidth(1.0f);
        debugPaint.setColor(SK_ColorYELLOW);
        ctx->canvas->drawRect(
            SkRect::MakeXYWH(
                this->props.x,
                this->props.y,
                debugWidth,
                std::max(debugHeight, paragraph->getHeight())),
            debugPaint);

        paragraph->paint(ctx->canvas, this->props.x, this->props.y);
    }

    static YGSize measureFunc(YGNodeConstRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode)
    {
        auto paragraph = static_cast<YogaNode*>(YGNodeGetContext(node));

        auto cmd = static_cast<ParagraphCmd*>(paragraph->_command.get());

        if (!cmd || !cmd->props.paragraph) {
            return YGSize { 0, 0 };
        }

        auto skParagraph = cmd->props.paragraph->getObject();
        auto layoutWidth = width;
        if (layoutWidth <= 0 || widthMode == YGMeasureModeUndefined) {
            skParagraph->layout(kInitialParagraphLayoutWidth);
            layoutWidth = skParagraph->getMaxIntrinsicWidth();
        }
        if (layoutWidth <= 0) {
            layoutWidth = skParagraph->getLongestLine();
        }
        if (layoutWidth <= 0) {
            return YGSize { 0, 0 };
        }

        skParagraph->layout(layoutWidth);
        auto measuredWidth = layoutWidth;
        if (widthMode == YGMeasureModeAtMost && width > 0) {
            measuredWidth = std::min(width, layoutWidth);
        }

        return YGSize { .width = measuredWidth, .height = skParagraph->getHeight() };
    }

    static void ensureDefaultParagraphResources();

    static std::mutex sParagraphBuilderMutex;
    static std::unique_ptr<para::ParagraphBuilder> sDefaultParagraphBuilder;
    static sk_sp<para::FontCollection> sDefaultFontCollection;
    static std::optional<para::ParagraphStyle> sDefaultParagraphStyle;
};

} // namespace margelo::nitro::RNSkiaYoga
