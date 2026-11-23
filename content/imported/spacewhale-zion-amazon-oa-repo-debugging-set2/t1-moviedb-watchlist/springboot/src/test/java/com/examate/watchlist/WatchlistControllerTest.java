package com.examate.watchlist;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class WatchlistControllerTest extends TestSupport {

    @Test
    void newUserHasEmptyWatchlist() throws Exception {
        mvc.perform(get("/api/watchlist").header("X-User-Id", asha.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.movies").isEmpty());
    }

    @Test
    void addMovieIsSavedToWatchlist() throws Exception {
        add(asha, m.get(0).getId())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Movie added to watchlist"));
        assertEquals(List.of("Inception"), titles(asha));
    }

    @Test
    void addDuplicateMovieReturns400() throws Exception {
        add(asha, m.get(0).getId());
        add(asha, m.get(0).getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Movie already in watchlist"));
        assertEquals(List.of("Inception"), titles(asha));
    }

    @Test
    void removeMovieDeletesIt() throws Exception {
        add(asha, m.get(0).getId());
        add(asha, m.get(1).getId());
        remove(asha, m.get(0).getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Movie removed from watchlist"));
        assertEquals(List.of("Interstellar"), titles(asha));
    }

    @Test
    void removeMovieNotInWatchlistReturns404() throws Exception {
        remove(asha, m.get(2).getId())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Movie not found in watchlist"));
    }

    @Test
    void sixthAddWithinAMinuteIsRateLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            add(asha, m.get(i).getId()).andExpect(status().isCreated());
        }
        add(asha, m.get(5).getId()).andExpect(status().isTooManyRequests());
        assertEquals(5, titles(asha).size());
    }

    @Test
    void removeCountsTowardsRateLimit() throws Exception {
        for (int i = 0; i < 5; i++) {
            add(asha, m.get(i).getId());
        }
        remove(asha, m.get(0).getId()).andExpect(status().isTooManyRequests());
        assertTrue(titles(asha).contains("Inception"));
    }

    @Test
    void addUnknownMovieReturns404() throws Exception {
        add(asha, 999_999L)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Movie not found"));
    }
}
