#include "category_service.h"

#include <iostream>
#include <queue>
#include <utility>

namespace browse {

CategoryService::CategoryService(const std::vector<Category>& categories) {
    index(categories);
}

void CategoryService::index(const std::vector<Category>& categories) {
    byId_.reserve(categories.size());

    for (const Category& c : categories) {
        auto [it, inserted] = byId_.emplace(c.id, c);
        if (!inserted) {
            std::cerr << "[warn] duplicate category id " << c.id << ", keeping first definition\n";
            continue;
        }

        if (c.isRoot()) {
            roots_.push_back(c.id);
            continue;
        }

        if (byId_.count(c.parent_id) == 0) {
            // Parent isn't in the feed. Promote to a root so the subtree
            // stays reachable instead of disappearing from browse.
            roots_.push_back(c.id);
            continue;
        }

        children_[c.parent_id].push_back(c.id);
    }
}

bool CategoryService::contains(int categoryId) const {
    return byId_.find(categoryId) != byId_.end();
}

const Category* CategoryService::find(int categoryId) const {
    auto it = byId_.find(categoryId);
    return it == byId_.end() ? nullptr : &it->second;
}

std::vector<int> CategoryService::descendantsOf(int categoryId) const {
    std::vector<int> result;
    std::queue<std::pair<int, int>> pending;  // (category id, depth from start)
    pending.emplace(categoryId, 0);

    while (!pending.empty()) {
        const auto [id, depth] = pending.front();
        pending.pop();
        result.push_back(id);

        if (depth >= kMaxCategoryDepth) {
            continue;
        }

        auto it = children_.find(id);
        if (it == children_.end()) {
            continue;
        }
        for (int child : it->second) {
            pending.emplace(child, depth + 1);
        }
    }
    return result;
}

}  // namespace browse
