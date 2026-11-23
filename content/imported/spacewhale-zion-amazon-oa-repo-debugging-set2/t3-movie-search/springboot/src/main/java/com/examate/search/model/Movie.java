package com.examate.search.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "movies")
public class Movie {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;

    /** Comma-separated cast, e.g. "Prabhas, Deepika Padukone". */
    @Column(length = 500)
    private String stars;

    private int popularity;

    @Column(precision = 3, scale = 1)
    private BigDecimal rating;

    private boolean published;

    protected Movie() {}

    public Movie(String title, String stars, int popularity, BigDecimal rating, boolean published) {
        this.title = title;
        this.stars = stars;
        this.popularity = popularity;
        this.rating = rating;
        this.published = published;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getStars() { return stars; }
    public int getPopularity() { return popularity; }
    public BigDecimal getRating() { return rating; }
    public boolean isPublished() { return published; }
}
