#pragma once

#include <cstddef>
#include <unordered_map>
#include <vector>

#include "category.h"

namespace browse {

// In-memory view of the category taxonomy.
class CategoryService {
public:
    explicit CategoryService(const std::vector<Category>& categories);

    bool contains(int categoryId) const;
    const Category* find(int categoryId) const;

    // Returns `categoryId` followed by every category beneath it
    // (breadth-first order).
    std::vector<int> descendantsOf(int categoryId) const;

    const std::vector<int>& roots() const { return roots_; }
    std::size_t size() const { return byId_.size(); }

private:
    void index(const std::vector<Category>& categories);

    std::unordered_map<int, Category> byId_;
    std::unordered_map<int, std::vector<int>> children_;
    std::vector<int> roots_;
};

}  // namespace browse
