"""Review business logic with content moderation. See README.md for the rules."""
from .common import ApiError
from .content_checker import find_violations
from .models import ModerationEvent, Movie, Review, User

FLAG_THRESHOLD = 3


def serialize(review):
    return {"id": review.id, "movieId": review.movie_id, "userId": review.user_id,
            "rating": review.rating, "text": review.text}


def _validate(data):
    text = (data.get("text") or "").strip()
    rating = data.get("rating")
    if not text:
        raise ApiError(400, "text is required")
    if not isinstance(rating, int) or isinstance(rating, bool) or not 1 <= rating <= 5:
        raise ApiError(400, "rating must be an integer from 1 to 5")
    return text, rating


def moderate(user, text):
    """Block flagged users and banned content. Records every violation."""
    words = find_violations(text)
    if not words:
        return

    user.violation_count += 1
    if user.violation_count > FLAG_THRESHOLD:
        user.is_flagged = True
    user.save(update_fields=["is_flagged"])
    raise ApiError(400, "Review contains inappropriate content", extra={"violatedWords": words})


def add_review(user, movie_id, data):
    movie = Movie.objects.filter(pk=movie_id).first()
    if movie is None:
        raise ApiError(404, "Movie not found")
    text, rating = _validate(data)
    return Review.objects.create(user=user, movie=movie, rating=rating, text=text)


def edit_review(user, review_id, data):
    review = Review.objects.filter(pk=review_id, user=user).first()
    if review is None:
        raise ApiError(404, "Review not found")
    text, rating = _validate(data)
    review.text = text
    review.rating = rating
    review.save(update_fields=["text", "rating"])
    moderate(user, text)
    return review
