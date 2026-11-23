#include "result_writer.h"

#include <fstream>
#include <stdexcept>

#include <nlohmann/json.hpp>

namespace browse {
namespace {

using nlohmann::json;

json productToJson(const Product& p) {
    return json{
        {"product_id", p.id},
        {"name", p.name},
        {"popularity", p.popularity},
    };
}

json resultToJson(const BrowseResult& r) {
    json products;
    for (const Product& p : r.products) {
        products.push_back(productToJson(p));
    }

    return json{
        {"query_id", r.query_id},
        {"category_id", r.category_id},
        {"region", r.region},
        {"matched_count", r.matched_count},
        {"products", products},
    };
}

}  // namespace

void writeResults(const std::string& path, const std::vector<BrowseResult>& results) {
    json doc;
    doc["results"] = json::array();
    for (const BrowseResult& r : results) {
        doc["results"].push_back(resultToJson(r));
    }

    std::ofstream out(path);
    if (!out) {
        throw std::runtime_error("cannot open output file: " + path);
    }
    out << doc.dump(2) << '\n';
}

}  // namespace browse
