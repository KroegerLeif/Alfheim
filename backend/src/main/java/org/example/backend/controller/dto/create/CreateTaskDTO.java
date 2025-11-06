package org.example.backend.controller.dto.create;

import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.Priority;

import java.time.LocalDate;
import java.util.List;

public record CreateTaskDTO(String name,
                            List<String> items,
                            Priority priority,
                            LocalDate dueDate,
                            int repetition,
                            String homeId) {
}