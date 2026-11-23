cmake_minimum_required(VERSION 3.14)

project(category_engine
    VERSION 1.4.2
    DESCRIPTION "Category browse engine for the storefront catalog"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build type" FORCE)
endif()

option(CATEGORY_ENGINE_USE_SYSTEM_JSON "Prefer an installed nlohmann_json package" ON)
option(CATEGORY_ENGINE_SANITIZE "Build with AddressSanitizer + UBSan" OFF)

# --- nlohmann/json -----------------------------------------------------------
# Use the system package when available, otherwise fall back to the vendored
# single header under third_party/.
if(CATEGORY_ENGINE_USE_SYSTEM_JSON)
    find_package(nlohmann_json 3.10 QUIET)
endif()

if(NOT TARGET nlohmann_json::nlohmann_json)
    message(STATUS "Using vendored nlohmann/json from third_party/")
    add_library(nlohmann_json_vendored INTERFACE)
    target_include_directories(nlohmann_json_vendored SYSTEM INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party)
    add_library(nlohmann_json::nlohmann_json ALIAS nlohmann_json_vendored)
endif()

# --- core library ------------------------------------------------------------
add_library(browse_core STATIC
    src/parser.cpp
    src/category_service.cpp
    src/product_service.cpp
    src/browse_engine.cpp
    src/result_writer.cpp
)

target_include_directories(browse_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(browse_core PUBLIC nlohmann_json::nlohmann_json)

if(MSVC)
    target_compile_options(browse_core PRIVATE /W4)
else()
    target_compile_options(browse_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(CATEGORY_ENGINE_SANITIZE AND NOT MSVC)
    target_compile_options(browse_core PUBLIC -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(browse_core PUBLIC -fsanitize=address,undefined)
endif()

# --- executable --------------------------------------------------------------
add_executable(category_engine src/main.cpp)
target_link_libraries(category_engine PRIVATE browse_core)
