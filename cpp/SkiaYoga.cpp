#include "SkiaYoga.hpp"
#include "JsiPromises.h"
#include "PlatformContextAccessor.hpp"
#include "RNSkJsiViewApi.h"
#include "RNSkYogaView.hpp"
#include "YogaNode.hpp"
#include <jsi/jsi.h>
#include <sstream>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

// Define static member (base platform context)
std::shared_ptr<RNSkia::RNSkPlatformContext> SkiaYoga::platformContext = nullptr;
// keep accessor in sync if someone sets platformContext directly
static struct SyncAccessorInit {
    SyncAccessorInit()
    {
        if (SkiaYoga::platformContext)
            SetPlatformContext(SkiaYoga::platformContext);
    }
} s_syncAccessorInit;

SkiaYoga::SkiaYoga()
    : HybridObject(HybridSkiaYogaSpec::TAG) // wichtig: TAG der Spezifikation
{
}

SkiaYoga::~SkiaYoga() = default;

namespace {

size_t resolveNativeId(double nativeId)
{
    return static_cast<size_t>(nativeId);
}

std::shared_ptr<RNSkYogaView> getYogaView(double nativeId)
{
    return RNSkia::ViewRegistry::getInstance().withViewInfo(
        resolveNativeId(nativeId),
        [](const std::shared_ptr<RNSkia::RNSkViewInfo>& info) {
            if (info == nullptr || info->view == nullptr) {
                return std::shared_ptr<RNSkYogaView> {};
            }
            return std::dynamic_pointer_cast<RNSkYogaView>(info->view);
        });
}

std::shared_ptr<YogaNode> getYogaNode(
    const std::shared_ptr<HybridYogaNodeSpec>& root)
{
    if (root == nullptr) {
        return nullptr;
    }
    return std::dynamic_pointer_cast<YogaNode>(root);
}

std::string serializeProfileSample(const RNSkYogaProfilingSample& sample)
{
    std::ostringstream stream;
    stream << "{";
    stream << "\"avgDrawMs\":" << sample.avgDrawMs << ",";
    stream << "\"avgPresentMs\":" << sample.avgPresentMs << ",";
    stream << "\"frames\":" << sample.frames << ",";
    stream << "\"maxDrawMs\":" << sample.maxDrawMs << ",";
    stream << "\"maxPresentMs\":" << sample.maxPresentMs << ",";
    stream << "\"sampleDurationMs\":" << sample.sampleDurationMs;
    stream << "}";
    return stream.str();
}

} // namespace

void SkiaYoga::attachViewRoot(
    double nativeId,
    const std::shared_ptr<HybridYogaNodeSpec>& root)
{
    auto view = getYogaView(nativeId);
    if (view == nullptr) {
        return;
    }
    view->setRoot(getYogaNode(root));
}

void SkiaYoga::detachViewRoot(double nativeId)
{
    auto view = getYogaView(nativeId);
    if (view == nullptr) {
        return;
    }
    view->setAnimating(false);
    view->setRoot(nullptr);
}

void SkiaYoga::requestViewRender(double nativeId)
{
    auto view = getYogaView(nativeId);
    if (view == nullptr) {
        return;
    }
    view->requestRender();
}

void SkiaYoga::setViewAnimating(double nativeId, bool animating)
{
    auto view = getYogaView(nativeId);
    if (view == nullptr) {
        return;
    }
    view->setAnimating(animating);
}

std::string SkiaYoga::consumeViewProfileSample(double nativeId)
{
    auto view = getYogaView(nativeId);
    if (view == nullptr) {
        return "{}";
    }

    const auto sample = view->consumeProfilingSample();
    return serializeProfileSample(sample);
}

// Factory used by generated RNSkiaYogaOnLoad.cpp to avoid including headers there
std::shared_ptr<margelo::nitro::HybridObject> CreateSkiaYoga()
{
    return std::make_shared<SkiaYoga>();
}

} // namespace margelo::nitro::RNSkiaYoga
