import json

import pytest

from tickets.models import Ticket

pytestmark = pytest.mark.django_db


def post(client, url, body):
    return client.post(url, data=json.dumps(body), content_type="application/json")


def make_ticket(client, **overrides):
    body = {"title": "Printer on fire", "customer_email": "cust@example.com", **overrides}
    return post(client, "/api/tickets/", body)


def test_create_ticket_starts_open(client):
    res = make_ticket(client, priority="high")
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "open"
    assert data["priority"] == "high"


def test_create_ticket_missing_fields_is_rejected_and_not_saved(client):
    res = post(client, "/api/tickets/", {"title": ""})
    assert res.status_code == 400
    assert set(res.json()["errors"]) >= {"title", "customer_email"}
    assert Ticket.objects.count() == 0


def test_create_ticket_invalid_priority(client):
    res = make_ticket(client, priority="urgent")
    assert res.status_code == 400
    assert "priority" in res.json()["errors"]
    assert Ticket.objects.count() == 0


def test_agent_reply_moves_ticket_in_progress(client):
    ticket_id = make_ticket(client).json()["id"]
    res = post(client, f"/api/tickets/{ticket_id}/replies/", {"author": "agent@helpdesk.io", "message": "Looking into it"})
    assert res.status_code == 201
    assert Ticket.objects.get(pk=ticket_id).status == "in_progress"


def test_reply_to_closed_ticket_conflicts(client):
    ticket_id = make_ticket(client).json()["id"]
    Ticket.objects.filter(pk=ticket_id).update(status="closed")
    res = post(client, f"/api/tickets/{ticket_id}/replies/", {"author": "cust@example.com", "message": "Any update?"})
    assert res.status_code == 409
    assert Ticket.objects.get(pk=ticket_id).replies.count() == 0


def test_replies_listed_oldest_first(client):
    ticket_id = make_ticket(client).json()["id"]
    for msg in ["first", "second", "third"]:
        post(client, f"/api/tickets/{ticket_id}/replies/", {"author": "cust@example.com", "message": msg})
    data = client.get(f"/api/tickets/{ticket_id}/").json()
    assert [r["message"] for r in data["replies"]] == ["first", "second", "third"]
