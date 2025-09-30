#pragma once

#include "SkiaGlue.hpp"
#include "SkiaYoga.hpp"
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


#include "ColorParser.hpp"
// Use generated RN Skia headers directly (no api/ or recorder/ prefixes)
// Important: Include JsiSkSkottie before Convertor.h (included by Drawings.h)
// because Convertor.h references JsiSkSkottie in template specializations.
#include "JsiSkSkottie.h"
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

} // namespace detail

class YogaNodeCommand {
public:
    virtual ~YogaNodeCommand() = default;

    // reine virtuelle Schnittstelle
    virtual void setLayout(const YogaNodeLayout& layout) = 0;
    virtual void draw(RNSkia::DrawingCtx* ctx) = 0;
    virtual void updateProps(jsi::Runtime& runtime, const jsi::Object& props)
    {
        (void)runtime;
        (void)props;
    }

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

    jsi::Value getChildren(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

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
    bool _hasLayoutBeenComputed = false;
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
};

struct BlurMaskFilterProps {
    float blur = 0.0f;
    SkBlurStyle style = SkBlurStyle::kNormal_SkBlurStyle;
    bool respectCTM = false;
};

class BlurMaskFilterCmd : public YogaNodeCommand {
public:
    BlurMaskFilterCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& /*variables*/)
        : YogaNodeCommand(node)
    {
        updateProps(runtime, props);
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        (void)layout;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        auto maskFilter = SkMaskFilter::MakeBlur(_props.style, _props.blur, _props.respectCTM);
        ctx->getPaint().setMaskFilter(maskFilter);
    }

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        if (props.hasProperty(runtime, "blur")) {
            auto value = props.getProperty(runtime, "blur");
            if (!value.isUndefined() && !value.isNull()) {
                _props.blur = RNSkia::getPropertyValue<float>(runtime, value);
            }
        }

        if (props.hasProperty(runtime, "style")) {
            auto value = props.getProperty(runtime, "style");
            if (!value.isUndefined() && !value.isNull()) {
                _props.style = RNSkia::getPropertyValue<SkBlurStyle>(runtime, value);
            }
        }

        if (props.hasProperty(runtime, "respectCTM")) {
            auto value = props.getProperty(runtime, "respectCTM");
            if (!value.isUndefined() && !value.isNull()) {
                _props.respectCTM = RNSkia::getPropertyValue<bool>(runtime, value);
            }
        }
    }

private:
    BlurMaskFilterProps _props;
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

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        if (!this->props.rect.has_value()) {
            throw std::runtime_error("Call computeLayout before drawing");
        }
        RNSkia::RectCmd::draw(ctx);
    }
};

class RRectCmd : public RNSkia::RRectCmd, public YogaNodeCommand {
public:
    RRectCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RRectCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        auto radiusValue = props.getProperty(runtime, "r");
        auto radius = JSIConverter<std::optional<double>>::fromJSI(runtime, radiusValue);
        auto r = static_cast<float>(radius.value_or(0.0));
        this->props.r = RNSkia::Radius { .rX = r, .rY = r };
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

class CircleCmd : public RNSkia::CircleCmd, public YogaNodeCommand {
public:
    CircleCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::CircleCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        if (props.hasProperty(runtime, "r")) {
            const auto radiusValue = props.getProperty(runtime, "r");
            if (radiusValue.isNull() || radiusValue.isUndefined()) {
                clearRadius();
            } else if (radiusValue.isNumber()) {
                setRadius(static_cast<float>(radiusValue.asNumber()));
            }

            setLayout(node->_layout);
        }
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
        RNSkia::CircleCmd::draw(ctx);
    }


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
    bool _hasExplicitRadius = false;
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

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        auto textValue = props.getProperty(runtime, "children");
        auto text = JSIConverter<std::optional<std::string>>::fromJSI(runtime, textValue);
        this->props.text = text.value_or("");

        auto fontValue = props.getProperty(runtime, "font");
        auto fontOptional = JSIConverter<std::optional<SkFont>>::fromJSI(runtime, fontValue);
        if (fontOptional.has_value()) {
            this->props.font = fontOptional;
        }

        auto font = this->props.font;
        auto textStyle = skia::textlayout::TextStyle();

