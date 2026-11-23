package com.examate.reviews.model;

import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private int violationCount;
    private boolean flagged;

    protected User() {}

    public User(String name, int violationCount, boolean flagged) {
        this.name = name;
        this.violationCount = violationCount;
        this.flagged = flagged;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public int getViolationCount() { return violationCount; }
    public void setViolationCount(int violationCount) { this.violationCount = violationCount; }
    public boolean isFlagged() { return flagged; }
    public void setFlagged(boolean flagged) { this.flagged = flagged; }
}
