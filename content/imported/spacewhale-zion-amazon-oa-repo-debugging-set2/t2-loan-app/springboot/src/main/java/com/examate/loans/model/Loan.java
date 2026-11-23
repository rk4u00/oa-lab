package com.examate.loans.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "loans")
public class Loan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "borrower_id")
    private User borrower;

    @ManyToOne
    @JoinColumn(name = "lender_id")
    private User lender;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private LoanStatus status;

    protected Loan() {}

    public Loan(User borrower, BigDecimal amount, LoanStatus status) {
        this.borrower = borrower;
        this.amount = amount;
        this.status = status;
    }

    public Long getId() { return id; }
    public User getBorrower() { return borrower; }
    public User getLender() { return lender; }
    public void setLender(User lender) { this.lender = lender; }
    public BigDecimal getAmount() { return amount; }
    public LoanStatus getStatus() { return status; }
    public void setStatus(LoanStatus status) { this.status = status; }
}
