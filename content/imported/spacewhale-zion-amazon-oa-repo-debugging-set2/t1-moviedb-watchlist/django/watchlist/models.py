from django.db import models


class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()


class Movie(models.Model):
    title = models.CharField(max_length=200)


class WatchlistEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watchlist")
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "movie"], name="unique_watchlist_entry")]
