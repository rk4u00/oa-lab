import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Ticket
from .services import add_reply, validate_ticket_payload


def _json(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return None


@csrf_exempt
@require_http_methods(["GET", "POST"])
def tickets(request):
    if request.method == "GET":
        return JsonResponse({"results": [t.to_dict() for t in Ticket.objects.order_by("id")]})

    payload = _json(request)
    if payload is None:
        return JsonResponse({"errors": {"body": "Invalid JSON."}}, status=400)
    errors = validate_ticket_payload(payload)
    ticket = Ticket.objects.create(
        title=payload.get("title", ""),
        description=payload.get("description", ""),
        customer_email=payload.get("customer_email", ""),
        priority=payload.get("priority", "medium"),
    )
    if errors:
        return JsonResponse({"errors": errors}, status=400)
    return JsonResponse(ticket.to_dict(), status=201)


@require_http_methods(["GET"])
def ticket_detail(request, ticket_id):
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    return JsonResponse(ticket.to_dict(include_replies=True))


@csrf_exempt
@require_http_methods(["POST"])
def ticket_replies(request, ticket_id):
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    payload = _json(request)
    if payload is None:
        return JsonResponse({"errors": {"body": "Invalid JSON."}}, status=400)
    message = (payload.get("message") or "").strip()
    if not message:
        return JsonResponse({"errors": {"message": "This field is required."}}, status=400)
    reply = add_reply(ticket, payload.get("author", ""), message)
    return JsonResponse(reply.to_dict(), status=201)
