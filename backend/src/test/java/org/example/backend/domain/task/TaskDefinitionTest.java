package org.example.backend.domain.task;

import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.user.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskDefinitionTest {

    @Test
    void testTaskDefinitionRecord() {
        User user = new User("1", "Test User");
        Category category = new Category("1", "Electronics");
        Item item = new Item("1", "Laptop", category, EnergyLabel.A,"home123");

        TaskDefinition taskDefinition = new TaskDefinition(
                "1",
                "Clean the kitchen",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal("100.50"),
                Priority.HIGH,
                7
        );

        assertEquals("1", taskDefinition.id());
        assertEquals("Clean the kitchen", taskDefinition.name());
        assertEquals(new BigDecimal("100.50"), taskDefinition.price());
        assertEquals(Priority.HIGH, taskDefinition.priority());
        assertEquals(7, taskDefinition.repetition());
    }
}
