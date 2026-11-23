from django.urls import path

from . import views

urlpatterns = [
    path("loans", views.loans),
    path("loans/<int:loan_id>/fund", views.fund),
    path("loans/<int:loan_id>/repay", views.repay),
]
