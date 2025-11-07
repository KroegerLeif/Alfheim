package org.example.backend.domain.task;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskDefinitionTest {

    @Test
    void testTaskDefinitionRecord() {

        TaskDefinition taskDefinition = new TaskDefinition(
                "1",
                "Clean the kitchen",
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
