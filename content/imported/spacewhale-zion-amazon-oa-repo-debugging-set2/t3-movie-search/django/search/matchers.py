"""Field matchers. Each receives a movie and an ALREADY-NORMALIZED query."""
from .text import normalize, split_stars


def title_matches(movie, query):
    return query == normalize(movie.title)


def stars_match(movie, query):
    stars = split_stars(movie.stars)
    return bool(stars) and query in normalize(stars[0])


def all_fields_match(movie, query):
    return title_matches(movie, query) and stars_match(movie, query)


MATCHERS = {
    "title": title_matches,
    "stars": stars_match,
    "all": all_fields_match,
}
