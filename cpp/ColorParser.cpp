// Lightweight CSS color parser for Skia

#include "ColorParser.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstring>
#include <unordered_map>

namespace margelo::nitro::RNSkiaYoga {

namespace {

inline std::string toLower(std::string_view sv) {
  std::string s(sv);
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) {
    return static_cast<char>(std::tolower(c));
  });
  return s;
}

inline void trim(std::string& s) {
  auto notSpace = [](unsigned char c) { return !std::isspace(c); };
  s.erase(s.begin(), std::find_if(s.begin(), s.end(), notSpace));
  s.erase(std::find_if(s.rbegin(), s.rend(), notSpace).base(), s.end());
}

inline bool isHex(unsigned char c) {
  return std::isxdigit(c) != 0;
}

inline int hexVal(unsigned char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
  if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
  return 0;
}

inline int clampInt(int v, int lo, int hi) {
  return std::max(lo, std::min(v, hi));
}

inline float clampFloat(float v, float lo, float hi) {
  return std::max(lo, std::min(v, hi));
}

inline int percentToByte(float p) { // 0..100 -> 0..255
  return clampInt(static_cast<int>(std::round(p * 2.55f)), 0, 255);
}

inline int floatToByte(float v) { // 0..1 -> 0..255
  return clampInt(static_cast<int>(std::round(v * 255.0f)), 0, 255);
}

inline bool parseInt(std::string_view sv, int& out) {
  try {
    std::string s(sv);
    trim(s);
    if (s.empty()) return false;
    size_t idx = 0;
    int val = std::stoi(s, &idx, 10);
    if (idx != s.size()) return false;
    out = val;
    return true;
  } catch (...) {
    return false;
  }
}

inline bool parseFloat(std::string_view sv, float& out) {
  try {
    std::string s(sv);
    trim(s);
    if (s.empty()) return false;
    size_t idx = 0;
    float val = std::stof(s, &idx);
    if (idx != s.size()) return false;
    out = val;
    return true;
  } catch (...) {
    return false;
  }
}

inline std::vector<std::string> splitByChars(std::string_view sv, const char* delims) {
  std::vector<std::string> out;
  std::string token;
  for (char c : std::string(sv)) {
    if (std::strchr(delims, c)) {
      if (!token.empty()) {
        out.push_back(token);
        token.clear();
      } else {
        // skip
      }
    } else {
      token.push_back(c);
    }
  }
  if (!token.empty()) out.push_back(token);
  // trim each
  for (auto& s : out) trim(s);
  return out;
}

inline bool parseHexColor(std::string_view sv, SkColor& out) {
  // Supported: #RGB, #RGBA, #RRGGBB, #RRGGBBAA (alpha last per CSS)
  if (sv.size() < 4 || sv[0] != '#') return false;
  auto hex = std::string(sv.substr(1));
  // validate hex
  for (char c : hex) {
    if (!isHex(static_cast<unsigned char>(c))) return false;
  }
  if (hex.size() == 3) {
    int r = hexVal(hex[0]);
    int g = hexVal(hex[1]);
    int b = hexVal(hex[2]);
    r = (r << 4) | r; // duplicate nibble
    g = (g << 4) | g;
    b = (b << 4) | b;
    out = SkColorSetARGB(255, r, g, b);
    return true;
  } else if (hex.size() == 4) {
    int r = hexVal(hex[0]);
    int g = hexVal(hex[1]);
    int b = hexVal(hex[2]);
    int a = hexVal(hex[3]);
    r = (r << 4) | r;
    g = (g << 4) | g;
    b = (b << 4) | b;
    a = (a << 4) | a;
    out = SkColorSetARGB(a, r, g, b);
    return true;
  } else if (hex.size() == 6) {
    int r = (hexVal(hex[0]) << 4) | hexVal(hex[1]);
    int g = (hexVal(hex[2]) << 4) | hexVal(hex[3]);
    int b = (hexVal(hex[4]) << 4) | hexVal(hex[5]);
    out = SkColorSetARGB(255, r, g, b);
    return true;
  } else if (hex.size() == 8) {
    // CSS: RRGGBBAA (alpha last)
    int r = (hexVal(hex[0]) << 4) | hexVal(hex[1]);
    int g = (hexVal(hex[2]) << 4) | hexVal(hex[3]);
    int b = (hexVal(hex[4]) << 4) | hexVal(hex[5]);
    int a = (hexVal(hex[6]) << 4) | hexVal(hex[7]);
    out = SkColorSetARGB(a, r, g, b);
    return true;
  }
  return false;
}

