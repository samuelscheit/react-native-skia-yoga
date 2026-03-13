#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include "RuntimeAwareCache.h"
#include <NitroModules/JSIConverter+Optional.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <optional>

namespace worklets {
class Synchronizable;
} // namespace worklets

namespace margelo::nitro::RNSkiaYoga {

std::shared_ptr<worklets::Synchronizable> extractAnimatedSynchronizable(
    facebook::jsi::Runtime& runtime,
    const facebook::jsi::Value& value);
bool canExtractAnimatedSynchronizable(
    facebook::jsi::Runtime& runtime,
    const facebook::jsi::Value& value);
std::optional<double> resolveAnimatedSynchronizable(
    const std::shared_ptr<worklets::Synchronizable>& synchronizable,
    const std::optional<double>& fallback);

struct AnimatedDouble {
    std::optional<double> value;
    std::shared_ptr<worklets::Synchronizable> synchronizable;

    bool isDynamic() const
    {
        return synchronizable != nullptr;
    }

    std::optional<double> resolve() const
    {
        return resolveAnimatedSynchronizable(synchronizable, value);
    }
};

} // namespace margelo::nitro::RNSkiaYoga

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<margelo::nitro::RNSkiaYoga::AnimatedDouble> final {
    static inline margelo::nitro::RNSkiaYoga::AnimatedDouble fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    {
        using AnimatedDouble = margelo::nitro::RNSkiaYoga::AnimatedDouble;

        if (arg.isUndefined() || arg.isNull()) {
            return AnimatedDouble {};
        }

        if (JSIConverter<double>::canConvert(runtime, arg)) {
            return AnimatedDouble {
                .value = JSIConverter<double>::fromJSI(runtime, arg),
            };
        }

        if (arg.isObject()) {
            return AnimatedDouble {
                .synchronizable = margelo::nitro::RNSkiaYoga::extractAnimatedSynchronizable(runtime, arg),
            };
        }

        throw jsi::JSError(runtime, "AnimatedDouble must be a number, synchronizable, null, or undefined.");
    }

    static inline jsi::Value toJSI(jsi::Runtime& runtime, const margelo::nitro::RNSkiaYoga::AnimatedDouble& arg)
    {
        return JSIConverter<std::optional<double>>::toJSI(runtime, arg.resolve());
    }

    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    {
        if (value.isUndefined() || value.isNull()) {
            return true;
        }

        if (JSIConverter<double>::canConvert(runtime, value)) {
            return true;
        }

        if (!value.isObject()) {
            return false;
        }

        return margelo::nitro::RNSkiaYoga::canExtractAnimatedSynchronizable(runtime, value);
    }
};

} // namespace margelo::nitro
