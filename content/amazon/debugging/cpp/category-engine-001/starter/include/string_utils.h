#pragma once

#include <algorithm>
#include <cctype>
#include <string>
#include <string_view>

namespace browse::util {

inline std::string trim(std::string_view s) {
    const auto isSpace = [](unsigned char c) { return std::isspace(c) != 0; };
    auto begin = std::find_if_not(s.begin(), s.end(), isSpace);
    auto end = std::find_if_not(s.rbegin(), s.rend(), isSpace).base();
    if (begin >= end) {
        return {};
    }
    return std::string(begin, end);
}

// Region codes arrive from several upstream feeds (seller portal, ERP export,
// manual uploads), so compare them in a canonical form.
inline std::string canonicalRegion(std::string_view code) {
    std::string out = trim(code);
    std::transform(out.begin(), out.end(), out.begin(),
                   [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return out;
}

inline bool sameRegion(std::string_view a, std::string_view b) {
    return canonicalRegion(a) == canonicalRegion(b);
}

}  // namespace browse::util
