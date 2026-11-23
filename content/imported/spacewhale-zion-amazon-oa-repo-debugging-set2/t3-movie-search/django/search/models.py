from django.db import models


class Movie(models.Model):
    title = models.CharField(max_length=200)
    stars = models.CharField(max_length=500, help_text="Comma-separated cast, e.g. 'Prabhas, Deepika Padukone'")
    popularity = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    published = models.BooleanField(default=True)
