import pytest

from tests.conftest import add, hdr, remove, titles

pytestmark = pytest.mark.django_db


def test_new_user_has_empty_watchlist(client, users, movies):
    res = client.get("/api/watchlist", **hdr(users["asha"]))
    assert res.status_code == 200
    assert res.json() == {"movies": []}


def test_add_movie_is_saved_to_watchlist(client, users, movies):
    res = add(client, users["asha"], movies[0].id)
    assert res.status_code == 201
    assert res.json()["message"] == "Movie added to watchlist"
    assert titles(client, users["asha"]) == ["Inception"]


def test_add_duplicate_movie_returns_400(client, users, movies):
    add(client, users["asha"], movies[0].id)
    res = add(client, users["asha"], movies[0].id)
    assert res.status_code == 400
    assert res.json()["error"] == "Movie already in watchlist"
    assert titles(client, users["asha"]) == ["Inception"]


def test_remove_movie_deletes_it(client, users, movies):
    add(client, users["asha"], movies[0].id)
    add(client, users["asha"], movies[1].id)
    res = remove(client, users["asha"], movies[0].id)
    assert res.status_code == 200
    assert res.json()["message"] == "Movie removed from watchlist"
    assert titles(client, users["asha"]) == ["Interstellar"]


def test_remove_movie_not_in_watchlist_returns_404(client, users, movies):
    res = remove(client, users["asha"], movies[2].id)
    assert res.status_code == 404
    assert res.json()["error"] == "Movie not found in watchlist"


def test_sixth_add_within_a_minute_is_rate_limited(client, users, movies):
    for m in movies[:5]:
        assert add(client, users["asha"], m.id).status_code == 201
    res = add(client, users["asha"], movies[5].id)
    assert res.status_code == 429
    assert len(titles(client, users["asha"])) == 5


def test_remove_counts_towards_rate_limit(client, users, movies):
    for m in movies[:5]:
        add(client, users["asha"], m.id)
    res = remove(client, users["asha"], movies[0].id)
    assert res.status_code == 429
    assert "Inception" in titles(client, users["asha"])


def test_add_unknown_movie_returns_404(client, users, movies):
    res = add(client, users["asha"], 9999)
    assert res.status_code == 404
    assert res.json()["error"] == "Movie not found"
