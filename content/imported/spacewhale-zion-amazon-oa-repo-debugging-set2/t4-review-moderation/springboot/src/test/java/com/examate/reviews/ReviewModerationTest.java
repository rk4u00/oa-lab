package com.examate.reviews;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.examate.reviews.model.Review;
import com.examate.reviews.model.User;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReviewModerationTest extends TestSupport {

    @Test
    void cleanReviewIsCreated() throws Exception {
        postReview(neha, "Inspiring and honest film").andExpect(status().isCreated());
        assertEquals(1, reviews.findByUserId(neha.getId()).size());
    }

    @Test
    void reviewWithBannedWordsIsBlockedWith403() throws Exception {
        postReview(neha, "What a trash movie, the director is an idiot")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.violatedWords[0]").value("idiot"))
                .andExpect(jsonPath("$.violatedWords[1]").value("trash"));
        assertEquals(0, reviews.count());
    }

    @Test
    void violationCountIsPersisted() throws Exception {
        postReview(neha, "total scam");
        assertEquals(1, fresh(neha).getViolationCount());
    }

    @Test
    void userIsFlaggedAfterThreeViolations() throws Exception {
        for (String text : List.of("scam", "garbage plot", "stupid ending")) {
            postReview(neha, text).andExpect(status().isForbidden());
        }
        User user = fresh(neha);
        assertEquals(3, user.getViolationCount());
        assertTrue(user.isFlagged());
    }

    @Test
    void flaggedUserIsBlockedEvenWithCleanText() throws Exception {
        postReview(flagged, "Beautiful film").andExpect(status().isForbidden());
        assertEquals(0, reviews.count());
    }

    @Test
    void editingReviewWithBannedWordsKeepsOriginalText() throws Exception {
        Review review = existingReview(neha);
        putReview(neha, review.getId(), "Actually this is garbage").andExpect(status().isForbidden());
        assertEquals("Loved the story and the acting", reviews.findById(review.getId()).orElseThrow().getText());
    }

    @Test
    void ratingOutOfRangeReturns400() throws Exception {
        postReview(neha, "Good", 9).andExpect(status().isBadRequest());
    }

    @Test
    void cannotEditSomeoneElsesReview() throws Exception {
        Review review = existingReview(neha);
        putReview(vikram, review.getId(), "Nice").andExpect(status().isNotFound());
    }
}
