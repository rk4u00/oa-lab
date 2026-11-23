from django.db import models


class User(models.Model):
    name = models.CharField(max_length=100)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class Loan(models.Model):
    REQUESTED = "REQUESTED"
    FUNDED = "FUNDED"
    REPAID = "REPAID"

    borrower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="borrowed_loans")
    lender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="funded_loans")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, default=REQUESTED)
    created_at = models.DateTimeField(auto_now_add=True)
