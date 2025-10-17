package org.example.backend.domain.task;

public enum Status {
    OPEN("Open"),
    IN_PROGRESS("In Progress"),
    CLOSED("Closed");

    private final String name;

    Status(String name) {
        this.name = name;
    }

}
