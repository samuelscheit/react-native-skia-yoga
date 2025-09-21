#include "SkiaYoga.hpp"
#include <jsi/jsi.h>
#include <yoga/Yoga.h>
#include "PlatformContextAccessor.hpp"

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

// Define static member (base platform context)
std::shared_ptr<RNSkia::RNSkPlatformContext> SkiaYoga::platformContext = nullptr;
// keep accessor in sync if someone sets platformContext directly
static struct SyncAccessorInit {
  SyncAccessorInit() {
    if (SkiaYoga::platformContext) SetPlatformContext(SkiaYoga::platformContext);
  }
} s_syncAccessorInit;

SkiaYoga::SkiaYoga()
: HybridObject(HybridSkiaYogaSpec::TAG) // wichtig: TAG der Spezifikation
{}

SkiaYoga::~SkiaYoga() = default;

double SkiaYoga::addNumbers(double a, double b) {
    return a + b;
}



} // namespace margelo::nitro::RNSkiaYoga
