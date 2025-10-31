package org.example.backend.controller.dto.edit;

import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Status;

import java.time.LocalDate;
import java.util.List;

public record EditTaskSeriesDTO(String name,
                                List<String> itemId,
                                List<String> assignedUser,
                                Priority priority,
                                Status status,
                                LocalDate dueDate,
                                int repetition,
                                String homeId) {
}
