package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
import org.example.backend.service.security.exception.EmptyTaskListException;
import org.springframework.stereotype.Service;


import java.util.ArrayList;
import java.util.List;

@Service
public class TaskMapper {

    private final TaskDefinitionMapper taskDefinitionMapper;

    public TaskMapper(TaskDefinitionMapper taskDefinitionMapper) {
        this.taskDefinitionMapper = taskDefinitionMapper;
    }

    public TaskSeries mapToTaskSeries(String userId,CreateTaskDTO createTaskDTO){
        List<String> members = new ArrayList<>();
        members.add(userId);

        return new TaskSeries(
                "",
                taskDefinitionMapper.mapToTaskDefinition(createTaskDTO),
                new ArrayList<>(),
                getHomeId(createTaskDTO.homeId()),
                members
        );
    }

    public TaskTableReturnDTO mapToTaskTableReturn(TaskSeries taskSeries){
        if (taskSeries.taskList().isEmpty()) {
            throw new EmptyTaskListException("TaskSeries with id '" + taskSeries.id() + "' has an empty task list. Every TaskSeries must contain at least one task.");
        }
        
        return new TaskTableReturnDTO(
                taskSeries.taskList().getLast().id(),
                taskSeries.id(),
                taskSeries.definition().name(),
                taskSeries.definition().connectedItems().stream().map(Item::name).toList(),
                taskSeries.taskMembers(),
                taskSeries.definition().priority(),
                taskSeries.taskList().getLast().status(),
                taskSeries.taskList().getLast().dueDate(),
                taskSeries.definition().repetition(),
                getHomeId(taskSeries.homeId()));
    }

    private String getHomeId(String homeId){
        if(homeId == null || homeId.isEmpty()){
            return "";
        }
        return homeId;
    }

}
