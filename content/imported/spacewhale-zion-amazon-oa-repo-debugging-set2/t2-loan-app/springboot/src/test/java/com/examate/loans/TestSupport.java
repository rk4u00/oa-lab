package com.examate.loans;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.examate.loans.model.Loan;
import com.examate.loans.model.LoanStatus;
import com.examate.loans.model.User;
import com.examate.loans.repository.LoanRepository;
import com.examate.loans.repository.UserRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Shared setup for the tests. Do not edit. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class TestSupport {
    @Autowired protected MockMvc mvc;
    @Autowired protected UserRepository users;
    @Autowired protected LoanRepository loans;

    protected User borrower;
    protected User lender;
    protected User poor;

    @BeforeEach
    void setUpData() {
        loans.deleteAll();
        users.deleteAll();
        borrower = users.save(new User("Kiran (borrower)", new BigDecimal("1000.00")));
        lender = users.save(new User("Meera (lender)", new BigDecimal("5000.00")));
        poor = users.save(new User("Arjun (low balance)", new BigDecimal("100.00")));
    }

    protected ResultActions create(User u, String amount) throws Exception {
        return mvc.perform(post("/api/loans").header("X-User-Id", u.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"amount\": \"" + amount + "\"}"));
    }

    protected ResultActions fund(User u, long loanId) throws Exception {
        return mvc.perform(post("/api/loans/" + loanId + "/fund").header("X-User-Id", u.getId()));
    }

    protected ResultActions repay(User u, long loanId) throws Exception {
        return mvc.perform(post("/api/loans/" + loanId + "/repay").header("X-User-Id", u.getId()));
    }

    protected BigDecimal balance(User u) {
        return users.findById(u.getId()).orElseThrow().getBalance();
    }

    protected Loan makeLoan(User b, String amount, LoanStatus status, User l) {
        Loan loan = new Loan(b, new BigDecimal(amount), status);
        loan.setLender(l);
        return loans.save(loan);
    }
}
