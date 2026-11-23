package com.examate.reviews.controller;

import com.examate.reviews.common.CurrentUserResolver;
import com.examate.reviews.model.Review;
import com.examate.reviews.service.ReviewService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ReviewController {
    private final ReviewService reviewService;
    private final CurrentUserResolver currentUser;

    public ReviewController(ReviewService reviewService, CurrentUserResolver currentUser) {
        this.reviewService = reviewService;
        this.currentUser = currentUser;
    }

    private Map<String, Object> toJson(Review r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("movieId", r.getMovie().getId());
        m.put("userId", r.getUser().getId());
        m.put("rating", r.getRating());
        m.put("text", r.getText());
        return m;
    }

    @PostMapping("/movies/{movieId}/reviews")
    public ResponseEntity<Map<String, Object>> add(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                                   @PathVariable Long movieId,
                                                   @RequestBody Map<String, Object> body) {
        Review review = reviewService.addReview(currentUser.resolve(userId), movieId, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(toJson(review));
    }

    @PutMapping("/reviews/{reviewId}")
    public Map<String, Object> edit(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @PathVariable Long reviewId,
                                    @RequestBody Map<String, Object> body) {
        return toJson(reviewService.editReview(currentUser.resolve(userId), reviewId, body));
    }
}
