package com.examate.reviews.service;

import com.examate.reviews.common.ApiException;
import com.examate.reviews.model.ModerationEvent;
import com.examate.reviews.model.Movie;
import com.examate.reviews.model.Review;
import com.examate.reviews.model.User;
import com.examate.reviews.moderation.ContentChecker;
import com.examate.reviews.repository.ModerationEventRepository;
import com.examate.reviews.repository.MovieRepository;
import com.examate.reviews.repository.ReviewRepository;
import com.examate.reviews.repository.UserRepository;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Review logic with content moderation. See README.md for the rules.
 */
@Service
public class ReviewService {
    public static final int FLAG_THRESHOLD = 3;

    private final ReviewRepository reviewRepository;
    private final MovieRepository movieRepository;
    private final UserRepository userRepository;
    private final ModerationEventRepository moderationEventRepository;
    private final ContentChecker contentChecker;

    public ReviewService(ReviewRepository reviewRepository, MovieRepository movieRepository,
                         UserRepository userRepository, ModerationEventRepository moderationEventRepository,
                         ContentChecker contentChecker) {
        this.reviewRepository = reviewRepository;
        this.movieRepository = movieRepository;
        this.userRepository = userRepository;
        this.moderationEventRepository = moderationEventRepository;
        this.contentChecker = contentChecker;
    }

    record ValidReview(String text, int rating) {}

    private ValidReview validate(Map<String, Object> body) {
        Object rawText = body.get("text");
        String text = rawText == null ? "" : rawText.toString().trim();
        if (text.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "text is required");
        }
        Object rawRating = body.get("rating");
        if (!(rawRating instanceof Integer rating) || rating < 1 || rating > 5) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "rating must be an integer from 1 to 5");
        }
        return new ValidReview(text, rating);
    }

    /** Block flagged users and banned content. Records every violation. */
    void moderate(User user, String text) {
        List<String> words = contentChecker.findViolations(text);
        if (words.isEmpty()) {
            return;
        }

        user.setViolationCount(user.getViolationCount() + 1);
        if (user.getViolationCount() > FLAG_THRESHOLD) {
            user.setFlagged(true);
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Review contains inappropriate content",
                Map.of("violatedWords", words));
    }

    public Review addReview(User user, Long movieId, Map<String, Object> body) {
        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Movie not found"));
        ValidReview valid = validate(body);
        return reviewRepository.save(new Review(user, movie, valid.rating(), valid.text()));
    }

    public Review editReview(User user, Long reviewId, Map<String, Object> body) {
        Review review = reviewRepository.findByIdAndUserId(reviewId, user.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Review not found"));
        ValidReview valid = validate(body);
        review.setText(valid.text());
        review.setRating(valid.rating());
        Review saved = reviewRepository.save(review);
        moderate(user, valid.text());
        return saved;
    }
}
