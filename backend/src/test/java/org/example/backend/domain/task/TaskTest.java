package org.example.backend.domain.task;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskTest {

    @Test
    void testTaskRecord() {
        Instant dueDate = Instant.now();
        Instant completionDate = Instant.now().plusSeconds(3600);

        Task task = new Task("1", Status.OPEN, dueDate, completionDate);

        assertEquals("1", task.id());
        assertEquals(Status.OPEN, task.status());
        assertEquals(dueDate, task.dueDate());
        assertEquals(completionDate, task.completionDate());
    }
}
