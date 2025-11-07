package org.example.backend.service.security.exception;

public class UserDoesNotHavePermissionException extends RuntimeException {
    public UserDoesNotHavePermissionException(String message) {
        super(message);
    }
}
