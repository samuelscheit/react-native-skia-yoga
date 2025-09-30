#pragma once
// Skia core
#include <include/core/SkCanvas.h>
#include <include/core/SkPicture.h>
#include <include/core/SkTextBlob.h>
#include <include/core/SkVertices.h>
#include <include/core/SkRSXform.h>
#include <include/core/SkM44.h>
#include <include/core/SkPath.h>
#include <include/core/SkContourMeasure.h>
#include <include/effects/SkRuntimeEffect.h>

// Skia effects
#include "include/effects/SkDashPathEffect.h"
#if __has_include("include/effects/Sk1DPathEffect.h")
  #include "include/effects/Sk1DPathEffect.h"      // defines SkPath1DPathEffect
#else
  #include "include/effects/SkPath1DPathEffect.h"  // fallback (older trees)
#endif
#include <include/effects/Sk2DPathEffect.h>

// Skia modules
#include <modules/svg/include/SkSVGDOM.h>
#include <modules/skottie/include/Skottie.h>

// RN Skia JSI wrappers used by recorder Convertor/DataTypes (generated headers)
#include "JsiSkRuntimeEffect.h"
#include "JsiSkRSXform.h"
#include "JsiSkSVG.h"
// Note: Avoid including JsiSkSkottie.h here because it defines non-inline
// functions (e.g., DecodeImageData) which can cause duplicate symbol errors
// when this header is included in multiple translation units.
#include "JsiSkPicture.h"
#include "JsiSkParagraph.h"
#include "JsiSkTextBlob.h"
