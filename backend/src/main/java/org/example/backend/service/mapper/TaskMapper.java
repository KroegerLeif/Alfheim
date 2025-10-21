package org.example.backend.service.mapper;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.domain.user.User;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
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

    public TaskTableReturnDTO mapToTaskTableReturn(TaskSeries task_series){
        return new TaskTableReturnDTO(
                task_series.taskList().getLast().id(),
                task_series.definition().name(),
                task_series.definition().connectedItems().stream().map(Item::name).toList(),
                task_series.definition().responsible().stream().map(User::name).toList(),
                task_series.definition().priority(),
                task_series.taskList().getLast().status(),
                task_series.taskList().getLast().dueDate());
    }

}
