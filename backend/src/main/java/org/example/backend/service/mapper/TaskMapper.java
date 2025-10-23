package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.domain.user.User;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
import org.example.backend.service.security.exception.EmptyTaskListException;
import org.springframework.stereotype.Service;


import java.util.ArrayList;

@Service
public class TaskMapper {

    private final TaskDefinitionMapper taskDefinitionMapper;

    public TaskMapper(TaskDefinitionMapper taskDefinitionMapper) {
        this.taskDefinitionMapper = taskDefinitionMapper;
    }

    public TaskSeries mapToTaskSeries(CreateTaskDTO createTaskDTO){
        return new TaskSeries(
                "",
                taskDefinitionMapper.mapToTaskDefinition(createTaskDTO),
                new ArrayList<>()
        );
    }

    public TaskTableReturnDTO mapToTaskTableReturn(TaskSeries taskSeries){
        if (taskSeries.taskList().isEmpty()) {
            throw new EmptyTaskListException("TaskSeries with id '" + taskSeries.id() + "' has an empty task list. Every TaskSeries must contain at least one task.");
        }
        
        return new TaskTableReturnDTO(
                taskSeries.taskList().getLast().id(),
                taskSeries.definition().name(),
                taskSeries.definition().connectedItems().stream().map(Item::name).toList(),
                taskSeries.definition().responsible().stream().map(User::name).toList(),
                taskSeries.definition().priority(),
                taskSeries.taskList().getLast().status(),
                taskSeries.taskList().getLast().dueDate());
    }

}
