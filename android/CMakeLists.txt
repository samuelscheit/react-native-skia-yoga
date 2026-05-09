project(RNSkiaYoga)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME RNSkiaYoga)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

set(build_DIR ${CMAKE_SOURCE_DIR}/build)

file(GLOB libfbjni_include_DIRS "${build_DIR}/fbjni-*-headers.jar/")

# We need to find packages since from RN 0.71 binaries are prebuilt
find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        src/main/cpp/SkiaYogaModuleNative.cpp
)

# set_target_properties(${PACKAGE_NAME} PROPERTIES
#         CXX_VISIBILITY_PRESET hidden
#         VISIBILITY_INLINES_HIDDEN YES
# )

set(CPP_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")
file(GLOB_RECURSE PROJECT_CPP_SOURCES
     "${CPP_SRC_DIR}/*.cpp" "${CPP_SRC_DIR}/*.cc" "${CPP_SRC_DIR}/*.cxx")
target_sources(${PACKAGE_NAME} PRIVATE ${PROJECT_CPP_SOURCES})

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNSkiaYoga+autolinking.cmake)

# Specifies a path to native header files.
include_directories(
        ../cpp

        # Android specifics
        cpp/jni/include

        # React native
        "${NODE_MODULES_DIR}/react-native/ReactCommon/callinvoker"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
        "${NODE_MODULES_DIR}/react-native/ReactCommon"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/react/nativemodule/core"
        "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/java/com/facebook/react/turbomodule/core/jni"

        ${libfbjni_include_DIRS}
)

# Android Log lib
find_library(
        LOG_LIB
        log
)

# Link
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}                          # <-- Logcat logger
        android                             # <-- Android JNI core
        fbjni::fbjni                        # <-- fbjni
        ReactAndroid::jsi                   # <-- RN: JSI
        -ljnigraphics
        -lGLESv2
        -lEGL
        -landroid
)

# 1. Link react-native-skia
message("react-native-skia-yoga: Linking react-native-skia...")
find_package(shopify_react-native-skia REQUIRED CONFIG)
target_link_libraries(
        ${PACKAGE_NAME}
        shopify_react-native-skia::rnskia
)

# 2. Add react-native-skia to path so it itself can find it's relative imports
get_target_property(RN_SKIA_INCLUDE_DIR shopify_react-native-skia::rnskia INTERFACE_INCLUDE_DIRECTORIES)
message("react-native-skia-yoga: react-native-skia include directory: ${RN_SKIA_INCLUDE_DIR}")
include_directories("${RN_SKIA_INCLUDE_DIR}/react-native-skia")

# 3. Link skia itself
set(RN_SKIA_DIR "${NODE_MODULES_DIR}/@shopify/react-native-skia")
message("react-native-skia-yoga: react-native-skia directory: ${RN_SKIA_DIR}")

# Replace wrong include_directories and avoid cpp/api (causes redefinitions)
target_include_directories(${PACKAGE_NAME} PRIVATE
  "${RN_SKIA_DIR}/android/cpp/rnskia-android" # contains "gl/Display.h"
)

set(RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES
  "libjsonreader.a"
  "libskia.a"
  "libskottie.a"
  "libskparagraph.a"
  "libsksg.a"
  "libskshaper.a"
  "libskunicode_core.a"
  "libskunicode_icu.a"
  "libsvg.a"
)

set(RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIRS
  "${NODE_MODULES_DIR}/react-native-skia-android/libs/${ANDROID_ABI}"
  "${RN_SKIA_DIR}/libs/android/${ANDROID_ABI}"
)

set(RN_SKIA_ANDROID_ARCHIVE_DIR "")
set(RN_SKIA_ANDROID_ARCHIVES "")
set(RN_SKIA_ANDROID_ARCHIVE_ATTEMPTS "")

foreach(RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR IN LISTS RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIRS)
  set(RN_SKIA_MISSING_ANDROID_ARCHIVES "")
  set(RN_SKIA_CANDIDATE_ANDROID_ARCHIVES "")

  foreach(RN_SKIA_ARCHIVE_BASENAME IN LISTS RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES)
    set(RN_SKIA_ANDROID_ARCHIVE_PATH "${RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR}/${RN_SKIA_ARCHIVE_BASENAME}")
    if(EXISTS "${RN_SKIA_ANDROID_ARCHIVE_PATH}")
      list(APPEND RN_SKIA_CANDIDATE_ANDROID_ARCHIVES "${RN_SKIA_ANDROID_ARCHIVE_PATH}")
    else()
      list(APPEND RN_SKIA_MISSING_ANDROID_ARCHIVES "${RN_SKIA_ARCHIVE_BASENAME}")
    endif()
  endforeach()

  if(NOT RN_SKIA_MISSING_ANDROID_ARCHIVES)
    set(RN_SKIA_ANDROID_ARCHIVE_DIR "${RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR}")
    set(RN_SKIA_ANDROID_ARCHIVES ${RN_SKIA_CANDIDATE_ANDROID_ARCHIVES})
    break()
  endif()

  string(REPLACE ";" ", " RN_SKIA_MISSING_ANDROID_ARCHIVES_DISPLAY "${RN_SKIA_MISSING_ANDROID_ARCHIVES}")
  if(EXISTS "${RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR}")
    list(APPEND RN_SKIA_ANDROID_ARCHIVE_ATTEMPTS "${RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR}: missing ${RN_SKIA_MISSING_ANDROID_ARCHIVES_DISPLAY}")
  else()
    list(APPEND RN_SKIA_ANDROID_ARCHIVE_ATTEMPTS "${RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIR}: directory not found; missing ${RN_SKIA_MISSING_ANDROID_ARCHIVES_DISPLAY}")
  endif()
