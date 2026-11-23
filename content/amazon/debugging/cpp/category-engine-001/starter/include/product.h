#pragma once

#include <string>

#include "string_utils.h"

namespace browse {

struct Product {
    int id = 0;
    std::string name;
    int category_id = 0;
    std::string region;
    double popularity = 0.0;

    bool availableIn(const std::string& requestedRegion) const {
        return util::sameRegion(region, requestedRegion);
    }
};

}  // namespace browse
