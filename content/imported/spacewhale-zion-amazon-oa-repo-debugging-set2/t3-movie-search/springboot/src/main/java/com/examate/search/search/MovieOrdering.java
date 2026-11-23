package com.examate.search.search;

import com.examate.search.model.Movie;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.Locale;

/** Result ordering: popularity (high first), then rating (high first), then title (A-Z). */
public final class MovieOrdering {
    private MovieOrdering() {}

    public static final Comparator<Movie> ORDER =
            Comparator.comparing(Movie::getPopularity, Comparator.<Integer>reverseOrder())
                    .thenComparing((Movie m) -> m.getTitle().toLowerCase(Locale.ROOT));
}
