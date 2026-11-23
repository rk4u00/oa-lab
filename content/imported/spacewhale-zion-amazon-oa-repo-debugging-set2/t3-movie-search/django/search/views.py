from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .common import ApiError, error_response
from .service import search_movies, serialize


@require_http_methods(["GET"])
def movie_search(request):
    try:
        movies = search_movies(request.GET.get("q"), request.GET.get("field"))
        return JsonResponse({"count": len(movies), "results": [serialize(m) for m in movies]})
    except ApiError as e:
        return error_response(e)
