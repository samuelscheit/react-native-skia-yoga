// Lightweight CSS color parser for Skia
#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "SkColor.h"

namespace margelo::nitro::RNSkiaYoga {

// Parses common CSS color formats into an SkColor (sRGB, unpremultiplied).
// Supported:
// - Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA (alpha last, per CSS)
// - rgb(r,g,b), rgba(r,g,b,a)
//   • r,g,b: 0-255 or 0%-100%
//   • a: 0-1, 0-255, or 0%-100%
// - rgb(r g b / a) (space-separated with optional slash alpha)
// - hsl(h, s%, l%), hsla(h, s%, l%, a)
//   • h in degrees
//   • s,l in percent
// - Named colors (subset): black, white, red, green, blue, yellow,
//   cyan/aqua, magenta/fuchsia, gray/grey, lightgray/lightgrey,
//   darkgray/darkgrey, orange, purple, pink, brown, navy, teal,
//   olive, maroon, silver, lime, rebeccapurple, transparent
// Returns std::nullopt if parsing fails.
std::optional<SkColor> parseCssColor(std::string_view input);

} // namespace margelo::nitro::RNSkiaYoga

