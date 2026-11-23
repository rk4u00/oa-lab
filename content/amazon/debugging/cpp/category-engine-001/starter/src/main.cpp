#include <exception>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

#include "browse_engine.h"
#include "category_service.h"
#include "parser.h"
#include "product_service.h"
#include "result_writer.h"

namespace {

struct Options {
    std::string dataDir = "data";
    std::string outputPath = "results.json";
};

void printUsage(const char* argv0) {
    std::cerr << "usage: " << argv0 << " [--data DIR] [--out FILE]\n"
              << "  --data DIR   directory containing categories.json, products.jsonl,\n"
              << "               requests.jsonl (default: ./data)\n"
              << "  --out FILE   where to write results (default: ./results.json)\n";
}

bool parseArgs(int argc, char** argv, Options& opts) {
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "-h" || arg == "--help") {
            return false;
        }
        if ((arg == "--data" || arg == "--out") && i + 1 >= argc) {
            std::cerr << "missing value for " << arg << '\n';
            return false;
        }
        if (arg == "--data") {
            opts.dataDir = argv[++i];
        } else if (arg == "--out") {
            opts.outputPath = argv[++i];
        } else {
            std::cerr << "unknown argument: " << arg << '\n';
            return false;
        }
    }
    return true;
}

}  // namespace

int main(int argc, char** argv) {
    Options opts;
    if (!parseArgs(argc, argv, opts)) {
        printUsage(argv[0]);
        return 2;
    }

    try {
        const auto categories = browse::loadCategories(opts.dataDir + "/categories.json");
        auto products = browse::loadProducts(opts.dataDir + "/products.jsonl");
        const auto requests = browse::loadRequests(opts.dataDir + "/requests.jsonl");

        std::cerr << "[info] loaded " << categories.size() << " categories, "
                  << products.size() << " products, " << requests.size() << " requests\n";

        const browse::CategoryService categoryService(categories);
        const browse::ProductService productService(std::move(products));
        const browse::BrowseEngine engine(categoryService, productService);

        const auto results = engine.run(requests);
        browse::writeResults(opts.outputPath, results);

        std::cerr << "[info] wrote " << results.size() << " results to " << opts.outputPath << '\n';
    } catch (const std::exception& e) {
        std::cerr << "[error] " << e.what() << '\n';
        return 1;
    }
    return 0;
}
