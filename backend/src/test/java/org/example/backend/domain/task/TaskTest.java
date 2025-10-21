package org.example.backend.domain.task;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskTest {

    @Test
    void testTaskRecord() {
        LocalDate dueDate = LocalDate.now();
        LocalDate completionDate = LocalDate.now();

        Task task = new Task("1", Status.OPEN, dueDate, completionDate);

        assertEquals("1", task.id());
        assertEquals(Status.OPEN, task.status());
        assertEquals(dueDate, task.dueDate());
        assertEquals(completionDate, task.completionDate());
    }
}
