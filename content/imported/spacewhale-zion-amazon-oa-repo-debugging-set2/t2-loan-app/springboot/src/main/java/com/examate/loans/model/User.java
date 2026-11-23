package com.examate.loans.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "app_users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @Column(precision = 12, scale = 2)
    private BigDecimal balance;

    protected User() {}

    public User(String name, BigDecimal balance) {
        this.name = name;
        this.balance = balance;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }
}
