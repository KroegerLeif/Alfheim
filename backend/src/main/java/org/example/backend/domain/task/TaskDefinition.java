package org.example.backend.domain.task;

import java.math.BigDecimal;

public record TaskDefinition(String id,
                             String name,
                             BigDecimal price,
                             Priority priority,
                             int repetition) {
}
