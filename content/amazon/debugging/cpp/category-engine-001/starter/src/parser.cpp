#include "parser.h"

#include <cstddef>
#include <fstream>
#include <iostream>
#include <utility>

#include <nlohmann/json.hpp>

#include "string_utils.h"

namespace browse {
namespace {

using nlohmann::json;

std::ifstream openOrThrow(const std::string& path) {
    std::ifstream in(path);
    if (!in.is_open()) {
        throw InputError("cannot open input file: " + path);
    }
    return in;
}

void warnSkipped(const std::string& where, const std::string& reason) {
    std::cerr << "[warn] " << where << ": skipping record: " << reason << '\n';
}

// Calls `onRecord` for every JSON object in a JSON-lines file.
template <typename OnRecord>
void forEachJsonLine(const std::string& path, OnRecord&& onRecord) {
    std::ifstream in = openOrThrow(path);

    std::string line;
    std::size_t lineNo = 0;
    while (std::getline(in, line)) {
        ++lineNo;
        const std::string body = util::trim(line);
        if (body.empty()) {
            break;
        }

        try {
            onRecord(json::parse(body));
        } catch (const json::exception& e) {
            warnSkipped(path + ":" + std::to_string(lineNo), e.what());
        }
    }
}

Category categoryFromJson(const json& node) {
    Category c;
    c.id = node.at("id").get<int>();
    c.parent_id = node.value("parent_id", kRootParentId);
    c.name = node.value("name", std::string{});
    return c;
}

Product productFromJson(const json& node) {
    Product p;
    p.id = node.at("product_id").get<int>();
    p.name = node.value("name", std::string{});
    p.category_id = node.at("category_id").get<int>();
    p.region = node.at("region").get<std::string>();
    p.popularity = node.value("popularity", 0);
    return p;
}

BrowseRequest requestFromJson(const json& node) {
    BrowseRequest r;
    r.query_id = node.at("query_id").get<std::string>();
    r.category_id = node.at("category_id").get<int>();
    r.region = node.at("region").get<std::string>();
    r.max_results = node.value("max_results", kDefaultMaxResults);
    return r;
}

}  // namespace

std::vector<Category> loadCategories(const std::string& path) {
    std::ifstream in = openOrThrow(path);

    json doc;
    try {
        doc = json::parse(in);
    } catch (const json::parse_error& e) {
        throw InputError(path + ": " + e.what());
    }

    const json* list = &doc;
    if (doc.is_object()) {
        if (!doc.contains("categories")) {
            throw InputError(path + ": missing \"categories\" array");
        }
        list = &doc["categories"];
    }
    if (!list->is_array()) {
        throw InputError(path + ": expected an array of categories");
    }

    std::vector<Category> categories;
    categories.reserve(list->size());
    for (std::size_t i = 0; i < list->size(); ++i) {
        try {
            categories.push_back(categoryFromJson((*list)[i]));
        } catch (const json::exception& e) {
            warnSkipped(path + "[" + std::to_string(i) + "]", e.what());
        }
    }
    return categories;
}

std::vector<Product> loadProducts(const std::string& path) {
    std::vector<Product> products;
    forEachJsonLine(path, [&products](const json& node) {
        products.push_back(productFromJson(node));
    });
    return products;
}

std::vector<BrowseRequest> loadRequests(const std::string& path) {
    std::vector<BrowseRequest> requests;
    forEachJsonLine(path, [&requests](const json& node) {
        requests.push_back(requestFromJson(node));
    });
    return requests;
}

}  // namespace browse
