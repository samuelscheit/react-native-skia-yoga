#include "JSIConverter+AnimatedDouble.hpp"

#include "RuntimeAwareCache.h"
#include "SharedItems/Serializable.h"
#include "SharedItems/Synchronizable.h"

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

std::shared_ptr<worklets::Synchronizable> extractAnimatedSynchronizable(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    return worklets::extractSynchronizableOrThrow(runtime, value);
}

bool canExtractAnimatedSynchronizable(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    try {
        worklets::extractSynchronizableOrThrow(runtime, value);
        return true;
    } catch (...) {
        return false;
    }
}

std::optional<double> resolveAnimatedSynchronizable(
    const std::shared_ptr<worklets::Synchronizable>& synchronizable,
    const std::optional<double>& fallback)
{
    if (!synchronizable) {
        return fallback;
    }

    auto* runtime = RNJsi::BaseRuntimeAwareCache::getMainJsRuntime();
    if (runtime == nullptr) {
        return fallback;
    }

    auto blockingValue = synchronizable->getBlocking();
    auto currentValue = blockingValue->toJSValue(*runtime);
    return JSIConverter<std::optional<double>>::fromJSI(*runtime, currentValue);
}

} // namespace margelo::nitro::RNSkiaYoga
