#pragma once

// Ensure JSIConverter specializations are visible before Nitro-generated headers
#include "JSIConverter+SkFont.hpp"
#include "JSIConverter+SkImage.hpp"
#include "JSIConverter+SkMatrix.hpp"
#include "JSIConverter+SkPaint.hpp"
#include "JSIConverter+SkPath.hpp"
#include "JSIConverter+SkRRect.hpp"
#include "JSIConverter+SkRect.hpp"

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include "SkiaYoga.hpp"
#include <algorithm>
#include <array>
#include <jsi/jsi.h>
#include <limits>
#include <memory>
#include <optional>
#include <mutex>
#include <functional>
#include <react-native-skia/cpp/api/JsiSkApi.h>
#include <react-native-skia/cpp/api/JsiSkFontMgrFactory.h>
#include <react-native-skia/cpp/api/JsiSkParagraph.h>
#include <react-native-skia/cpp/api/recorder/Command.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>
#include <react-native-skia/cpp/skia/include/core/SkSpan.h>
#include <react-native-skia/cpp/skia/include/core/SkFontMgr.h>
#include <react-native-skia/cpp/skia/include/core/SkTypeface.h>
#include <react-native-skia/cpp/skia/modules/skparagraph/include/FontCollection.h>
#include <react-native-skia/cpp/skia/modules/skparagraph/include/ParagraphBuilder.h>
#include <react-native-skia/cpp/skia/modules/skparagraph/include/ParagraphStyle.h>
#include <react-native-skia/cpp/skia/include/private/base/SkTypeTraits.h>
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
            std::size_t hash = std::hash<std::string>{}(key.name);
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
            std::size_t hash = std::hash<int>{}(key.weight);
            hash ^= (std::hash<int>{}(key.width) + 0x9e3779b9 + (hash << 6) + (hash >> 2));
            hash ^= (std::hash<int>{}(static_cast<int>(key.slant)) + 0x9e3779b9 + (hash << 6) + (hash >> 2));
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

} // namespace detail

class YogaNodeCommand {
public:
    virtual ~YogaNodeCommand() = default;

    // reine virtuelle Schnittstelle
    virtual void setLayout(const YogaNodeLayout& layout) = 0;
    virtual void draw(RNSkia::DrawingCtx* ctx) = 0;

protected:
    explicit YogaNodeCommand(YogaNode* node)
        : node(node)
    {
    }

    YogaNode* node;
};

class YogaNode : public HybridYogaNodeSpec {
public:
    // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
    YogaNode();
    ~YogaNode();
    void setStyle(const NodeStyle& style) override;
    void setType(NodeType type) override;
    void insertChild(const std::shared_ptr<HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<HybridYogaNodeSpec>>>& index) override;
    void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;
    std::vector<std::shared_ptr<HybridYogaNodeSpec>> getChildren() override;
    void setChildren(const std::vector<std::shared_ptr<HybridYogaNodeSpec>>& children) override;

    void computeLayout(std::optional<double> width, std::optional<double> height) override;
    void recursiveSetLayout();
    YogaNodeLayout getLayout() override;
    void setLayout(const YogaNodeLayout& layout) override;

    void removeAllChildren() override;

