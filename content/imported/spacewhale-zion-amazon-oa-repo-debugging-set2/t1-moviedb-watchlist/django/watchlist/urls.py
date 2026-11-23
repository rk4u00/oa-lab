from django.urls import path

from . import views

urlpatterns = [
    path("watchlist", views.watchlist),
    path("watchlist/<int:movie_id>", views.watchlist_movie),
]