endforeach()

if(NOT RN_SKIA_ANDROID_ARCHIVE_DIR)
  string(REPLACE ";" ", " RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES_DISPLAY "${RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES}")
  set(RN_SKIA_ANDROID_ARCHIVE_ATTEMPT_DETAILS "")
  foreach(RN_SKIA_ANDROID_ARCHIVE_ATTEMPT IN LISTS RN_SKIA_ANDROID_ARCHIVE_ATTEMPTS)
    string(APPEND RN_SKIA_ANDROID_ARCHIVE_ATTEMPT_DETAILS "\n  - ${RN_SKIA_ANDROID_ARCHIVE_ATTEMPT}")
  endforeach()
  message(FATAL_ERROR "react-native-skia-yoga: Unable to find a complete RN Skia Android static archive set for ABI ${ANDROID_ABI}.\nExpected archive basenames: ${RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES_DISPLAY}\nChecked archive directories:${RN_SKIA_ANDROID_ARCHIVE_ATTEMPT_DETAILS}")
endif()

message(STATUS "react-native-skia-yoga: selected RN Skia Android archive directory for ${ANDROID_ABI}: ${RN_SKIA_ANDROID_ARCHIVE_DIR}")
foreach(RN_SKIA_ANDROID_ARCHIVE IN LISTS RN_SKIA_ANDROID_ARCHIVES)
  message(STATUS "react-native-skia-yoga: Linking ${RN_SKIA_ANDROID_ARCHIVE}...")
  target_link_libraries(${PACKAGE_NAME} "${RN_SKIA_ANDROID_ARCHIVE}")
endforeach()

# 4. Import and link RN Skia's JNI shared library (librnskia.so) to satisfy
#    symbols from RNJsi and Android platform glue that are not part of the
#    static Skia archives.
string(TOLOWER "${BUILD_TYPE}" RN_BUILD_TYPE_LC)
string(SUBSTRING "${BUILD_TYPE}" 0 1 _bt_first)
string(TOUPPER "${_bt_first}" _bt_first_up)
string(SUBSTRING "${BUILD_TYPE}" 1 -1 _bt_rest)
set(RN_BUILD_TYPE_CP "${_bt_first_up}${_bt_rest}")

set(RNSKIA_JNI_DIR_C1 "${RN_SKIA_DIR}/android/build/intermediates/library_jni/${RN_BUILD_TYPE_LC}/jni/${ANDROID_ABI}")
set(RNSKIA_JNI_DIR_C2 "${RN_SKIA_DIR}/android/build/intermediates/library_jni/${RN_BUILD_TYPE_LC}/copy${RN_BUILD_TYPE_CP}JniLibsProjectOnly/jni/${ANDROID_ABI}")

set(RNSKIA_SO "")
if (EXISTS "${RNSKIA_JNI_DIR_C1}/librnskia.so")
        set(RNSKIA_SO "${RNSKIA_JNI_DIR_C1}/librnskia.so")
elseif (EXISTS "${RNSKIA_JNI_DIR_C2}/librnskia.so")
        set(RNSKIA_SO "${RNSKIA_JNI_DIR_C2}/librnskia.so")
endif()

if (RNSKIA_SO)
        message("react-native-skia-yoga: Importing librnskia.so from ${RNSKIA_SO}")
        add_library(rnskia SHARED IMPORTED GLOBAL)
        set_target_properties(rnskia PROPERTIES IMPORTED_LOCATION "${RNSKIA_SO}")
        # Keep as a needed dependency so the loader includes it
        target_link_libraries(${PACKAGE_NAME} rnskia)
else()
        message(WARNING "react-native-skia-yoga: librnskia.so was not found under ${RN_SKIA_DIR}/android/build/intermediates/library_jni for ${BUILD_TYPE}/${ANDROID_ABI}. Ensure :shopify_react-native-skia is assembled before native linking.")
endif()
