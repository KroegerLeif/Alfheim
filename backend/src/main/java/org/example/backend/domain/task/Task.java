package org.example.backend.domain.task;

import lombok.With;

import java.time.LocalDate;

@With
public record Task(String id,
                   Status status,
                   LocalDate dueDate){
}
