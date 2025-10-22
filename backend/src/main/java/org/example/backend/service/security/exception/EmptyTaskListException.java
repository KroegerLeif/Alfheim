package org.example.backend.service.security.exception;

public class EmptyTaskListException extends RuntimeException {
    public EmptyTaskListException(String message) {
        super(message);
    }
}
