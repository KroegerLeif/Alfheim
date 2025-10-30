package org.example.backend.controller.dto.response;

import lombok.With;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Status;

import java.time.LocalDate;
import java.util.List;

@With
public record TaskTableReturnDTO(String id,
                                 String taskSeriesId,
                                 String name,
                                 List<String> items,
                                 List<String> assignedTo,
                                 Priority priority,
                                 Status status,
                                 LocalDate dueDate,
                                 int repetition,
                                 String homeId) {
}
