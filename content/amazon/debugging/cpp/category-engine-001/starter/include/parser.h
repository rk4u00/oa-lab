#pragma once

#include <stdexcept>
#include <string>
#include <vector>

#include "category.h"
#include "product.h"
#include "request.h"

namespace browse {

class InputError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

// categories.json: a single JSON document, { "categories": [ {...}, ... ] }.
// Throws InputError if the file is missing or not valid JSON. Individual
// malformed entries are reported on stderr and skipped.
std::vector<Category> loadCategories(const std::string& path);

// products.jsonl: one JSON object per line.
std::vector<Product> loadProducts(const std::string& path);

// requests.jsonl: one JSON object per line, processed in file order.
std::vector<BrowseRequest> loadRequests(const std::string& path);

}  // namespace browse
