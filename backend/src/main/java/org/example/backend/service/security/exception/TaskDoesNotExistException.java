package org.example.backend.service.security.exception;

public class TaskDoesNotExistException extends RuntimeException {
    public TaskDoesNotExistException(String message) {
        super(message);
    }
}
