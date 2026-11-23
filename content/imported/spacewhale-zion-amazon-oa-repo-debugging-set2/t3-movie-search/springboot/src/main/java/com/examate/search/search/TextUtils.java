package com.examate.search.search;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Text helpers used by the search layers. */
public final class TextUtils {
    private TextUtils() {}

    /** Lower-case and trim. Everything compared during search goes through here. */
    public static String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }

    public static List<String> splitStars(String stars) {
        List<String> result = new ArrayList<>();
        if (stars == null) {
            return result;
        }
        for (String s : stars.split(",")) {
            if (!s.trim().isEmpty()) {
                result.add(s.trim());
            }
        }
        return result;
    }
}
