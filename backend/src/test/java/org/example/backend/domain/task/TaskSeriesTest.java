package org.example.backend.domain.task;

import net.bytebuddy.asm.Advice;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.user.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskSeriesTest {

    @Test
    void testTaskSeriesRecord() {
        User user = new User("1", "Test User");
        Category category = new Category("1", "Electronics");
        Item item = new Item("1", "Laptop", category, EnergyLabel.A);

        TaskDefinition taskDefinition = new TaskDefinition(
                "1",
                "Clean the kitchen",
                Collections.singletonList(user),
                Collections.singletonList(item),
                new BigDecimal("100.50"),
                Priority.HIGH,
                7
        );

        LocalDate dueDate = LocalDate.now();
        LocalDate completionDate = LocalDate.now();
        Task task = new Task("1", Status.OPEN, dueDate, completionDate);

        TaskSeries taskSeries = new TaskSeries("1", taskDefinition, Collections.singletonList(task));

        assertEquals("1", taskSeries.id());
        assertEquals(taskDefinition, taskSeries.definition());
        assertEquals(Collections.singletonList(task), taskSeries.taskList());
    }
}
