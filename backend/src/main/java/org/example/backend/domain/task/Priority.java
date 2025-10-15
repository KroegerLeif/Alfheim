package org.example.backend.domain.task;

public enum Priority {
    LOW("Low"),
    MEDIUM("Medium"),
    HIGH("High");

    private final String name;

    Priority(String name) {
        this.name = name;
    }
}
