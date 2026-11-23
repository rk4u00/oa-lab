package com.examate.search.search;

import com.examate.search.common.ApiException;
import com.examate.search.model.Movie;
import com.examate.search.repository.MovieRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.BiPredicate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Ties together normalization, matching, filtering and ordering. */
@Service
public class MovieSearchService {
    private final MovieRepository movieRepository;

    public MovieSearchService(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    public List<Movie> search(String rawQuery, String rawField) {
        String field = (rawField == null ? "all" : rawField).trim();
        BiPredicate<Movie, String> matcher = MovieMatchers.forField(field);
        if (matcher == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "field must be one of: title, stars, all");
        }

        String query = rawQuery == null ? "" : rawQuery.trim();

        List<Movie> results = new ArrayList<>();
        for (Movie movie : movieRepository.findAll()) {
            if (field.equals("title") && !movie.isPublished()) {
                continue;
            }
            if (!query.isEmpty() && !matcher.test(movie, query)) {
                continue;
            }
            results.add(movie);
        }
        results.sort(MovieOrdering.ORDER);
        return results;
    }
}
