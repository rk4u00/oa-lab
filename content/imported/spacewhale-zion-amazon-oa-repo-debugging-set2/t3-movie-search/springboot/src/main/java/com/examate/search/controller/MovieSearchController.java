package com.examate.search.controller;

import com.examate.search.model.Movie;
import com.examate.search.search.MovieSearchService;
import com.examate.search.search.TextUtils;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/movies")
public class MovieSearchController {
    private final MovieSearchService searchService;

    public MovieSearchController(MovieSearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(value = "q", required = false) String q,
                                      @RequestParam(value = "field", required = false) String field) {
        List<Map<String, Object>> results = searchService.search(q, field).stream().map(this::toJson).toList();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("count", results.size());
        body.put("results", results);
        return body;
    }

    private Map<String, Object> toJson(Movie m) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", m.getId());
        json.put("title", m.getTitle());
        json.put("stars", TextUtils.splitStars(m.getStars()));
        json.put("popularity", m.getPopularity());
        json.put("rating", m.getRating().toPlainString());
        return json;
    }
}
