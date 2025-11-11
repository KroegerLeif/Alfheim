package org.example.backend.domain.task;

import lombok.With;

import java.math.BigDecimal;
import java.util.List;

@With
public record TaskDefinition(String id,
                             String name,
                             List<String> connectedItems,
                             BigDecimal price,
                             Priority priority,
                             int repetition) {
}
