package org.example.backend.service.security.exception;

public class HomeDoesNotExistException extends RuntimeException {
    public HomeDoesNotExistException(String message) {
        super(message);
    }
}
