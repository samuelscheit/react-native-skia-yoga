#include "SkiaYoga.hpp"
#include "PlatformContextAccessor.hpp"
#include <jsi/jsi.h>
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

// Factory used by generated RNSkiaYogaOnLoad.cpp to avoid including headers there
std::shared_ptr<margelo::nitro::HybridObject> CreateSkiaYoga()
{
    return std::make_shared<SkiaYoga>();
}

} // namespace margelo::nitro::RNSkiaYoga
