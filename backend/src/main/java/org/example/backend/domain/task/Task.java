package org.example.backend.domain.task;

import java.time.Instant;

public record Task(String id,
                   Status status,
                   Instant dueDate,
                   Instant completionDate) {
}
