from decimal import Decimal

import pytest

from search.models import Movie

MOVIES = [
    # title,                 stars,                                        popularity, rating, published
    ("Kalki 2898 AD",        "Prabhas, Deepika Padukone, Amitabh Bachchan", 950, "7.4", True),
    ("Pathaan",              "Shah Rukh Khan, Deepika Padukone",            900, "7.2", True),
    ("Jawan",                "Shah Rukh Khan, Nayanthara",                  900, "6.8", True),
    ("Baahubali 2",          "Prabhas, Anushka Shetty",                     800, "8.2", True),
    ("Piku",                 "Deepika Padukone, Irrfan Khan",               500, "7.6", True),
    ("Salaar",               "Prabhas, Prithviraj Sukumaran",               800, "8.3", True),
    ("Fighter",              "Hrithik Roshan, Deepika Padukone",            700, "6.2", False),  # unpublished
    ("Dunki",                "Shah Rukh Khan, Taapsee Pannu",               650, "6.7", True),
    ("Untitled Prabhas Film", "Prabhas",                                   999, "9.0", False),  # unpublished
]


@pytest.fixture
def movies(db):
    return [
        Movie.objects.create(title=t, stars=s, popularity=p, rating=Decimal(r), published=pub)
        for t, s, p, r, pub in MOVIES
    ]


def search(client, **params):
    return client.get("/api/movies/search", params)


def titles(res):
    assert res.status_code == 200, res.content
    return [m["title"] for m in res.json()["results"]]
