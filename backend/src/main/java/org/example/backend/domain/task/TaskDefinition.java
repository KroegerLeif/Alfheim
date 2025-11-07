package org.example.backend.domain.task;

import lombok.With;
import org.example.backend.domain.item.Item;

import java.math.BigDecimal;
import java.util.List;

@With
public record TaskDefinition(String id,
                             String name,
                             List<Item> connectedItems,
                             BigDecimal price,
                             Priority priority,
                             int repetition) {
}
