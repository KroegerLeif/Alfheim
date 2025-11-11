package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.task.*;
import org.example.backend.domain.user.User;
import org.example.backend.service.HomeService;
import org.example.backend.service.UserService;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
import org.example.backend.service.security.exception.EmptyTaskListException;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class TaskMapperTest {

    private final TaskDefinitionMapper taskDefinitionMapper = Mockito.mock(TaskDefinitionMapper.class);
    private final HomeService homeService = Mockito.mock(HomeService.class);
    private final UserService userService = Mockito.mock(UserService.class);

    private final TaskMapper taskMapper;

    public TaskMapperTest() {
        this.taskMapper = new TaskMapper(taskDefinitionMapper,homeService,userService);
    }

    @Test
    void mapToTaskSeries() {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO("def",
                new ArrayList<>(),
                Priority.HIGH,
                LocalDate.of(2025, 11, 11),
                0,
                "home123");

        TaskDefinition taskDefinition = createTaskDefinition();

        when(taskDefinitionMapper.mapToTaskDefinition(createTaskDTO)).thenReturn(taskDefinition);
        when(userService.getUserById("user")).thenReturn(Optional.of(new User("user","user")).get());
        List<String> members = new ArrayList<>();
        members.add("user");
        var expected = new TaskSeries("",
                                    taskDefinition,
                                    new ArrayList<>(),
                                    "home123",
                                    members);
        //WHEN
        var actual = taskMapper.mapToTaskSeries("user",createTaskDTO);

        //THEN
        assertEquals(expected,actual);
    }

    @Test
    void mapToTaskTableReturn() {
        //GIVEN
        TaskDefinition taskDefinition = createTaskDefinition();
        when(homeService.getHomeNameById("home123")).thenReturn("test");

        Task task = new Task(
                "2",
                Status.OPEN,
                LocalDate.of(2025, 11, 11)
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
        var expected = new TaskTableReturnDTO(
                "2",
                "1",
                "def",
                null,
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                task.dueDate(),
                0,
                new HomeListReturnDTO("home123","test"));

        //WHEN
        var actual = taskMapper.mapToTaskTableReturn(taskSeries);

        //THEN
        assertEquals(expected,actual);
    }

    @Test
    void mapToTaskTableReturn_shouldThrowExeptionByEmptyList(){
        //GIVEN
        TaskSeries taskSeries = new TaskSeries("1",
                                createTaskDefinition(),
                                new ArrayList<>(),
                                "home123",
                                new ArrayList<>());
        //WHEN
        try{
            taskMapper.mapToTaskTableReturn(taskSeries);
        }catch (EmptyTaskListException e){
            assertEquals("TaskSeries with id '1' has an empty task list. Every TaskSeries must contain at least one task.", e.getMessage());
        }
    }

    private static TaskDefinition createTaskDefinition(){
        return  new TaskDefinition("",
                "def",
                new ArrayList<>(),
                new BigDecimal(0),
                Priority.HIGH,
                0
        );
    }
}