project(RNSkiaYoga)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME RNSkiaYoga)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Default React Native variables (can be overridden from Gradle)
if(NOT DEFINED REACT_NATIVE_DIR)
  set(REACT_NATIVE_DIR "${NODE_MODULES_DIR}/react-native")
endif()
if(NOT DEFINED REACT_NATIVE_VERSION)
  # Match your RN 0.81.x
  set(REACT_NATIVE_VERSION 81)
endif()

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        src/main/cpp/SkiaYogaModuleNative.cpp
)

set_target_properties(${PACKAGE_NAME} PROPERTIES
        CXX_VISIBILITY_PRESET hidden
        VISIBILITY_INLINES_HIDDEN YES
)

set(CPP_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")
file(GLOB_RECURSE PROJECT_CPP_SOURCES
     "${CPP_SRC_DIR}/*.cpp" "${CPP_SRC_DIR}/*.cc" "${CPP_SRC_DIR}/*.cxx")
target_sources(${PACKAGE_NAME} PRIVATE ${PROJECT_CPP_SOURCES})

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNSkiaYoga+autolinking.cmake)

# Include fbjni
find_package(fbjni REQUIRED)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
        "${NODE_MODULES_DIR}/react-native/ReactCommon"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/callinvoker"
        "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/jni"
        "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/jni/react/turbomodule"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/turbomodule/core"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/turbomodule"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/react/nativemodule/core"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/runtimeexecutor"
        "${NODE_MODULES_DIR}/react-native-nitro-modules/android/build/headers/nitromodules"
)

set(RNSKIA_HEADER_DIR "")
set(RNSKIA_CANDIDATES
        "${NODE_MODULES_DIR}/@shopify/react-native-skia"
)

foreach(path ${RNSKIA_CANDIDATES})
    if(EXISTS "${path}")
        set(RNSKIA_HEADER_DIR "${path}")
        break()
    endif()
endforeach()

if(RNSKIA_HEADER_DIR STREQUAL "")
    message(WARNING "@shopify/react-native-skia was not found. Ensure it is installed so Android builds can locate headers.")
else()
    message(STATUS "Using @shopify/react-native-skia from ${RNSKIA_HEADER_DIR}")
    include_directories(
            "${RNSKIA_HEADER_DIR}/cpp/api"
            "${RNSKIA_HEADER_DIR}/cpp/api/recorder"
            "${RNSKIA_HEADER_DIR}/cpp/jsi"
            "${RNSKIA_HEADER_DIR}/cpp/"
            "${RNSKIA_HEADER_DIR}/cpp/skia"
            "${RNSKIA_HEADER_DIR}/cpp/rnskia"
            "${RNSKIA_HEADER_DIR}/cpp/utils"
            "${RNSKIA_HEADER_DIR}/android/cpp/jni/include"
            "${RNSKIA_HEADER_DIR}/android/cpp/rnskia-android"
    )

    string(TOLOWER "${CMAKE_BUILD_TYPE}" CONFIG_LC)
    set(ABI "${CMAKE_ANDROID_ARCH_ABI}")

    # AGP may place the jni .so under either directory depending on version
    set(RNSKIA_JNI_DIR_C1 "${RNSKIA_HEADER_DIR}/android/build/intermediates/library_jni/${CONFIG_LC}/jni/${ABI}")
    set(RNSKIA_JNI_DIR_C2 "${RNSKIA_HEADER_DIR}/android/build/intermediates/library_jni/${CONFIG_LC}/copy${CMAKE_BUILD_TYPE}JniLibsProjectOnly/jni/${ABI}")

    if (EXISTS "${RNSKIA_JNI_DIR_C1}/librnskia.so")
    set(RNSKIA_SO "${RNSKIA_JNI_DIR_C1}/librnskia.so")
    elseif (EXISTS "${RNSKIA_JNI_DIR_C2}/librnskia.so")
    set(RNSKIA_SO "${RNSKIA_JNI_DIR_C2}/librnskia.so")
    else()
    message(FATAL_ERROR "librnskia.so not found. Build :react-native-skia first or check paths:
    ${RNSKIA_JNI_DIR_C1}
    ${RNSKIA_JNI_DIR_C2}")
    endif()

    add_library(rnskia SHARED IMPORTED GLOBAL)
    set_target_properties(rnskia PROPERTIES IMPORTED_LOCATION "${RNSKIA_SO}")
endif()

find_library(LOG_LIB log)
# New: link OpenGL ES and EGL for glIsTexture and friends
find_library(GLESV2_LIB GLESv2)
find_library(EGL_LIB EGL)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android
        fbjni::fbjni
        ${GLESV2_LIB}
        ${EGL_LIB}
        rnskia
)

# Allow duplicate symbols, allow unresolved (resolved at runtime), and keep rnskia as DT_NEEDED
target_link_options(${PACKAGE_NAME} PRIVATE
        -Wl,--allow-multiple-definition
        -Wl,-z,muldefs
        -Wl,--allow-shlib-undefined
        -Wl,--no-as-needed
)