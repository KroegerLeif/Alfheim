package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.service.HomeService;
import org.example.backend.service.UserService;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
import org.example.backend.service.security.exception.EmptyTaskListException;
import org.springframework.stereotype.Service;


import java.util.ArrayList;
import java.util.List;

@Service
public class TaskMapper {

    private final TaskDefinitionMapper taskDefinitionMapper;
    private final HomeService homeService;
    private final UserService userService;


    public TaskMapper(TaskDefinitionMapper taskDefinitionMapper, HomeService homeService, UserService userService) {
        this.taskDefinitionMapper = taskDefinitionMapper;
        this.homeService = homeService;
        this.userService = userService;
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
                getItemNames(),
                getAssignedNames(taskSeries.taskMembers()),
                taskSeries.definition().priority(),
                taskSeries.taskList().getLast().status(),
                taskSeries.taskList().getLast().dueDate(),
                taskSeries.definition().repetition(),
                getHomeData(taskSeries.homeId()));
    }

    private HomeListReturnDTO getHomeData(String homeId){
        String id = getHomeId(homeId);
        if(id.isEmpty()){
            return null;
        }else {
            return new HomeListReturnDTO(id,homeService.getHomeNameById(id));
        }
    }

    private String getHomeId(String homeId){
        if(homeId == null || homeId.isEmpty()){
            return "";
        }
        return homeId;
    }

    private List<String> getAssignedNames(List<String> assignedTo){
        List<String> assignedNames = new ArrayList<>();
        for (String s : assignedTo) {
            assignedNames.add(userService.getUserById(s).name());
        }
        return assignedNames;
    }

    private List<String> getItemNames(){
        return null;
    }

}
