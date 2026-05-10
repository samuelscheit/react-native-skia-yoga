#include "JSIConverter+AnimatedDouble.hpp"

#include "RuntimeAwareCache.h"
#include "SharedItems/Serializable.h"
#include "SharedItems/Synchronizable.h"

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

namespace {

std::shared_ptr<worklets::SerializableJSRef> extractSerializableRefOrThrow(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "AnimatedDouble object must be a Worklets SerializableJSRef.");
    }

    auto object = value.asObject(runtime);
    if (!object.hasNativeState(runtime)) {
        throw jsi::JSError(runtime, "AnimatedDouble object must be a Worklets SerializableJSRef.");
    }

    auto nativeState = object.getNativeState(runtime);
    auto serializableRef = std::dynamic_pointer_cast<worklets::SerializableJSRef>(nativeState);
    if (!serializableRef) {
        throw jsi::JSError(runtime, "AnimatedDouble object must be a Worklets SerializableJSRef.");
    }

    return serializableRef;
}

} // namespace

std::shared_ptr<worklets::Synchronizable> extractAnimatedSynchronizable(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    auto serializableRef = extractSerializableRefOrThrow(runtime, value);
    auto synchronizable = std::dynamic_pointer_cast<worklets::Synchronizable>(serializableRef->value());
    if (!synchronizable) {
        throw jsi::JSError(runtime, "AnimatedDouble object must contain a Worklets Synchronizable.");
    }

    return synchronizable;
}

bool canExtractAnimatedSynchronizable(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
    try {
        extractAnimatedSynchronizable(runtime, value);
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
