package org.example.backend.domain.task;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskSeriesTest {

    @Test
    void testTaskSeriesRecord() {

        TaskDefinition taskDefinition = new TaskDefinition(
                "1",
                "Clean the kitchen",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal("100.50"),
                Priority.HIGH,
                7
        );

        LocalDate dueDate = LocalDate.now();
        Task task = new Task("1", Status.OPEN, dueDate);

        TaskSeries taskSeries = new TaskSeries("1", taskDefinition, Collections.singletonList(task), "home123", new ArrayList<>());

        assertEquals("1", taskSeries.id());
        assertEquals(taskDefinition, taskSeries.definition());
        assertEquals(Collections.singletonList(task), taskSeries.taskList());
    }
}
