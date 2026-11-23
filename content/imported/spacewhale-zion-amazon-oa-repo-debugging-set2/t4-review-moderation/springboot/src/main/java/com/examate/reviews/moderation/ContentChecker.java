package com.examate.reviews.moderation;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Existing bad-content checker. This class is correct - do not change it. */
@Component
public class ContentChecker {
    public static final Set<String> BANNED_WORDS = Set.of("idiot", "stupid", "trash", "scam", "garbage");
    private static final Pattern WORD = Pattern.compile("[a-z]+");

    /** Banned words found in text: whole words, case-insensitive, unique, sorted. */
    public List<String> findViolations(String text) {
        TreeSet<String> found = new TreeSet<>();
        Matcher m = WORD.matcher(text == null ? "" : text.toLowerCase(Locale.ROOT));
        while (m.find()) {
            if (BANNED_WORDS.contains(m.group())) {
                found.add(m.group());
            }
        }
        return List.copyOf(found);
    }
}
