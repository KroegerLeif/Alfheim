package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskSeriesDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.task.*;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;

import org.example.backend.service.security.exception.TaskCompletionException;
import org.example.backend.service.security.exception.TaskDoesNotExistException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;


class TaskServiceTest {

    @Mock
    private final TaskSeriesRepro mockRepo = Mockito.mock(TaskSeriesRepro.class);
    @Mock
    private final TaskMapper taskMapper = Mockito.mock(TaskMapper.class);
    @Mock
    private final IdService idService = Mockito.mock(IdService.class);
    @Mock
    private final ItemService itemService = Mockito.mock(ItemService.class);
    @Mock
    private final HomeService homeService = Mockito.mock(HomeService.class);

    @AfterEach
    void tearDown() {
        mockRepo.deleteAll();
    }



    TaskService taskService = new TaskService(mockRepo, taskMapper, idService,itemService,homeService);

    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        //WHEN
        String testUserId = "test-user";
        when(homeService.findHomeConnectedToUser(testUserId)).thenReturn(List.of("home123"));
        when(mockRepo.findAllByTaskMembersContaining(testUserId)).thenReturn(new ArrayList<>());
        when(mockRepo.findAllByHomeId("home123")).thenReturn(new ArrayList<>());

        //THEN
        var actual = taskService.getAll(testUserId);
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        //WHEN
        String testUserId = "test-user";
        ArrayList<TaskSeries> response = new ArrayList<>();
        response.add(new TaskSeries("1",
                                        new TaskDefinition("1",
                                                        "Test",
                                                                new ArrayList<>(),
                                                                new ArrayList<>(),
                                                            null,
                                                                Priority.HIGH,
                                                        0),
                                        new ArrayList<>(),
                                        "1",
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
                        new ArrayList<>(),
                        "1",
                        new ArrayList<>()
                )
        );

