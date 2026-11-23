import pytest

from tests.conftest import search, titles

pytestmark = pytest.mark.django_db


def test_rule1_partial_title_match(client, movies):
    assert titles(search(client, q="kalki", field="title")) == ["Kalki 2898 AD"]


def test_rule3_title_search_ignores_case(client, movies):
    assert titles(search(client, q="KALKI 2898 AD", field="title")) == ["Kalki 2898 AD"]


def test_rule2_stars_field_matches_any_cast_member(client, movies):
    # Deepika is not the first-listed star in Kalki, Pathaan or Fighter.
    assert titles(search(client, q="deepika", field="stars")) == ["Kalki 2898 AD", "Pathaan", "Piku"]


def test_rule2_all_fields_matches_title_or_stars(client, movies):
    # "pa" is in the TITLE of Pathaan only, but in the STARS of Kalki, Pathaan, Piku (Padukone) and Dunki (Pannu).
    assert titles(search(client, q="pa", field="all")) == ["Kalki 2898 AD", "Pathaan", "Dunki", "Piku"]


def test_rule5_unpublished_movies_never_returned_in_stars_search(client, movies):
    result = titles(search(client, q="prabhas", field="stars"))
    assert "Untitled Prabhas Film" not in result
    assert sorted(result) == ["Baahubali 2", "Kalki 2898 AD", "Salaar"]


def test_rule4_order_by_popularity_then_rating_then_title(client, movies):
    # Pathaan (7.2) & Jawan (6.8) tie on popularity 900 -> higher rating first.
    # Salaar (8.3) & Baahubali 2 (8.2) tie on popularity 800 -> higher rating first.
    assert titles(search(client, q="a", field="title")) == [
        "Kalki 2898 AD", "Pathaan", "Jawan", "Salaar", "Baahubali 2",
    ]


def test_title_field_ignores_stars(client, movies):
    assert titles(search(client, q="shah rukh", field="title")) == []


def test_unknown_field_returns_400(client, movies):
    assert search(client, q="x", field="director").status_code == 400
