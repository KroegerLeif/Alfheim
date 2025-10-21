package org.example.backend.controller.dto;

import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Status;

import java.time.LocalDate;
import java.util.List;

public record CreateTaskDTO(String name,
                            List<Item> items,
                            Priority priority,
                            LocalDate dueDate,
                            int repetition) {
}