    jsi::Value setType(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    jsi::Value setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    jsi::Value draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    void drawInternal(RNSkia::DrawingCtx& ctx);

    std::string getName() const { return "YogaNode"; }

    YGNodeRef _node;
    NodeType _type;
    YogaNodeLayout _layout;
    std::unique_ptr<YogaNodeCommand> _command;
    std::vector<std::shared_ptr<YogaNode>> _children;
    NodeStyle _style;
    SkPaint _paint;
    std::optional<SkPaint> _layerPaint;
    std::optional<SkPath> _clipPath;
    std::optional<SkRRect> _clipRRect;
    std::optional<std::array<SkVector, 4>> _clipRRectRadii;
    std::optional<SkRect> _clipRect;
    std::shared_ptr<SkMatrix> _matrix;

    void loadHybridMethods() override
    {
        // register base protoype
        HybridYogaNodeSpec::loadHybridMethods();
        // register all methods we override here
        registerHybrids(this, [](Prototype& prototype) {
            prototype.registerRawHybridMethod("setProps", 1, &YogaNode::setProps);
            prototype.registerRawHybridMethod("draw", 1, &YogaNode::draw);
            prototype.registerRawHybridMethod("setType", 1, &YogaNode::setType);
        });
    }
};

class RectCmd : public RNSkia::RectCmd, public YogaNodeCommand {
public:
    RectCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RectCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.rect = SkRect::MakeXYWH(0, 0, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::RectCmd::draw(ctx); }
};

class RRectCmd : public RNSkia::RRectCmd, public YogaNodeCommand {
public:
    RRectCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RRectCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        auto radius = this->props.r.value_or(RNSkia::Radius { 0, 0 });
        this->props.rect = SkRRect::MakeRectXY(SkRect::MakeXYWH(0, 0, layout.width, layout.height), radius.rX, radius.rY);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::RRectCmd::draw(ctx); }
};

class OvalCmd : public RNSkia::OvalCmd, public YogaNodeCommand {
public:
    OvalCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::OvalCmd(runtime, props, variables)
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

class TextCmd : public RNSkia::TextCmd, public YogaNodeCommand {
public:


    TextCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::TextCmd(runtime, props, variables)
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

    void setLayout(const YogaNodeLayout& layout) override
    {
    }

    void draw(RNSkia::DrawingCtx* ctx) override {
        ctx->canvas->translate(0, this->props.font->getSize());

        RNSkia::TextCmd::draw(ctx);
    }
private:
    static std::optional<SkFont> sDefaultFont;
};

class ImageCmd : public RNSkia::ImageCmd, public YogaNodeCommand {
public:
    ImageCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ImageCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;
    }

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

    PathCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::PathCmd(runtime, props, variables)
        , YogaNodeCommand(node)
        , _basePath(this->props.path)
    {
        this->props.start = 0.0f;
        this->props.end = 1.0f;
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.path = _basePath;
        _baseLayout = layout;

        auto bounds = _basePath.getBounds();

        const auto transform = detail::calculateLayoutTransform(bounds, layout);
        this->props.path.transform(transform);
    }

    void setBasePath(const SkPath& path) { _basePath = path; }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::PathCmd::draw(ctx); }

private:
    SkPath _basePath;
};

class LineCmd : public RNSkia::LineCmd, public YogaNodeCommand {
public:
    LineCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::LineCmd(runtime, props, variables)
        , YogaNodeCommand(node)
        , _baseP1(this->props.p1)
        , _baseP2(this->props.p2)
    {
    }

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
    PointsCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::PointsCmd(runtime, props, variables)
        , YogaNodeCommand(node)
        , _basePoints(this->props.points)
        , _baseBounds(computeBounds(_basePoints))
    {
    }

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
    ParagraphCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ParagraphCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.width = layout.width;
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::ParagraphCmd::draw(ctx); }

    static YGSize measureFunc(YGNodeConstRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode)
    {
        auto paragraph = static_cast<YogaNode*>(YGNodeGetContext(node));

        auto cmd = static_cast<ParagraphCmd*>(paragraph->_command.get());

        if (!cmd || !cmd->props.paragraph) {
            return YGSize { 0, 0 };
        }

        auto skParagraph = cmd->props.paragraph->getObject();
        if (width <= 0 || widthMode == YGMeasureModeUndefined) {
            width = 20000000.0f; // very large width
        }

        skParagraph->layout(width);
        auto sz = skParagraph->getHeight();
        return YGSize { width, sz };
    }

    static void ensureDefaultParagraphResources();

    static std::mutex sParagraphBuilderMutex;
    static std::unique_ptr<para::ParagraphBuilder> sDefaultParagraphBuilder;
    static sk_sp<para::FontCollection> sDefaultFontCollection;
    static std::optional<para::ParagraphStyle> sDefaultParagraphStyle;
};

} // namespace margelo::nitro::RNSkiaYoga
