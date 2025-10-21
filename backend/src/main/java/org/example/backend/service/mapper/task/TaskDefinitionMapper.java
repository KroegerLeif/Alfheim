package org.example.backend.service.mapper.task;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.TaskDefinition;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;

@Service
public class TaskDefinitionMapper {

    public TaskDefinition mapToTaskDefinition(CreateTaskDTO createTaskDTO){
        return new TaskDefinition("",//TaskStatus ID + "_D"
                createTaskDTO.name(),
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(0),
                createTaskDTO.priority(),
                0);
    }
}