inline bool parseRgbLike(std::string_view sv, SkColor& out) {
  // Handles rgb()/rgba() and space-separated syntax with optional '/ a'
  // Normalize: lowercase, remove surrounding spaces, ensure parentheses
  std::string s = toLower(sv);
  trim(s);
  auto open = s.find('(');
  auto close = s.rfind(')');
  if (open == std::string::npos || close == std::string::npos || close <= open)
    return false;
  auto fn = s.substr(0, open);
  auto args = s.substr(open + 1, close - open - 1);
  trim(args);

  if (fn != "rgb" && fn != "rgba") return false;

  // Detect slash alpha
  std::string argsStr(args);
  // Replace commas with spaces for easier tokenizing
  std::replace(argsStr.begin(), argsStr.end(), ',', ' ');

  float a = 1.0f;
  // Split on '/'
  auto slashPos = argsStr.find('/');
  std::string rgbPart = slashPos == std::string::npos ? argsStr
                                                      : argsStr.substr(0, slashPos);
  std::string alphaPart = slashPos == std::string::npos
                              ? std::string()
                              : argsStr.substr(slashPos + 1);
  trim(rgbPart);
  trim(alphaPart);

  auto tokens = splitByChars(rgbPart, " \t\n\r\f");
  std::string inferredAlpha;
  if (tokens.size() == 4 && alphaPart.empty()) {
    // Legacy rgba(r,g,b,a) or space-separated fourth token
    inferredAlpha = tokens.back();
    tokens.pop_back();
  }
  if (tokens.size() != 3) return false;

  auto parseComponent = [](const std::string& comp) -> std::optional<int> {
    if (comp.empty()) return std::nullopt;
    if (comp.back() == '%') {
      float p = 0;
      if (!parseFloat(std::string_view(comp.data(), comp.size() - 1), p))
        return std::nullopt;
      return percentToByte(p);
    } else {
      float v = 0;
      if (!parseFloat(comp, v)) return std::nullopt;
      // Allow either 0..255 or 0..1
      if (v <= 1.0f) return floatToByte(clampFloat(v, 0.0f, 1.0f));
      return clampInt(static_cast<int>(std::round(v)), 0, 255);
    }
  };

  auto rOpt = parseComponent(tokens[0]);
  auto gOpt = parseComponent(tokens[1]);
  auto bOpt = parseComponent(tokens[2]);
  if (!rOpt || !gOpt || !bOpt) return false;

  if (!alphaPart.empty() || fn == "rgba" || !inferredAlpha.empty()) {
    // If alpha provided in tokens (rgba) or slash-part
    std::string aStr = !alphaPart.empty() ? alphaPart : inferredAlpha;
    if (aStr.empty()) {
      // rgba with 4th value in tokens separated by spaces/commas is handled by slash already.
      // For legacy rgba(a,b,c,a) syntax with commas, we replaced commas by spaces above,
      // so alpha would be an extra token — but we split rgbPart only. So handle fn==rgba with comma list:
      // Try to parse from original args (commas present) if there were 4 comma-separated values.
      // For simplicity, if rgba() and no slash alpha, try to find the last token from original string.
      // Fallback: a stays at 1.
    }
    if (!aStr.empty()) {
      trim(aStr);
      if (!aStr.empty() && aStr.back() == '%') {
        float p = 0;
        if (!parseFloat(std::string_view(aStr.data(), aStr.size() - 1), p))
          return false;
        a = clampFloat(p / 100.0f, 0.0f, 1.0f);
      } else {
        float v = 0;
        if (!parseFloat(aStr, v)) return false;
        if (v > 1.0f) a = clampFloat(v / 255.0f, 0.0f, 1.0f);
        else a = clampFloat(v, 0.0f, 1.0f);
      }
    }
  }

  out = SkColorSetARGB(floatToByte(a), *rOpt, *gOpt, *bOpt);
  return true;
}

