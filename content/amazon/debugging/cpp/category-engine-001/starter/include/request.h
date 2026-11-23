#pragma once

#include <cstddef>
#include <string>

namespace browse {

constexpr int kDefaultMaxResults = 5;

struct BrowseRequest {
    std::string query_id;
    int category_id = 0;
    std::string region;
    int max_results = kDefaultMaxResults;

    // Number of products the caller wants back.
    std::size_t effectiveLimit() const {
        return max_results > 0 ? static_cast<std::size_t>(max_results)
                               : static_cast<std::size_t>(kDefaultMaxResults);
    }
};

}  // namespace browse
