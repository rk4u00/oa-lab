from decimal import Decimal

import pytest

from loans.models import Loan, User


@pytest.fixture
def users(db):
    return {
        "borrower": User.objects.create(name="Kiran (borrower)", balance=Decimal("1000.00")),
        "lender": User.objects.create(name="Meera (lender)", balance=Decimal("5000.00")),
        "poor": User.objects.create(name="Arjun (low balance)", balance=Decimal("100.00")),
    }


def hdr(user):
    return {"HTTP_X_USER_ID": str(user.id)}


def create(client, user, amount):
    return client.post("/api/loans", data={"amount": amount}, content_type="application/json", **hdr(user))


def fund(client, user, loan_id):
    return client.post(f"/api/loans/{loan_id}/fund", **hdr(user))


def repay(client, user, loan_id):
    return client.post(f"/api/loans/{loan_id}/repay", **hdr(user))


def balance(user):
    return User.objects.get(pk=user.id).balance


def make_loan(user, amount, status=Loan.REQUESTED, lender=None):
    return Loan.objects.create(borrower=user, amount=Decimal(amount), status=status, lender=lender)