        when(homeService.findHomeConnectedToUser(testUserId)).thenReturn(List.of("home123"));
        when(mockRepo.findAllByTaskMembersContaining(testUserId)).thenReturn(response);
        when(mockRepo.findAllByHomeId("home123")).thenReturn(new ArrayList<>()); // Nehmen wir an, es kommen keine weiteren hinzu

        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(new TaskTableReturnDTO(
                "dummyId",
                "dummySeriesId",
                "dummyName",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.MEDIUM,
                Status.OPEN,
                null,
                0,
                "dummyHomeId"
        ));
        //THEN
        var actual = taskService.getAll(testUserId);
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
                0,
                "home123"
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
                new ArrayList<>(),
                "home123",
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
                LocalDate.of(2025, 12, 31),
                1,
                "1"
        );
        
        Mockito.when(taskMapper.mapToTaskSeries(createTaskDTO)).thenReturn(taskSeries);
        Mockito.when(idService.createNewId()).thenReturn(expectedTaskSeriesId);
        Mockito.when(mockRepo.save(any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);
        
        //WHEN
        TaskTableReturnDTO result = taskService.createNewTask(createTaskDTO);
        
        //THEN
        Mockito.verify(taskMapper).mapToTaskSeries(createTaskDTO);
        Mockito.verify(idService, Mockito.times(1)).createNewId();
        Mockito.verify(mockRepo).save(any(TaskSeries.class));
        Mockito.verify(taskMapper).mapToTaskTableReturn(any(TaskSeries.class));
        
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
        LocalDate testDate = LocalDate.of(2025, 10, 30);
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN, testDate));

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
                taskList,
                "home123",
                new ArrayList<>()
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "1",
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.IN_PROGRESS,
                testDate,
                1,
                "home123"
        );

        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);


        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(any(TaskSeries.class));
        assertEquals(expectedReturn,result);

    }

    @Test
    void editTask_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist() {
        // GIVEN
        String id = "non-existent-id";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());
        EditTaskDTO editDto = new EditTaskDTO(Status.IN_PROGRESS, null);

        // WHEN & THEN
        TaskDoesNotExistException exception = assertThrows(TaskDoesNotExistException.class, () -> taskService.editTask(id, editDto));
        assertEquals("Task does not Exist", exception.getMessage());
    }

    @Test
    void editTask_shouldThrowException_whenTaskDueDateIsInTheFuture() {
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.CLOSED, LocalDate.of(2025, 10, 30)));

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
                taskList,
                "home123",
                new ArrayList<>()
        );
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.CLOSED,LocalDate.now().plusDays(5));

        // WHEN & THEN
        TaskCompletionException exception = assertThrows(TaskCompletionException.class, () -> taskService.editTask(id, editTaskDTO));
        assertEquals("Completion Date can not be in the future", exception.getMessage());
    }

    @Test
    void editTAsk_shouldReturnTaskTableReturnDTOWithNewTask_whenTaskIsCompleted() {
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.CLOSED,null);
        String id = "Unique1";
        LocalDate testDate = LocalDate.of(2025, 10, 30);
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN, testDate));

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
                taskList,
                "home123",
                new ArrayList<>()
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "2", // ID of the new task
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                LocalDate.now().plusDays(3) // The new due date
                ,1,
                "home123"
        );
        
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(idService.createNewId()).thenReturn(id + "2");
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(any(TaskSeries.class));
        assertEquals(expectedReturn,result);
        assertEquals(2, savedTaskSeries.taskList().size());
        assertEquals(Status.CLOSED, savedTaskSeries.taskList().getFirst().status());
    }

    @Test
    void editTask_shouldReturnTaskWithUpdatedDueDate_whenDueDateIsUpdated() {
        LocalDate newDueDate = LocalDate.of(2025, 11, 2);
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.OPEN, newDueDate);
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN, LocalDate.of(2025, 10, 30)));

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
                taskList,
                "home123",
                new ArrayList<>()
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                id + "1",
                id,
                "Test",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                newDueDate
                ,1,
                "home123"
        );

        AtomicReference<TaskSeries> saved = new AtomicReference<>();
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(any(TaskSeries.class))).then(invocation -> {
            saved.set(invocation.getArgument(0));
            return saved.get();
        });
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        assertEquals(expectedReturn,result);
        assertEquals(newDueDate, saved.get().taskList().getFirst().dueDate());
    }

    @Test
    void editTaskSeries_shouldUpdateTask_whenCalled() {
        //GIVEN
        String id = "Unique1";
        EditTaskSeriesDTO editTaskSeriesDTO = geneartateEditTaskSeriesDTO();
        TaskSeries taskSeries = createTaskSeries();

        when(mockRepo.findById(id)).thenReturn(Optional.of(taskSeries));
        //WHEN
        taskService.editTaskSeries(id,editTaskSeriesDTO);
        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(any(TaskSeries.class));
    }

    @Test
    void editTaskSeries_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist(){
        // GIVEN
        String id = "Unique1";
        EditTaskSeriesDTO editTaskSeriesDTO = geneartateEditTaskSeriesDTO();
        when(mockRepo.findById(id)).thenReturn(Optional.empty());
        // WHEN & THEN
        assertThrows(TaskDoesNotExistException.class, () -> taskService.editTaskSeries(id,editTaskSeriesDTO));
    }

    @Test
    void deleteTask_shouldDeleteTask_whenCalled(){
        //GIVEN
        String id = "Unique1";
        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task(id + "1",Status.OPEN, LocalDate.of(2025, 10, 30)));

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
                taskList,
                "home123",
                new ArrayList<>()
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
        TaskDefinition taskDefinition = new TaskDefinition("1_D",
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
                taskList,
                "home123",
                new ArrayList<>());
    }

    private static EditTaskSeriesDTO geneartateEditTaskSeriesDTO(){
        List<String> itemIDs = new ArrayList<>();
        itemIDs.add("1");
        itemIDs.add("2");

        List<String> assignedUserIDs = new ArrayList<>();
        assignedUserIDs.add("1");
        assignedUserIDs.add("2");

        return new EditTaskSeriesDTO("Test",
                itemIDs,
                assignedUserIDs,
                Priority.HIGH,
                Status.OPEN,
                LocalDate.of(2025, 10, 30),
                4,
                "UniqueHome"
        );
    }

}
