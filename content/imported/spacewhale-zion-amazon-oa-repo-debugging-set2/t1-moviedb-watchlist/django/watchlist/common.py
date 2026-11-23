"""Shared helpers. No bugs in this file."""
import json

from django.http import JsonResponse


class ApiError(Exception):
    def __init__(self, status, message, extra=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.extra = extra or {}


def parse_json(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        raise ApiError(400, "Request body must be valid JSON")


def error_response(err):
    return JsonResponse({"error": err.message, **err.extra}, status=err.status)


def current_user(request, user_model):
    """The caller is identified by the X-User-Id header (e.g. X-User-Id: 1)."""
    raw = request.headers.get("X-User-Id")
    if not raw or not raw.isdigit():
        raise ApiError(401, "Missing or invalid X-User-Id header")
    user = user_model.objects.filter(pk=int(raw)).first()
    if user is None:
        raise ApiError(401, "Unknown user")
    return user
