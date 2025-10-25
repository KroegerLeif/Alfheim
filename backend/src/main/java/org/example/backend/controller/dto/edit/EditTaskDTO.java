package org.example.backend.controller.dto.edit;

import org.example.backend.domain.task.Status;

import java.time.LocalDate;

public record EditTaskDTO(Status status,
                          LocalDate dueDate) {
}
