from .models import Ticket


def validate_ticket_payload(payload):
    errors = {}
    if not payload.get("title"):
        errors["title"] = "This field is required."
    if not payload.get("customer_email"):
        errors["customer_email"] = "This field is required."
    priority = payload.get("priority", "medium")
    if priority not in Ticket.PRIORITIES:
        errors["priority"] = f"Must be one of {', '.join(Ticket.PRIORITIES)}."
    return errors


def add_reply(ticket, author, message):
    reply = ticket.replies.create(author=author, message=message)
    if author != ticket.customer_email and ticket.status == Ticket.STATUS_OPEN:
        ticket.status = Ticket.STATUS_IN_PROGRESS
    return reply
