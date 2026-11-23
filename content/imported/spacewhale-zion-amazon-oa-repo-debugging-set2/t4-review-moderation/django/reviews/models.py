from django.db import models


class User(models.Model):
    name = models.CharField(max_length=100)
    violation_count = models.PositiveIntegerField(default=0)
    is_flagged = models.BooleanField(default=False)


class Movie(models.Model):
    title = models.CharField(max_length=200)


class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    text = models.TextField()


class ModerationEvent(models.Model):
    """One row per blocked review attempt, with the banned words that were found."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="moderation_events")
    words = models.CharField(max_length=500)  # comma-separated, e.g. "idiot,trash"
    created_at = models.DateTimeField(auto_now_add=True)
