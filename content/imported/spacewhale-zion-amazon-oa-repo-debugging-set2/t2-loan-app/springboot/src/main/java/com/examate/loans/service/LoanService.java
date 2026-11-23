package com.examate.loans.service;

import com.examate.loans.common.ApiException;
import com.examate.loans.model.Loan;
import com.examate.loans.model.LoanStatus;
import com.examate.loans.model.User;
import com.examate.loans.repository.LoanRepository;
import com.examate.loans.repository.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Peer-to-peer loan business logic. See README.md for the rules. */
@Service
public class LoanService {
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;

    public LoanService(LoanRepository loanRepository, UserRepository userRepository) {
        this.loanRepository = loanRepository;
        this.userRepository = userRepository;
    }

    private BigDecimal parseAmount(Object raw) {
        if (raw == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount is required");
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(raw.toString());
        } catch (NumberFormatException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be a number");
        }
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
        }
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    public Loan createLoan(User user, Object rawAmount) {
        BigDecimal amount = parseAmount(rawAmount);
        Loan loan = new Loan(user, amount, LoanStatus.REQUESTED);
        return loan;
    }

    public List<Loan> myLoans(User user) {
        return loanRepository.findByLenderIdOrderByIdAsc(user.getId());
    }

    private Loan getLoan(Long loanId) {
        return loanRepository.findById(loanId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Loan not found"));
    }

    @Transactional
    public Loan fundLoan(User user, Long loanId) {
        Loan loan = getLoan(loanId);
        if (loan.getStatus() != LoanStatus.REQUESTED) {
            throw new ApiException(HttpStatus.CONFLICT, "Loan is not open for funding");
        }
        if (loan.getBorrower().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot fund your own loan");
        }

        User lender = user;
        User borrower = loan.getBorrower();
        if (borrower.getBalance().compareTo(loan.getAmount()) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Insufficient balance");
        }

        lender.setBalance(lender.getBalance().subtract(loan.getAmount()));
        borrower.setBalance(borrower.getBalance().add(loan.getAmount()));
        userRepository.save(borrower);

        loan.setLender(lender);
        loan.setStatus(LoanStatus.FUNDED);
        return loanRepository.save(loan);
    }

    @Transactional
    public Loan repayLoan(User user, Long loanId) {
        Loan loan = getLoan(loanId);
        if (!loan.getBorrower().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the borrower can repay this loan");
        }
        if (loan.getStatus() != LoanStatus.FUNDED) {
            throw new ApiException(HttpStatus.CONFLICT, "Loan is not active");
        }

        User borrower = user;
        User lender = loan.getLender();

        borrower.setBalance(borrower.getBalance().subtract(loan.getAmount()));
        lender.setBalance(lender.getBalance().add(loan.getAmount()));
        userRepository.save(borrower);
        userRepository.save(lender);

        return loanRepository.save(loan);
    }
}
