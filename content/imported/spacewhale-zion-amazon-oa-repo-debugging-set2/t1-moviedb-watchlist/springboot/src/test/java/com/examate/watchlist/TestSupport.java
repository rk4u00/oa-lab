package com.examate.watchlist;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.examate.watchlist.model.Movie;
import com.examate.watchlist.model.User;
import com.examate.watchlist.repository.MovieRepository;
import com.examate.watchlist.repository.UserRepository;
import com.examate.watchlist.repository.WatchlistRepository;
import com.examate.watchlist.util.RateLimitingUtil;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
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
    @Autowired protected WatchlistRepository entries;
    @Autowired protected RateLimitingUtil rateLimiter;

    protected final AtomicLong now = new AtomicLong(1_000_000_000L);
    protected User asha;
    protected User ravi;
    protected List<Movie> m;

    @BeforeEach
    void setUpData() {
        entries.deleteAll();
        movies.deleteAll();
        users.deleteAll();
        rateLimiter.reset();
        rateLimiter.setClock(now::get);
        asha = users.save(new User("Asha", "asha@example.com"));
        ravi = users.save(new User("Ravi", "ravi@example.com"));
        m = new ArrayList<>();
        for (String t : List.of("Inception", "Interstellar", "Dangal", "RRR", "Jawan", "Lagaan", "Swades")) {
            m.add(movies.save(new Movie(t)));
        }
    }

    protected ResultActions add(User u, long movieId) throws Exception {
        return mvc.perform(post("/api/watchlist").header("X-User-Id", u.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"movieId\": " + movieId + "}"));
    }

    protected ResultActions remove(User u, long movieId) throws Exception {
        return mvc.perform(delete("/api/watchlist/" + movieId).header("X-User-Id", u.getId()));
    }

    protected List<String> titles(User u) throws Exception {
        String json = mvc.perform(get("/api/watchlist").header("X-User-Id", u.getId()))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.movies[*].title");
    }
}
