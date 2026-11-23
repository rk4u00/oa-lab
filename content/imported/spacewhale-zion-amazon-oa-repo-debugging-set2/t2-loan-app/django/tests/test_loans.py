from decimal import Decimal

import pytest

from loans.models import Loan
from tests.conftest import balance, create, fund, hdr, make_loan, repay

pytestmark = pytest.mark.django_db


def test_user_can_create_a_loan(client, users):
    res = create(client, users["borrower"], "500")
    assert res.status_code == 201
    body = res.json()
    assert body["id"] is not None
    assert body["status"] == "REQUESTED"
    assert Loan.objects.filter(pk=body["id"], borrower=users["borrower"]).exists()


def test_user_can_view_their_existing_loans(client, users):
    create(client, users["borrower"], "500")
    create(client, users["borrower"], "250")
    res = client.get("/api/loans", **hdr(users["borrower"]))
    assert res.status_code == 200
    assert [l["amount"] for l in res.json()["loans"]] == ["500.00", "250.00"]


def test_funding_moves_money_from_lender_to_borrower(client, users):
    loan = make_loan(users["borrower"], "500")
    res = fund(client, users["lender"], loan.id)
    assert res.status_code == 200
    assert res.json()["status"] == "FUNDED"
    assert balance(users["lender"]) == Decimal("4500.00")
    assert balance(users["borrower"]) == Decimal("1500.00")


def test_user_with_insufficient_balance_cannot_fund(client, users):
    loan = make_loan(users["borrower"], "500")
    res = fund(client, users["poor"], loan.id)
    assert res.status_code == 400
    assert res.json()["error"] == "Insufficient balance"
    assert balance(users["poor"]) == Decimal("100.00")
    assert Loan.objects.get(pk=loan.id).status == "REQUESTED"


def test_repay_with_insufficient_balance_is_rejected(client, users):
    loan = make_loan(users["poor"], "500", status=Loan.FUNDED, lender=users["lender"])
    res = repay(client, users["poor"], loan.id)
    assert res.status_code == 400
    assert res.json()["error"] == "Insufficient balance"
    assert balance(users["poor"]) == Decimal("100.00")


def test_repaid_loan_is_closed(client, users):
    loan = make_loan(users["borrower"], "500", status=Loan.FUNDED, lender=users["lender"])
    first = repay(client, users["borrower"], loan.id)
    assert first.status_code == 200
    assert first.json()["status"] == "REPAID"
    assert balance(users["borrower"]) == Decimal("500.00")
    assert balance(users["lender"]) == Decimal("5500.00")

    second = repay(client, users["borrower"], loan.id)
    assert second.status_code == 409


def test_cannot_fund_your_own_loan(client, users):
    loan = make_loan(users["borrower"], "500")
    res = fund(client, users["borrower"], loan.id)
    assert res.status_code == 400


def test_unknown_loan_returns_404(client, users):
    assert fund(client, users["lender"], 9999).status_code == 404