        auto styleValue = props.getProperty(runtime, "style");
        if (styleValue.isObject()) {
            auto styleObject = styleValue.asObject(runtime);

            auto skColor = textStyle.getColor();
            auto colorValue = styleObject.getProperty(runtime, "color");
            if (colorValue.isString()) {
                if (auto parsed = parseCssColor(colorValue.asString(runtime).utf8(runtime))) {
                    skColor = *parsed;
                }
            } else if (colorValue.isNumber()) {
                skColor = static_cast<SkColor>(colorValue.asNumber());
            }
            styleObject.setProperty(runtime, "color", RNSkia::JsiSkColor::toValue(runtime, skColor));

            textStyle = RNSkia::JsiSkTextStyle::fromValue(runtime, styleValue);
        }

        if (font.has_value()) {
            font->setSize(textStyle.getFontSize());
            this->props.font = font;
        }

        node->_paint.setColor(textStyle.getColor());
    }

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
    ImageCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ImageCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
        this->props.x = 0;
        this->props.y = 0;
    }

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        if (props.hasProperty(runtime, "image")) {
            const auto imageValue = props.getProperty(runtime, "image");
            auto image = JSIConverter<sk_sp<SkImage>>::fromJSI(runtime, imageValue);
            if (image) {
                this->props.image = image;
            } else {
                this->props.image.reset();
            }
        }

        if (props.hasProperty(runtime, "sampling")) {
            const auto samplingValue = props.getProperty(runtime, "sampling");
            if (samplingValue.isNull() || samplingValue.isUndefined()) {
                this->props.sampling.reset();
            } else {
                this->props.sampling = RNSkia::SamplingOptionsFromValue(runtime, samplingValue);
            }
        }

        if (props.hasProperty(runtime, "fit")) {
            const auto fitValue = props.getProperty(runtime, "fit");
            if (fitValue.isString()) {
                this->props.fit = fitValue.asString(runtime).utf8(runtime);
            }
        } else if (this->props.fit.empty()) {
            this->props.fit = "contain";
        }
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

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        bool layoutNeedsUpdate = false;

        if (props.hasProperty(runtime, "path")) {
            auto pathValue = props.getProperty(runtime, "path");
            if (pathValue.isObject()) {
                auto newPath = JSIConverter<SkPath>::fromJSI(runtime, pathValue);
                setBasePath(newPath);
                layoutNeedsUpdate = true;
            }
        }

        if (props.hasProperty(runtime, "start")) {
            const auto startValue = props.getProperty(runtime, "start");
            if (startValue.isNumber()) {
                this->props.start = static_cast<float>(startValue.asNumber());
            }
        }

        if (props.hasProperty(runtime, "end")) {
            const auto endValue = props.getProperty(runtime, "end");
            if (endValue.isNumber()) {
                this->props.end = static_cast<float>(endValue.asNumber());
            }
        }

        if (props.hasProperty(runtime, "stroke")) {
            const auto strokeValue = props.getProperty(runtime, "stroke");
            if (strokeValue.isNull() || strokeValue.isUndefined()) {
                this->props.stroke.reset();
            } else if (strokeValue.isObject()) {
                this->props.stroke = RNSkia::getPropertyValue<RNSkia::StrokeOpts>(runtime, strokeValue);
            }
        }

        if (props.hasProperty(runtime, "fillType")) {
            const auto fillValue = props.getProperty(runtime, "fillType");
            if (fillValue.isNull() || fillValue.isUndefined()) {
                this->props.fillType.reset();
            } else if (fillValue.isNumber()) {
                this->props.fillType = static_cast<SkPathFillType>(static_cast<int>(fillValue.asNumber()));
            }
        }

        if (layoutNeedsUpdate) {
            setLayout(node->_layout);
        }
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

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        bool updated = false;

        if (props.hasProperty(runtime, "p1")) {
            const auto p1Value = props.getProperty(runtime, "p1");
            if (p1Value.isObject()) {
                const auto p1 = RNSkia::getPropertyValue<::SkPoint>(runtime, p1Value);
                setBasePoint1(p1);
                updated = true;
            }
        }

        if (props.hasProperty(runtime, "p2")) {
            const auto p2Value = props.getProperty(runtime, "p2");
            if (p2Value.isObject()) {
                const auto p2 = RNSkia::getPropertyValue<::SkPoint>(runtime, p2Value);
                setBasePoint2(p2);
                updated = true;
            }
        }

        if (updated) {
            setLayout(node->_layout);
        }
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

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        bool didUpdateLayout = false;

        if (props.hasProperty(runtime, "points")) {
            const auto pointsValue = props.getProperty(runtime, "points");
            if (pointsValue.isObject()) {
                const auto points = RNSkia::getPropertyValue<std::vector<::SkPoint>>(runtime, pointsValue);
                setBasePoints(points);
                didUpdateLayout = true;
            }
        }

        if (props.hasProperty(runtime, "mode")) {
            const auto modeValue = props.getProperty(runtime, "mode");
            this->props.mode = RNSkia::getPropertyValue<SkCanvas::PointMode>(runtime, modeValue);
        }

        if (didUpdateLayout) {
            setLayout(node->_layout);
        }
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

    void updateProps(jsi::Runtime& runtime, const jsi::Object& props) override
    {
        auto textValue = props.getProperty(runtime, "children");
        auto text = JSIConverter<std::optional<std::string>>::fromJSI(runtime, textValue);

        if (props.hasProperty(runtime, "paragraph")) {
            auto paragraphValue = props.getProperty(runtime, "paragraph");
            if (paragraphValue.isObject()) {
                this->props.paragraph = paragraphValue.asObject(runtime).getHostObject<RNSkia::JsiSkParagraph>(runtime);
            }
            return;
        }

        ensureDefaultParagraphResources();
        std::lock_guard<std::mutex> lock(sParagraphBuilderMutex);
        auto* builder = sDefaultParagraphBuilder.get();
        if (builder == nullptr) {
            return;
        }
        builder->Reset();

        auto textStyle = skia::textlayout::TextStyle();

        auto styleValue = props.getProperty(runtime, "style");
        if (styleValue.isObject()) {
            auto styleObject = styleValue.asObject(runtime);

            auto skColor = textStyle.getColor();
            auto colorValue = styleObject.getProperty(runtime, "color");
            if (colorValue.isString()) {
                if (auto parsed = parseCssColor(colorValue.asString(runtime).utf8(runtime))) {
                    skColor = *parsed;
                }
            } else if (colorValue.isNumber()) {
                skColor = static_cast<SkColor>(colorValue.asNumber());
            }
            styleObject.setProperty(runtime, "color", RNSkia::JsiSkColor::toValue(runtime, skColor));

            textStyle = RNSkia::JsiSkTextStyle::fromValue(runtime, styleValue);

            if (!styleObject.hasProperty(runtime, "color")) {
                textStyle.setColor(SK_ColorBLACK);
            }

            auto paragraphStyle = RNSkia::JsiSkParagraphStyle::fromValue(runtime, styleValue);
            const auto& currentStyle = builder->getParagraphStyle();
            const bool paragraphStyleChanged = paragraphStyle.getTextAlign() != currentStyle.getTextAlign() || paragraphStyle.getTextDirection() != currentStyle.getTextDirection() || paragraphStyle.getMaxLines() != currentStyle.getMaxLines() || paragraphStyle.getEllipsis() != currentStyle.getEllipsis() || paragraphStyle.getTextHeightBehavior() != currentStyle.getTextHeightBehavior();

            if (paragraphStyleChanged) {
                sDefaultParagraphBuilder = para::ParagraphBuilder::make(paragraphStyle, sDefaultFontCollection);
                builder = sDefaultParagraphBuilder.get();
                if (builder == nullptr) {
                    return;
                }
            }
        } else {
            textStyle.setFontFamilies({ SkString("Arial") });
            textStyle.setFontSize(14.0f);
            textStyle.setColor(SK_ColorBLACK);
        }
        builder->Reset();
        builder->pushStyle(textStyle);

        auto textStr = text.value_or("");

        builder->addText(textStr.c_str(), textStr.size());

        auto context = margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext();
        auto paragraph = std::make_shared<RNSkia::JsiSkParagraph>(context, builder);
        this->props.paragraph = paragraph;
        builder->Reset();
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
            // width = 20000000.0f; // very large width
        }

        skParagraph->layout(width);
        auto sz = skParagraph->getHeight();
        auto sw = skParagraph->getMaxWidth();
        return YGSize { .width = width, .height =  sz };
    }

    static void ensureDefaultParagraphResources();

    static std::mutex sParagraphBuilderMutex;
    static std::unique_ptr<para::ParagraphBuilder> sDefaultParagraphBuilder;
    static sk_sp<para::FontCollection> sDefaultFontCollection;
    static std::optional<para::ParagraphStyle> sDefaultParagraphStyle;
};

} // namespace margelo::nitro::RNSkiaYoga
