package com.examate.reviews.model;

import jakarta.persistence.*;

@Entity
@Table(name = "reviews")
public class Review {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "movie_id")
    private Movie movie;

    private int rating;

    @Column(name = "review_text", length = 2000)
    private String text;

    protected Review() {}

    public Review(User user, Movie movie, int rating, String text) {
        this.user = user;
        this.movie = movie;
        this.rating = rating;
        this.text = text;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Movie getMovie() { return movie; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
}
