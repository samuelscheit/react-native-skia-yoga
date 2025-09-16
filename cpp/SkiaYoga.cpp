#include "SkiaYoga.hpp"
#include <jsi/jsi.h>
#include <yoga/Yoga.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

// Define static member (base platform context)
std::shared_ptr<RNSkia::RNSkPlatformContext> SkiaYoga::platformContext = nullptr;

SkiaYoga::SkiaYoga()
: HybridObject(HybridSkiaYogaSpec::TAG) // wichtig: TAG der Spezifikation
{}

SkiaYoga::~SkiaYoga() = default;

double SkiaYoga::addNumbers(double a, double b) {
    return a + b;
}



} // namespace margelo::nitro::RNSkiaYoga
