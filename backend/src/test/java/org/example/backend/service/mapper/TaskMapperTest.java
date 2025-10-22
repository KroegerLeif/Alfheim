package org.example.backend.service.mapper;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.example.backend.domain.task.*;
import org.example.backend.service.mapper.task.TaskDefinitionMapper;
import org.example.backend.service.security.exception.EmptyTaskListException;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class TaskMapperTest {

    private final TaskDefinitionMapper taskDefinitionMapper = Mockito.mock(TaskDefinitionMapper.class);

    private final TaskMapper taskMapper;

    public TaskMapperTest() {
        this.taskMapper = new TaskMapper(taskDefinitionMapper);
    }

    @Test
    void mapToTaskSeries() {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO("def",
                new ArrayList<>(),
                Priority.HIGH,
                LocalDate.now(),
                0);

        TaskDefinition taskDefinition = createTaskDefinition();

        when(taskDefinitionMapper.mapToTaskDefinition(createTaskDTO)).thenReturn(taskDefinition);

        var expected = new TaskSeries("",
                                    taskDefinition,
                                    new ArrayList<>());
        //WHEN
        var actual = taskMapper.mapToTaskSeries(createTaskDTO);

        //THEN
        assertEquals(expected,actual);
    }

    @Test
    void mapToTaskTableReturn() {
        //GIVEN
        TaskDefinition taskDefinition = createTaskDefinition();
        
        Task task = new Task(
                "2",
                Status.OPEN,
                LocalDate.now(),
                LocalDate.now().plusDays(1)
        );
        ArrayList<Task> taskList = new ArrayList<>();
        taskList.add(task);

        TaskSeries taskSeries = new TaskSeries(
                "",
                taskDefinition,
                taskList
        );
        var expected = new TaskTableReturnDTO(
                "2",
                "def",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                task.dueDate());
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
                new ArrayList<>(),
                new BigDecimal(0),
                Priority.HIGH,
                0
        );
    }
}