package org.example.backend.controller.dto.response;

import java.time.LocalDate;

public record TaskListReturn(String id,
                             String name,
                             LocalDate duDate) {
}
