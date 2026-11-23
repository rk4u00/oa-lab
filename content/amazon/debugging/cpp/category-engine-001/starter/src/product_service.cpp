#include "product_service.h"

#include <algorithm>
#include <utility>

namespace browse {

ProductService::ProductService(std::vector<Product> products)
    : catalog_(std::move(products)) {
    byCategory_.reserve(catalog_.size());
    for (const Product& p : catalog_) {
        byCategory_[p.category_id].push_back(p);
    }

    std::sort(catalog_.begin(), catalog_.end(),
              [](const Product& a, const Product& b) { return a.id < b.id; });
}

std::vector<Product> ProductService::collect(const std::vector<int>& categoryIds,
                                             const std::string& region,
                                             std::size_t maxCandidates) const {
    std::vector<Product> out;
    for (int categoryId : categoryIds) {
        auto it = byCategory_.find(categoryId);
        if (it == byCategory_.end()) {
            continue;
        }

        for (const Product& p : it->second) {
            if (!p.availableIn(region)) {
                continue;
            }
            out.push_back(p);
            if (out.size() >= maxCandidates) {
                return out;
            }
        }
    }
    return out;
}

void ProductService::rank(std::vector<Product>& products) {
    // Products are kept in id order, so a stable sort on popularity leaves
    // equally popular products in ascending id order.
    std::stable_sort(products.begin(), products.end(),
                     [](const Product& a, const Product& b) {
                         return a.popularity > b.popularity;
                     });
}

const Product* ProductService::findById(int productId) const {
    auto it = std::lower_bound(catalog_.begin(), catalog_.end(), productId,
                               [](const Product& p, int id) { return p.id < id; });
    if (it == catalog_.end() || it->id != productId) {
        return nullptr;
    }
    return &*it;
}

}  // namespace browse
