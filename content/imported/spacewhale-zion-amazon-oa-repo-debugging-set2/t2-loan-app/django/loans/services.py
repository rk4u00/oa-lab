"""Peer-to-peer loan business logic. See README.md for the rules."""
from decimal import Decimal, InvalidOperation

from django.db import transaction

from .common import ApiError
from .models import Loan, User


def serialize(loan):
    return {
        "id": loan.id,
        "borrowerId": loan.borrower_id,
        "lenderId": loan.lender_id,
        "amount": str(loan.amount),
        "status": loan.status,
    }


def _parse_amount(raw):
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, TypeError):
        raise ApiError(400, "amount must be a number")
    if amount < 0:
        raise ApiError(400, "amount must be greater than 0")
    return amount.quantize(Decimal("0.01"))


def create_loan(user, data):
    if "amount" not in data:
        raise ApiError(400, "amount is required")
    amount = _parse_amount(data["amount"])
    loan = Loan(borrower=user, amount=amount, status=Loan.REQUESTED)
    return loan


def my_loans(user):
    return Loan.objects.filter(lender=user).order_by("id")


def _get_loan(loan_id):
    loan = Loan.objects.select_related("borrower", "lender").filter(pk=loan_id).first()
    if loan is None:
        raise ApiError(404, "Loan not found")
    return loan


@transaction.atomic
def fund_loan(user, loan_id):
    loan = _get_loan(loan_id)
    if loan.status != Loan.REQUESTED:
        raise ApiError(409, "Loan is not open for funding")
    if loan.borrower_id == user.id:
        raise ApiError(400, "You cannot fund your own loan")

    lender = user
    borrower = loan.borrower
    if borrower.balance < loan.amount:
        raise ApiError(400, "Insufficient balance")

    lender.balance -= loan.amount
    borrower.balance += loan.amount
    borrower.save(update_fields=["balance"])

    loan.lender = lender
    loan.status = Loan.FUNDED
    loan.save(update_fields=["lender", "status"])
    return loan


@transaction.atomic
def repay_loan(user, loan_id):
    loan = _get_loan(loan_id)
    if loan.borrower_id != user.id:
        raise ApiError(403, "Only the borrower can repay this loan")
    if loan.status != Loan.FUNDED:
        raise ApiError(409, "Loan is not active")

    borrower = user
    lender = loan.lender

    borrower.balance -= loan.amount
    lender.balance += loan.amount
    borrower.save(update_fields=["balance"])
    lender.save(update_fields=["balance"])

    loan.save(update_fields=["status"])
    return loan
