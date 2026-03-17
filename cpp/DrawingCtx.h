#pragma once

#include <algorithm>
#include <functional>
#include <iterator>
#include <numeric>
#include <stdexcept>

#include <include/core/SkCanvas.h>
#include <include/core/SkColorFilter.h>
#include <include/core/SkImageFilter.h>
#include <include/core/SkMaskFilter.h>
#include <include/core/SkPaint.h>
#include <include/core/SkPathEffect.h>
#include <include/core/SkShader.h>
#include <include/effects/SkImageFilters.h>

// Pull in the upstream DrawingCtx implementation once the required
// standard library and Skia headers are available.
#include <api/recorder/DrawingCtx.h>
