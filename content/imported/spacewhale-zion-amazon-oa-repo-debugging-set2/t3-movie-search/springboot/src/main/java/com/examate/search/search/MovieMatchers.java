package com.examate.search.search;

import com.examate.search.model.Movie;
import java.util.function.BiPredicate;

/** Field matchers. Each receives a movie and an ALREADY-NORMALIZED query. */
public final class MovieMatchers {
    private MovieMatchers() {}

    public static boolean titleMatches(Movie movie, String query) {
        return TextUtils.normalize(movie.getTitle()).equals(query);
    }

    public static boolean starsMatch(Movie movie, String query) {
        java.util.List<String> stars = TextUtils.splitStars(movie.getStars());
        return !stars.isEmpty() && TextUtils.normalize(stars.get(0)).contains(query);
    }

    public static boolean allFieldsMatch(Movie movie, String query) {
        return titleMatches(movie, query) && starsMatch(movie, query);
    }

    /** Returns null for an unknown field. */
    public static BiPredicate<Movie, String> forField(String field) {
        switch (field) {
            case "title":
                return MovieMatchers::titleMatches;
            case "stars":
                return MovieMatchers::starsMatch;
            case "all":
                return MovieMatchers::allFieldsMatch;
            default:
                return null;
        }
    }
}
