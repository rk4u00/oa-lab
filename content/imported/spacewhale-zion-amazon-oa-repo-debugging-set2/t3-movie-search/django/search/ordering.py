"""Result ordering: popularity (high first), then rating (high first), then title (A-Z)."""


def sort_results(movies):
    return sorted(movies, key=lambda m: (-m.popularity, m.title.lower()))
