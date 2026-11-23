package com.examate.search;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class MovieSearchTest extends TestSupport {

    @Test
    void rule1PartialTitleMatch() throws Exception {
        assertEquals(List.of("Kalki 2898 AD"), titles("q", "kalki", "field", "title"));
    }

    @Test
    void rule3TitleSearchIgnoresCase() throws Exception {
        assertEquals(List.of("Kalki 2898 AD"), titles("q", "KALKI 2898 AD", "field", "title"));
    }

    @Test
    void rule2StarsFieldMatchesAnyCastMember() throws Exception {
        // Deepika is not the first-listed star in Kalki or Pathaan.
        assertEquals(List.of("Kalki 2898 AD", "Pathaan", "Piku"), titles("q", "deepika", "field", "stars"));
    }

    @Test
    void rule2AllFieldsMatchesTitleOrStars() throws Exception {
        // "pa" is in the TITLE of Pathaan only, but in the STARS of Kalki, Pathaan, Piku (Padukone) and Dunki (Pannu).
        assertEquals(List.of("Kalki 2898 AD", "Pathaan", "Dunki", "Piku"), titles("q", "pa", "field", "all"));
    }

    @Test
    void rule5UnpublishedMoviesNeverReturnedInStarsSearch() throws Exception {
        List<String> result = new ArrayList<>(titles("q", "prabhas", "field", "stars"));
        assertFalse(result.contains("Untitled Prabhas Film"));
        Collections.sort(result);
        assertEquals(List.of("Baahubali 2", "Kalki 2898 AD", "Salaar"), result);
    }

    @Test
    void rule4OrderByPopularityThenRatingThenTitle() throws Exception {
        // Pathaan (7.2) & Jawan (6.8) tie on popularity 900 -> higher rating first.
        // Salaar (8.3) & Baahubali 2 (8.2) tie on popularity 800 -> higher rating first.
        assertEquals(List.of("Kalki 2898 AD", "Pathaan", "Jawan", "Salaar", "Baahubali 2"),
                titles("q", "a", "field", "title"));
    }

    @Test
    void titleFieldIgnoresStars() throws Exception {
        assertEquals(List.of(), titles("q", "shah rukh", "field", "title"));
    }

    @Test
    void unknownFieldReturns400() throws Exception {
        search("q", "x", "field", "director").andExpect(status().isBadRequest());
    }
}
