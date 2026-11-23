from django.urls import path

from . import views

urlpatterns = [
    path("movies/<int:movie_id>/reviews", views.add_review),
    path("reviews/<int:review_id>", views.edit_review),
]
