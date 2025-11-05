package org.example.backend.service.mapper.task;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.TaskDefinition;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

class TaskDefinitionMapperTest {

    @Test
    void mapToTaskDefinition() {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO("def",
                                                        new ArrayList<>(),
                                                        Priority.HIGH,
                                                        LocalDate.now(),
                                                        null, // homeId hinzugefügt
                                                        0);
        var expected = new TaskDefinition("",
                                          "def",
                                          new ArrayList<>(),
                                          new ArrayList<>(),
                                          new BigDecimal(0),
                                          Priority.HIGH,
                                          0);
        //WHEN
        var actual = new TaskDefinitionMapper().mapToTaskDefinition(createTaskDTO);

        //THEN
        assertEquals(expected,actual);
    }
}