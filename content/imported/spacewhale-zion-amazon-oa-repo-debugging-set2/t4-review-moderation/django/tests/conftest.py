import pytest

from reviews.models import Movie, Review, User


@pytest.fixture
def users(db):
    return {
        "neha": User.objects.create(name="Neha"),
        "vikram": User.objects.create(name="Vikram"),
        "flagged": User.objects.create(name="Flagged Fred", violation_count=3, is_flagged=True),
    }


@pytest.fixture
def movie(db):
    return Movie.objects.create(title="12th Fail")


def hdr(user):
    return {"HTTP_X_USER_ID": str(user.id)}


def post_review(client, user, movie, text, rating=4):
    return client.post(f"/api/movies/{movie.id}/reviews", data={"text": text, "rating": rating},
                       content_type="application/json", **hdr(user))


def put_review(client, user, review_id, text, rating=4):
    return client.put(f"/api/reviews/{review_id}", data={"text": text, "rating": rating},
                      content_type="application/json", **hdr(user))


def fresh(user):
    return User.objects.get(pk=user.id)


def existing_review(user, movie, text="Loved the story and the acting", rating=5):
    return Review.objects.create(user=user, movie=movie, text=text, rating=rating)
