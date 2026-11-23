from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import services
from .common import ApiError, current_user, error_response, parse_json
from .models import User


@csrf_exempt
@require_http_methods(["GET", "POST"])
def loans(request):
    try:
        user = current_user(request, User)
        if request.method == "GET":
            return JsonResponse({"loans": [services.serialize(l) for l in services.my_loans(user)]})
        loan = services.create_loan(user, parse_json(request))
        return JsonResponse(services.serialize(loan), status=201)
    except ApiError as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def fund(request, loan_id):
    try:
        user = current_user(request, User)
        return JsonResponse(services.serialize(services.fund_loan(user, loan_id)))
    except ApiError as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def repay(request, loan_id):
    try:
        user = current_user(request, User)
        return JsonResponse(services.serialize(services.repay_loan(user, loan_id)))
    except ApiError as e:
        return error_response(e)
