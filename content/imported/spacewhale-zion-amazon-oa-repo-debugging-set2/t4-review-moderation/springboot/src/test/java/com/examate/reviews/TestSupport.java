package com.examate.reviews;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.examate.reviews.model.Movie;
import com.examate.reviews.model.Review;
import com.examate.reviews.model.User;
import com.examate.reviews.repository.ModerationEventRepository;
import com.examate.reviews.repository.MovieRepository;
import com.examate.reviews.repository.ReviewRepository;
import com.examate.reviews.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Shared setup for the tests. Do not edit. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class TestSupport {
    @Autowired protected MockMvc mvc;
    @Autowired protected UserRepository users;
    @Autowired protected MovieRepository movies;
    @Autowired protected ReviewRepository reviews;
    @Autowired protected ModerationEventRepository events;

    protected User neha;
    protected User vikram;
    protected User flagged;
    protected Movie movie;

    @BeforeEach
    void setUpData() {
        events.deleteAll();
        reviews.deleteAll();
        movies.deleteAll();
        users.deleteAll();
        neha = users.save(new User("Neha", 0, false));
        vikram = users.save(new User("Vikram", 0, false));
        flagged = users.save(new User("Flagged Fred", 3, true));
        movie = movies.save(new Movie("12th Fail"));
    }

    private static String body(String text, int rating) {
        return "{\"text\": \"" + text + "\", \"rating\": " + rating + "}";
    }

    protected ResultActions postReview(User u, String text, int rating) throws Exception {
        return mvc.perform(post("/api/movies/" + movie.getId() + "/reviews").header("X-User-Id", u.getId())
                .contentType(MediaType.APPLICATION_JSON).content(body(text, rating)));
    }

    protected ResultActions postReview(User u, String text) throws Exception {
        return postReview(u, text, 4);
    }

    protected ResultActions putReview(User u, long reviewId, String text, int rating) throws Exception {
        return mvc.perform(put("/api/reviews/" + reviewId).header("X-User-Id", u.getId())
                .contentType(MediaType.APPLICATION_JSON).content(body(text, rating)));
    }

    protected ResultActions putReview(User u, long reviewId, String text) throws Exception {
        return putReview(u, reviewId, text, 4);
    }

    protected User fresh(User u) {
        return users.findById(u.getId()).orElseThrow();
    }

    protected Review existingReview(User u) {
        return reviews.save(new Review(u, movie, 5, "Loved the story and the acting"));
    }
}
