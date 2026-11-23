import pytest

from reviews.models import Review
from tests.conftest import existing_review, fresh, post_review, put_review

pytestmark = pytest.mark.django_db


def test_clean_review_is_created(client, users, movie):
    res = post_review(client, users["neha"], movie, "Inspiring and honest film")
    assert res.status_code == 201
    assert Review.objects.filter(user=users["neha"]).count() == 1


def test_review_with_banned_words_is_blocked_with_403(client, users, movie):
    res = post_review(client, users["neha"], movie, "What a trash movie, the director is an idiot")
    assert res.status_code == 403
    assert res.json()["violatedWords"] == ["idiot", "trash"]
    assert Review.objects.count() == 0


def test_violation_count_is_persisted(client, users, movie):
    post_review(client, users["neha"], movie, "total scam")
    assert fresh(users["neha"]).violation_count == 1


def test_user_is_flagged_after_three_violations(client, users, movie):
    for text in ["scam", "garbage plot", "stupid ending"]:
        assert post_review(client, users["neha"], movie, text).status_code == 403
    user = fresh(users["neha"])
    assert user.violation_count == 3
    assert user.is_flagged is True


def test_flagged_user_is_blocked_even_with_clean_text(client, users, movie):
    res = post_review(client, users["flagged"], movie, "Beautiful film")
    assert res.status_code == 403
    assert Review.objects.count() == 0


def test_editing_review_with_banned_words_keeps_original_text(client, users, movie):
    review = existing_review(users["neha"], movie)
    res = put_review(client, users["neha"], review.id, "Actually this is garbage")
    assert res.status_code == 403
    review.refresh_from_db()
    assert review.text == "Loved the story and the acting"


def test_rating_out_of_range_returns_400(client, users, movie):
    assert post_review(client, users["neha"], movie, "Good", rating=9).status_code == 400


def test_cannot_edit_someone_elses_review(client, users, movie):
    review = existing_review(users["neha"], movie)
    assert put_review(client, users["vikram"], review.id, "Nice").status_code == 404
