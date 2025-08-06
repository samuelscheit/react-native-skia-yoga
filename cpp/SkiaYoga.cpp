#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <jsi/jsi.h>
#include "SkiaYoga.hpp"
#include <yoga/Yoga.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

SkiaYoga::SkiaYoga()
: HybridObject(HybridSkiaYogaSpec::TAG) // wichtig: TAG der Spezifikation
{}

SkiaYoga::~SkiaYoga() = default;

double SkiaYoga::addNumbers(double a, double b) {
    return a + b;
}



} // namespace margelo::nitro::RNSkiaYoga
