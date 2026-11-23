"""Movie search service: ties together normalization, matching, filtering and ordering."""
from .common import ApiError
from .matchers import MATCHERS
from .models import Movie
from .ordering import sort_results
from .text import normalize


def search_movies(raw_query, raw_field):
    field = (raw_field or "all").strip()
    matcher = MATCHERS.get(field)
    if matcher is None:
        raise ApiError(400, "field must be one of: title, stars, all")

    query = (raw_query or "").strip()

    results = []
    for movie in Movie.objects.all():
        if field == "title" and not movie.published:
            continue
        if query and not matcher(movie, query):
            continue
        results.append(movie)
    return sort_results(results)


def serialize(movie):
    from .text import split_stars

    return {
        "id": movie.id,
        "title": movie.title,
        "stars": split_stars(movie.stars),
        "popularity": movie.popularity,
        "rating": str(movie.rating),
    }