inline bool parseHslLike(std::string_view sv, SkColor& out) {
  // hsl(h, s%, l%) or hsla(h, s%, l%, a) and space-separated with '/ a'
  std::string s = toLower(sv);
  trim(s);
  auto open = s.find('(');
  auto close = s.rfind(')');
  if (open == std::string::npos || close == std::string::npos || close <= open)
    return false;
  auto fn = s.substr(0, open);
  auto args = s.substr(open + 1, close - open - 1);
  trim(args);
  if (fn != "hsl" && fn != "hsla") return false;

  // Normalize commas to spaces
  std::string argsStr(args);
  std::replace(argsStr.begin(), argsStr.end(), ',', ' ');

  float a = 1.0f;
  // Split on '/'
  auto slashPos = argsStr.find('/');
  std::string hslPart = slashPos == std::string::npos ? argsStr
                                                      : argsStr.substr(0, slashPos);
  std::string alphaPart = slashPos == std::string::npos
                              ? std::string()
                              : argsStr.substr(slashPos + 1);
  trim(hslPart);
  trim(alphaPart);

  auto tokens = splitByChars(hslPart, " \t\n\r\f");
  if (tokens.size() != 3) return false;

  // h can have unit 'deg' (we'll accept bare number as degrees)
  auto parseHue = [](const std::string& hstr) -> std::optional<float> {
    std::string s = hstr;
    trim(s);
    if (s.size() >= 3 && s.substr(s.size() - 3) == "deg") s.resize(s.size() - 3);
    float h = 0;
    if (!parseFloat(s, h)) return std::nullopt;
    // Wrap to [0,360)
    h = std::fmod(h, 360.0f);
    if (h < 0) h += 360.0f;
    return h;
  };

  auto parsePercent = [](const std::string& pstr) -> std::optional<float> {
    if (pstr.empty() || pstr.back() != '%') return std::nullopt;
    float v = 0;
    if (!parseFloat(std::string_view(pstr.data(), pstr.size() - 1), v))
      return std::nullopt;
    return clampFloat(v / 100.0f, 0.0f, 1.0f);
  };

  auto hOpt = parseHue(tokens[0]);
  auto sOpt = parsePercent(tokens[1]);
  auto lOpt = parsePercent(tokens[2]);
  if (!hOpt || !sOpt || !lOpt) return false;

  if (!alphaPart.empty() || fn == "hsla") {
    std::string aStr = alphaPart;
    trim(aStr);
    if (!aStr.empty() && aStr.back() == '%') {
      float p = 0;
      if (!parseFloat(std::string_view(aStr.data(), aStr.size() - 1), p))
        return false;
      a = clampFloat(p / 100.0f, 0.0f, 1.0f);
    } else if (!aStr.empty()) {
      float v = 0;
      if (!parseFloat(aStr, v)) return false;
      if (v > 1.0f) a = clampFloat(v / 255.0f, 0.0f, 1.0f);
      else a = clampFloat(v, 0.0f, 1.0f);
    }
  }

  // Convert HSL to RGB (0..255)
  float H = *hOpt / 360.0f;
  float S = *sOpt;
  float L = *lOpt;

  auto hue2rgb = [](float p, float q, float t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1.0f / 6.0f) return p + (q - p) * 6.0f * t;
    if (t < 1.0f / 2.0f) return q;
    if (t < 2.0f / 3.0f) return p + (q - p) * (2.0f / 3.0f - t) * 6.0f;
    return p;
  };

  float r, g, b;
  if (S == 0) {
    r = g = b = L; // achromatic
  } else {
    float q = L < 0.5f ? L * (1 + S) : L + S - L * S;
    float p = 2 * L - q;
    r = hue2rgb(p, q, H + 1.0f / 3.0f);
    g = hue2rgb(p, q, H);
    b = hue2rgb(p, q, H - 1.0f / 3.0f);
  }

  out = SkColorSetARGB(floatToByte(a), floatToByte(r), floatToByte(g), floatToByte(b));
  return true;
}

inline bool parseNamedColor(std::string_view sv, SkColor& out) {
  static const std::unordered_map<std::string, SkColor> kNamed{
      {"black", SkColorSetARGB(255, 0, 0, 0)},
      {"white", SkColorSetARGB(255, 255, 255, 255)},
      {"red", SkColorSetARGB(255, 255, 0, 0)},
      {"green", SkColorSetARGB(255, 0, 128, 0)},
      {"blue", SkColorSetARGB(255, 0, 0, 255)},
      {"yellow", SkColorSetARGB(255, 255, 255, 0)},
      {"cyan", SkColorSetARGB(255, 0, 255, 255)},
      {"aqua", SkColorSetARGB(255, 0, 255, 255)},
      {"magenta", SkColorSetARGB(255, 255, 0, 255)},
      {"fuchsia", SkColorSetARGB(255, 255, 0, 255)},
      {"gray", SkColorSetARGB(255, 128, 128, 128)},
      {"grey", SkColorSetARGB(255, 128, 128, 128)},
      {"lightgray", SkColorSetARGB(255, 211, 211, 211)},
      {"lightgrey", SkColorSetARGB(255, 211, 211, 211)},
      {"darkgray", SkColorSetARGB(255, 169, 169, 169)},
      {"darkgrey", SkColorSetARGB(255, 169, 169, 169)},
      {"orange", SkColorSetARGB(255, 255, 165, 0)},
      {"purple", SkColorSetARGB(255, 128, 0, 128)},
      {"pink", SkColorSetARGB(255, 255, 192, 203)},
      {"brown", SkColorSetARGB(255, 165, 42, 42)},
      {"navy", SkColorSetARGB(255, 0, 0, 128)},
      {"teal", SkColorSetARGB(255, 0, 128, 128)},
      {"olive", SkColorSetARGB(255, 128, 128, 0)},
      {"maroon", SkColorSetARGB(255, 128, 0, 0)},
      {"silver", SkColorSetARGB(255, 192, 192, 192)},
      {"lime", SkColorSetARGB(255, 0, 255, 0)},
      {"rebeccapurple", SkColorSetARGB(255, 102, 51, 153)},
      {"transparent", SkColorSetARGB(0, 0, 0, 0)},
  };
  auto it = kNamed.find(toLower(sv));
  if (it == kNamed.end()) return false;
  out = it->second;
  return true;
}

} // namespace

std::optional<SkColor> parseCssColor(std::string_view input) {
  std::string s(input);
  trim(s);
  if (s.empty()) return std::nullopt;

  SkColor color;
  // Hex
  if (s[0] == '#') {
    if (parseHexColor(s, color)) return color;
    return std::nullopt;
  }

  // Functional notations
  if (parseRgbLike(s, color)) return color;
  if (parseHslLike(s, color)) return color;

  // Named colors
  if (parseNamedColor(s, color)) return color;

  return std::nullopt;
}

} // namespace margelo::nitro::RNSkiaYoga
