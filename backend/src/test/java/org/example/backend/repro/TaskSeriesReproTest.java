package org.example.backend.repro;

import org.example.backend.domain.task.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;


@DataMongoTest
class TaskSeriesReproTest {

    @Autowired
    private TaskSeriesRepro taskSeriesRepro;

    @Test
    void getTaskSericeById_shouldReturnTaskSeries() {
        //GIVEN
        TaskDefinition taskDefinition = new TaskDefinition("",
                "def",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(0),
                Priority.HIGH,
                0
        );
        Task task = new Task(
                "2",
                Status.OPEN,
                LocalDate.now()
        );
        ArrayList<Task> taskList = new ArrayList<>();
        taskList.add(task);

        TaskSeries taskSeries = new TaskSeries(
                "1",
                taskDefinition,
                taskList,
                "home123",
                new ArrayList<>()
        );
        taskSeriesRepro.save(taskSeries);
        //WHEN
        TaskSeries foundTaskSeries = taskSeriesRepro.getTaskSeriesById("1");
        //THEN
        assertEquals("1", foundTaskSeries.id());
    }
}