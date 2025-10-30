package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.task.*;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;

import org.example.backend.service.security.exception.TaskCompletionException;
import org.example.backend.service.security.exception.TaskDoesNotExistException;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;


class TaskServiceTest {

    @Mock
    private final TaskSeriesRepro mockRepo = Mockito.mock(TaskSeriesRepro.class);
    @Mock
    private final TaskMapper taskMapper = Mockito.mock(TaskMapper.class);
    @Mock
    private final IdService idService = Mockito.mock(IdService.class);
    @Mock
    private final HomeService homeService = Mockito.mock(HomeService.class);

    TaskService taskService = new TaskService(mockRepo, taskMapper, idService,homeService);

    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        //WHEN
        ArrayList<TaskSeries> response = new ArrayList<TaskSeries>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = taskService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        //WHEN
        ArrayList<TaskSeries> response = new ArrayList<TaskSeries>();
        response.add(new TaskSeries("1",
                                        new TaskDefinition("1",
                                                        "Test",
                                                                new ArrayList<>(),
                                                                new ArrayList<>(),
                                                            null,
                                                                Priority.HIGH,
                                                        0),
                                        new ArrayList<>()
                                    )
                    );
        response.add(new TaskSeries("2",
                        new TaskDefinition("2",
                                "Test",
                                new ArrayList<>(),
                                new ArrayList<>(),
                                null,
                                Priority.HIGH,
                                0),
                        new ArrayList<>()
                )
        );
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = taskService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(2, actual.size());
    }

    @Test
    void createNewTask_shouldReturnTaskTableReturnDTO_whenTaskIsCreated() {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO(
                "Test Task",
                new ArrayList<>(),
                Priority.HIGH,
                LocalDate.of(2025, 12, 31),
                0
        );
        
        String expectedTaskSeriesId = "task-series-123";
        
        TaskDefinition taskDefinition = new TaskDefinition(
                null,
                "Test Task",
                new ArrayList<>(),
                new ArrayList<>(),
                null,
                Priority.HIGH,
                0
        );
        
        TaskSeries taskSeries = new TaskSeries(
                null,
                taskDefinition,
                new ArrayList<>()
        );
        
        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                expectedTaskSeriesId,
                null,
                "Test Task",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                LocalDate.of(2025, 12, 31)
        );
        
        Mockito.when(taskMapper.mapToTaskSeries(createTaskDTO)).thenReturn(taskSeries);
        Mockito.when(idService.createNewId()).thenReturn(expectedTaskSeriesId);
        Mockito.when(mockRepo.save(Mockito.any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(taskMapper.mapToTaskTableReturn(Mockito.any(TaskSeries.class))).thenReturn(expectedReturn);
        
        //WHEN
        TaskTableReturnDTO result = taskService.createNewTask(createTaskDTO);
        
        //THEN
        Mockito.verify(taskMapper).mapToTaskSeries(createTaskDTO);
        Mockito.verify(idService, Mockito.times(1)).createNewId();
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        Mockito.verify(taskMapper).mapToTaskTableReturn(Mockito.any(TaskSeries.class));
        
        assert result != null;
        assert result.id().equals(expectedTaskSeriesId);
        assert result.name().equals("Test Task");
        assert result.priority().equals(Priority.HIGH);
        assert result.status().equals(Status.OPEN);
        assert result.dueDate().equals(LocalDate.of(2025, 12, 31));
    }

    @Test
    void editTAsk_shouldReturnTaskTableReturnDTO_whenTaskIsEdited() {
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.IN_PROGRESS,null);
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN,LocalDate.now()));

        TaskSeries savedTaskSeries = new TaskSeries(
                id,
                new TaskDefinition(id + "_D",
                        "Test",
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new BigDecimal(2),
                        Priority.HIGH,
                        3
                ),
                taskList
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "1",
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.IN_PROGRESS,
                LocalDate.now()
        );

        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(Mockito.any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(idService.createNewId()).thenReturn(id);
        when(taskMapper.mapToTaskTableReturn(savedTaskSeries)).thenReturn(expectedReturn);


        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        assertEquals(expectedReturn,result);

    }
    @Test
    void editTask_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist() {
        try{
            String id = "Unique1";
            when(mockRepo.findById(id)).thenReturn(Optional.empty());
            taskService.editTask(id,new EditTaskDTO(Status.IN_PROGRESS,null));
        }catch(TaskDoesNotExistException e){
            assertEquals("Task does not Exist",e.getMessage());

        }
    }

    @Test
    void editTask_shouldThrowException_whenTaskDueDateIsInTheFuture() {
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.CLOSED,LocalDate.now()));

        TaskSeries savedTaskSeries = new TaskSeries(
                id,
                new TaskDefinition(id + "_D",
                        "Test",
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new BigDecimal(2),
                        Priority.HIGH,
                        3
                ),
                taskList
        );
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        try{
            EditTaskDTO editTaskDTO = new EditTaskDTO(Status.CLOSED,LocalDate.now().plusDays(5));
            taskService.editTask(id,editTaskDTO);
        }catch (TaskCompletionException e){
            assertEquals("Completion Date can not be in the future",e.getMessage());
        }
    }

    @Test
    void editTAsk_shouldReturnTaskTableReturnDTOWithNewTask_whenTaskIsCompleted() {
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.CLOSED,null);
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN,LocalDate.now()));

        TaskDefinition taskDefinition = new TaskDefinition(id + "_D",
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(2),
                Priority.HIGH,
                3);

        TaskSeries savedTaskSeries = new TaskSeries(
                id,
                taskDefinition,
                taskList
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "1",
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                LocalDate.now().plusDays(3)
        );

        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(Mockito.any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(idService.createNewId()).thenReturn(id);
        when(taskMapper.mapToTaskTableReturn(savedTaskSeries)).thenReturn(expectedReturn);


        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        assertEquals(expectedReturn,result);
        assertEquals(Status.CLOSED, savedTaskSeries.taskList().getFirst().status());

    }

    @Test
    void editTask_shouldReturnTaskWithUpdatedDueDate_whenDueDateIsUpdated() {
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.OPEN,LocalDate.now().plusDays(3));
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN,LocalDate.now()));

        TaskDefinition taskDefinition = new TaskDefinition(
                id + "_D",
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(2),
                Priority.HIGH,
                3);

        TaskSeries savedTaskSeries = new TaskSeries(
                id,
                taskDefinition,
                taskList
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "1",
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                LocalDate.now().plusDays(3)
        );

        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(Mockito.any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(idService.createNewId()).thenReturn(id);
        when(taskMapper.mapToTaskTableReturn(savedTaskSeries)).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        assertEquals(expectedReturn,result);
        assertEquals(LocalDate.now().plusDays(3), savedTaskSeries.taskList().getFirst().dueDate());
    }

    @Test
    void deleteTask_shouldDeleteTask_whenCalled(){
        //GIVEN
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN,LocalDate.now()));

        TaskDefinition taskDefinition = new TaskDefinition(
                id + "_D",
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(2),
                Priority.HIGH,
                3);

        TaskSeries savedTaskSeries = new TaskSeries(
                id,
                taskDefinition,
                taskList
        );

        mockRepo.save(savedTaskSeries);
        //WHEN
        taskService.deleteTask(id);
        //THEN
        Mockito.verify(mockRepo).deleteById(id);
    }

    @Test
    void addTaskToHome_shouldAddTaskToHome_whenCalled(){
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        String homeId = "1";
        when(mockRepo.findById(taskSeries.id())).thenReturn(Optional.of(taskSeries));

        //WHEN
        taskService.addTaskToHome(taskSeries.id(),homeId);

        //THEN
        Mockito.verify(mockRepo).findById(taskSeries.id());
        Mockito.verify(homeService).addTaskToHome(homeId, taskSeries);
    }

    @Test
    void addTaskToHOme_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist(){
        // GIVEN
        String taskId = "non-existent-id";
        String homeId = "1";
        when(mockRepo.findById(taskId)).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThrows(TaskDoesNotExistException.class, () -> taskService.addTaskToHome(taskId, homeId));
    }

    private static TaskSeries createTaskSeries() {
        TaskDefinition taskDefinition = new TaskDefinition("1",
                "test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(1),
                Priority.HIGH,
                2);

        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task("1", Status.OPEN, null));

        return new TaskSeries("1",
                taskDefinition,
                taskList);
    }

}