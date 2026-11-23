import pytest

from watchlist.models import Movie, User
from watchlist.rate_limiting import rate_limiter


class FakeClock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


@pytest.fixture(autouse=True)
def clock():
    """Fresh rate limiter + controllable clock for every test."""
    fake = FakeClock()
    rate_limiter.reset()
    rate_limiter.clock = fake
    yield fake
    rate_limiter.reset()


@pytest.fixture
def users(db):
    return {
        "asha": User.objects.create(name="Asha", email="asha@example.com"),
        "ravi": User.objects.create(name="Ravi", email="ravi@example.com"),
    }


@pytest.fixture
def movies(db):
    titles = ["Inception", "Interstellar", "Dangal", "RRR", "Jawan", "Lagaan", "Swades"]
    return [Movie.objects.create(title=t) for t in titles]


def hdr(user):
    return {"HTTP_X_USER_ID": str(user.id)}


def add(client, user, movie_id):
    return client.post("/api/watchlist", data={"movieId": movie_id},
                       content_type="application/json", **hdr(user))


def remove(client, user, movie_id):
    return client.delete(f"/api/watchlist/{movie_id}", **hdr(user))


def titles(client, user):
    return [m["title"] for m in client.get("/api/watchlist", **hdr(user)).json()["movies"]]
