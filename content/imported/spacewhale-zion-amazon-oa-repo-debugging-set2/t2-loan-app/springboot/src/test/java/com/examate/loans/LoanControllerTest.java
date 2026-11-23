package com.examate.loans;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.examate.loans.model.Loan;
import com.examate.loans.model.LoanStatus;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class LoanControllerTest extends TestSupport {

    @Test
    void userCanCreateALoan() throws Exception {
        String json = create(borrower, "500")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(json, "$.id");
        assertNotNull(id);
        assertTrue(loans.findById(id.longValue()).isPresent());
    }

    @Test
    void userCanViewTheirExistingLoans() throws Exception {
        create(borrower, "500");
        create(borrower, "250");
        String json = mvc.perform(get("/api/loans").header("X-User-Id", borrower.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> amounts = JsonPath.read(json, "$.loans[*].amount");
        assertEquals(List.of("500.00", "250.00"), amounts);
    }

    @Test
    void fundingMovesMoneyFromLenderToBorrower() throws Exception {
        Loan loan = makeLoan(borrower, "500", LoanStatus.REQUESTED, null);
        fund(lender, loan.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FUNDED"));
        assertEquals(0, new BigDecimal("4500.00").compareTo(balance(lender)));
        assertEquals(0, new BigDecimal("1500.00").compareTo(balance(borrower)));
    }

    @Test
    void userWithInsufficientBalanceCannotFund() throws Exception {
        Loan loan = makeLoan(borrower, "500", LoanStatus.REQUESTED, null);
        fund(poor, loan.getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Insufficient balance"));
        assertEquals(0, new BigDecimal("100.00").compareTo(balance(poor)));
        assertEquals(LoanStatus.REQUESTED, loans.findById(loan.getId()).orElseThrow().getStatus());
    }

    @Test
    void repayWithInsufficientBalanceIsRejected() throws Exception {
        Loan loan = makeLoan(poor, "500", LoanStatus.FUNDED, lender);
        repay(poor, loan.getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Insufficient balance"));
        assertEquals(0, new BigDecimal("100.00").compareTo(balance(poor)));
    }

    @Test
    void repaidLoanIsClosed() throws Exception {
        Loan loan = makeLoan(borrower, "500", LoanStatus.FUNDED, lender);
        repay(borrower, loan.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REPAID"));
        assertEquals(0, new BigDecimal("500.00").compareTo(balance(borrower)));
        assertEquals(0, new BigDecimal("5500.00").compareTo(balance(lender)));
        repay(borrower, loan.getId()).andExpect(status().isConflict());
    }

    @Test
    void cannotFundYourOwnLoan() throws Exception {
        Loan loan = makeLoan(borrower, "500", LoanStatus.REQUESTED, null);
        fund(borrower, loan.getId()).andExpect(status().isBadRequest());
    }

    @Test
    void unknownLoanReturns404() throws Exception {
        fund(lender, 999_999L).andExpect(status().isNotFound());
    }
}
