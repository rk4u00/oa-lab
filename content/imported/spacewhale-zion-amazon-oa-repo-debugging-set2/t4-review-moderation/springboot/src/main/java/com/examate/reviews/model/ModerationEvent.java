package com.examate.reviews.model;

import jakarta.persistence.*;

/** One row per blocked review attempt, with the banned words that were found. */
@Entity
@Table(name = "moderation_events")
public class ModerationEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    /** Comma-separated, e.g. "idiot,trash". */
    private String words;

    protected ModerationEvent() {}

    public ModerationEvent(User user, String words) {
        this.user = user;
        this.words = words;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getWords() { return words; }
}
