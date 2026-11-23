from django.urls import path

from . import views

urlpatterns = [
    path("movies/search", views.movie_search),
]
