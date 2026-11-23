package com.examate.loans.controller;

import com.examate.loans.common.CurrentUserResolver;
import com.examate.loans.model.Loan;
import com.examate.loans.model.User;
import com.examate.loans.service.LoanService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/loans")
public class LoanController {
    private final LoanService loanService;
    private final CurrentUserResolver currentUser;

    public LoanController(LoanService loanService, CurrentUserResolver currentUser) {
        this.loanService = loanService;
        this.currentUser = currentUser;
    }

    static Map<String, Object> toJson(Loan loan) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", loan.getId());
        m.put("borrowerId", loan.getBorrower().getId());
        m.put("lenderId", loan.getLender() == null ? null : loan.getLender().getId());
        m.put("amount", loan.getAmount().toPlainString());
        m.put("status", loan.getStatus().name());
        return m;
    }

    @GetMapping
    public Map<String, Object> myLoans(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        User user = currentUser.resolve(userId);
        List<Map<String, Object>> loans = loanService.myLoans(user).stream().map(LoanController::toJson).toList();
        return Map.of("loans", loans);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                                      @RequestBody Map<String, Object> body) {
        User user = currentUser.resolve(userId);
        Loan loan = loanService.createLoan(user, body.get("amount"));
        return ResponseEntity.status(HttpStatus.CREATED).body(toJson(loan));
    }

    @PostMapping("/{loanId}/fund")
    public Map<String, Object> fund(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @PathVariable Long loanId) {
        return toJson(loanService.fundLoan(currentUser.resolve(userId), loanId));
    }

    @PostMapping("/{loanId}/repay")
    public Map<String, Object> repay(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                     @PathVariable Long loanId) {
        return toJson(loanService.repayLoan(currentUser.resolve(userId), loanId));
    }
}
