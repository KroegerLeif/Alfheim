package org.example.backend.service.security.exception;

public class ItemDoesNotExistException extends RuntimeException {
    public ItemDoesNotExistException(String message) {
        super(message);
    }
}
