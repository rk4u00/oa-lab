package com.examate.search;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.examate.search.model.Movie;
import com.examate.search.repository.MovieRepository;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Shared setup for the tests. Do not edit. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class TestSupport {
    @Autowired protected MockMvc mvc;
    @Autowired protected MovieRepository movies;

    @BeforeEach
    void setUpData() {
        movies.deleteAll();
        save("Kalki 2898 AD", "Prabhas, Deepika Padukone, Amitabh Bachchan", 950, "7.4", true);
        save("Pathaan", "Shah Rukh Khan, Deepika Padukone", 900, "7.2", true);
        save("Jawan", "Shah Rukh Khan, Nayanthara", 900, "6.8", true);
        save("Baahubali 2", "Prabhas, Anushka Shetty", 800, "8.2", true);
        save("Piku", "Deepika Padukone, Irrfan Khan", 500, "7.6", true);
        save("Salaar", "Prabhas, Prithviraj Sukumaran", 800, "8.3", true);
        save("Fighter", "Hrithik Roshan, Deepika Padukone", 700, "6.2", false);         // unpublished
        save("Dunki", "Shah Rukh Khan, Taapsee Pannu", 650, "6.7", true);
        save("Untitled Prabhas Film", "Prabhas", 999, "9.0", false);                    // unpublished
    }

    private void save(String title, String stars, int popularity, String rating, boolean published) {
        movies.save(new Movie(title, stars, popularity, new BigDecimal(rating), published));
    }

    /** search("q", "kalki", "field", "title") */
    protected ResultActions search(String... params) throws Exception {
        MockHttpServletRequestBuilder req = get("/api/movies/search");
        for (int i = 0; i < params.length; i += 2) {
            req = req.param(params[i], params[i + 1]);
        }
        return mvc.perform(req);
    }

    protected List<String> titles(String... params) throws Exception {
        String json = search(params).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.results[*].title");
    }
}
