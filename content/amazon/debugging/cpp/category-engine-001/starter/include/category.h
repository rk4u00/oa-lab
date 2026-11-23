#pragma once

#include <string>

namespace browse {

// Category ids are positive; a parent id of 0 marks a top-level department.
constexpr int kRootParentId = 0;

// Upper bound on how far a traversal will walk from its starting node.
// Guards against cycles introduced by bad parent links in the taxonomy feed.
constexpr int kMaxCategoryDepth = 3;

struct Category {
    int id = 0;
    int parent_id = kRootParentId;
    std::string name;

    bool isRoot() const { return parent_id == kRootParentId; }
};

}  // namespace browse
