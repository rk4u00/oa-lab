#pragma once

#include <string>
#include <vector>

#include "browse_engine.h"

namespace browse {

// Serialises results to `path` as { "results": [ ... ] }.
void writeResults(const std::string& path, const std::vector<BrowseResult>& results);

}  // namespace browse
