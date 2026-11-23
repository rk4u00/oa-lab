package com.examate.watchlist.model;

import jakarta.persistence.*;

@Entity
@Table(name = "watchlist_entries",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "movie_id"}))
public class WatchlistEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "movie_id")
    private Movie movie;

    protected WatchlistEntry() {}

    public WatchlistEntry(User user, Movie movie) {
        this.user = user;
        this.movie = movie;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Movie getMovie() { return movie; }
}
