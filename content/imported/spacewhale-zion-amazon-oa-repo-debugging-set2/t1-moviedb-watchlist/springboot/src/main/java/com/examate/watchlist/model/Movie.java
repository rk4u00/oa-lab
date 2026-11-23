package com.examate.watchlist.model;

import jakarta.persistence.*;

@Entity
@Table(name = "movies")
public class Movie {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;

    protected Movie() {}

    public Movie(String title) { this.title = title; }

    public Long getId() { return id; }
    public String getTitle() { return title; }
}
