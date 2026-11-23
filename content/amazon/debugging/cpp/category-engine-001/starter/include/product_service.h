#pragma once

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

#include "product.h"

namespace browse {

// Owns the product catalog and the per-category index used by browse.
class ProductService {
public:
    explicit ProductService(std::vector<Product> products);

    // Products that live directly in any of `categoryIds` and are sold in
    // `region`. At most `maxCandidates` products are returned.
    std::vector<Product> collect(const std::vector<int>& categoryIds,
                                 const std::string& region,
                                 std::size_t maxCandidates) const;

    // Orders products for display: most popular first.
    static void rank(std::vector<Product>& products);

    const Product* findById(int productId) const;
    std::size_t size() const { return catalog_.size(); }

private:
    std::vector<Product> catalog_;  // sorted by product id
    std::unordered_map<int, std::vector<Product>> byCategory_;
};

}  // namespace browse
