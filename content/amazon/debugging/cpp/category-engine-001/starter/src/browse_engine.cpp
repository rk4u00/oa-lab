#include "browse_engine.h"

#include <map>
#include <utility>

namespace browse {

BrowseEngine::BrowseEngine(const CategoryService& categories, const ProductService& products)
    : categories_(categories), products_(products) {}

BrowseResult BrowseEngine::handle(const BrowseRequest& request) const {
    BrowseResult result;
    result.query_id = request.query_id;
    result.category_id = request.category_id;
    result.region = request.region;

    const std::size_t limit = request.effectiveLimit();
    const std::vector<int> scope = categories_.descendantsOf(request.category_id);

    std::vector<Product> candidates = products_.collect(scope, request.region, limit);
    ProductService::rank(candidates);

    if (candidates.size() > limit) {
        candidates.resize(limit);
    }
    result.matched_count = candidates.size();
    result.products = std::move(candidates);
    return result;
}

std::vector<BrowseResult> BrowseEngine::run(const std::vector<BrowseRequest>& requests) const {
    // Clients retry on timeout, so the same query id can show up more than
    // once; the latest request for an id wins.
    std::map<std::string, BrowseResult> byQueryId;
    for (const BrowseRequest& request : requests) {
        byQueryId[request.query_id] = handle(request);
    }

    std::vector<BrowseResult> results;
    results.reserve(byQueryId.size());
    for (auto& entry : byQueryId) {
        results.push_back(std::move(entry.second));
    }
    return results;
}

}  // namespace browse
