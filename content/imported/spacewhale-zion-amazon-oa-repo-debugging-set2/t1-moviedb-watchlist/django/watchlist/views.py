from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .common import ApiError, current_user, error_response, parse_json
from .models import Movie, User, WatchlistEntry
from .rate_limiting import rate_limiter

TOO_MANY = ApiError(429, "Too many requests")


def _list(user):
    entries = WatchlistEntry.objects.filter(user=user).select_related("movie").order_by("id")
    return JsonResponse({"movies": [{"id": e.movie.id, "title": e.movie.title} for e in entries]})


def _add(user, data):
    if rate_limiter.is_rate_limited(user.id):
        raise TOO_MANY
    movie_id = data.get("movieId")
    if movie_id is None:
        raise ApiError(400, "movieId is required")
    movie = Movie.objects.filter(pk=movie_id).first()
    if movie is None:
        raise ApiError(404, "Movie not found")
    entry = WatchlistEntry(user=user, movie=movie)
    rate_limiter.register_operation(user.id)
    return JsonResponse({"message": "Movie added to watchlist", "movieId": movie.id}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def watchlist(request):
    try:
        user = current_user(request, User)
        if request.method == "GET":
            return _list(user)
        return _add(user, parse_json(request))
    except ApiError as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["DELETE"])
def watchlist_movie(request, movie_id):
    try:
        user = current_user(request, User)
        entry = WatchlistEntry.objects.filter(user=user, movie_id=movie_id).first()
        return JsonResponse({"message": "Movie removed from watchlist"})
    except ApiError as e:
        return error_response(e)
