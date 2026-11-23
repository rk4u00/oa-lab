from django.urls import path

from . import views

urlpatterns = [
    path("tickets/", views.tickets, name="tickets"),
    path("tickets/<int:ticket_id>/", views.ticket_detail, name="ticket-detail"),
    path("tickets/<int:ticket_id>/replies/", views.ticket_replies, name="ticket-replies"),
]
