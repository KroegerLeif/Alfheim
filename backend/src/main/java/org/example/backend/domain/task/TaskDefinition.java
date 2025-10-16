package org.example.backend.domain.task;

import org.example.backend.domain.item.Item;
import org.example.backend.domain.user.User;

import java.math.BigDecimal;
import java.util.List;

public record TaskDefinition(String id,
                             String name,
                             List<User> responsible,
                             List<Item> connectedItems,
                             BigDecimal price,
                             Priority priority,
                             int repetition) {
}
