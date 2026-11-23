#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "category_service.h"
#include "product.h"
#include "product_service.h"
#include "request.h"

namespace browse {

struct BrowseResult {
    std::string query_id;
    int category_id = 0;
    std::string region;
    std::size_t matched_count = 0;
    std::vector<Product> products;
};

class BrowseEngine {
public:
    BrowseEngine(const CategoryService& categories, const ProductService& products);

    BrowseResult handle(const BrowseRequest& request) const;
    std::vector<BrowseResult> run(const std::vector<BrowseRequest>& requests) const;

private:
    const CategoryService& categories_;
    const ProductService& products_;
};

}  // namespace browse
