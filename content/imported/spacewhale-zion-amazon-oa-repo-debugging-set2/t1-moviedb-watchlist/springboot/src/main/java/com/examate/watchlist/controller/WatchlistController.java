package com.examate.watchlist.controller;

import com.examate.watchlist.common.ApiException;
import com.examate.watchlist.common.CurrentUserResolver;
import com.examate.watchlist.model.Movie;
import com.examate.watchlist.model.User;
import com.examate.watchlist.model.WatchlistEntry;
import com.examate.watchlist.repository.MovieRepository;
import com.examate.watchlist.repository.WatchlistRepository;
import com.examate.watchlist.util.RateLimitingUtil;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {
    private final WatchlistRepository watchlistRepository;
    private final MovieRepository movieRepository;
    private final CurrentUserResolver currentUser;
    private final RateLimitingUtil rateLimiter;

    public WatchlistController(WatchlistRepository watchlistRepository, MovieRepository movieRepository,
                               CurrentUserResolver currentUser, RateLimitingUtil rateLimiter) {
        this.watchlistRepository = watchlistRepository;
        this.movieRepository = movieRepository;
        this.currentUser = currentUser;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping
    public Map<String, Object> list(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        User user = currentUser.resolve(userId);
        List<Map<String, Object>> movies = watchlistRepository.findByUserIdOrderByIdAsc(user.getId()).stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", e.getMovie().getId());
                    m.put("title", e.getMovie().getTitle());
                    return m;
                })
                .toList();
        return Map.of("movies", movies);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> add(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                                   @RequestBody Map<String, Object> body) {
        User user = currentUser.resolve(userId);
        String key = String.valueOf(user.getId());
        if (rateLimiter.isRateLimited(key)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
        }
        Object rawMovieId = body.get("movieId");
        if (rawMovieId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "movieId is required");
        }
        Movie movie = movieRepository.findById(Long.valueOf(rawMovieId.toString()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Movie not found"));
        WatchlistEntry entry = new WatchlistEntry(user, movie);
        rateLimiter.registerOperation(key);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Movie added to watchlist");
        response.put("movieId", movie.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{movieId}")
    public Map<String, Object> remove(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                      @PathVariable Long movieId) {
        User user = currentUser.resolve(userId);
        String key = String.valueOf(user.getId());
        WatchlistEntry entry = watchlistRepository.findByUserIdAndMovieId(user.getId(), movieId).orElse(null);
        return Map.of("message", "Movie removed from watchlist");
    }
}
