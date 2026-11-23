from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import services
from .common import ApiError, current_user, error_response, parse_json
from .models import User


@csrf_exempt
@require_http_methods(["POST"])
def add_review(request, movie_id):
    try:
        user = current_user(request, User)
        review = services.add_review(user, movie_id, parse_json(request))
        return JsonResponse(services.serialize(review), status=201)
    except ApiError as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["PUT"])
def edit_review(request, review_id):
    try:
        user = current_user(request, User)
        review = services.edit_review(user, review_id, parse_json(request))
        return JsonResponse(services.serialize(review))
    except ApiError as e:
        return error_response(e)
