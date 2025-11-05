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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;


@ExtendWith(MockitoExtension.class)
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
    @Mock
    private final UserService userService = Mockito.mock(UserService.class);

    private TaskService taskService;
    private final String TEST_USER_ID = "user-123";

    @BeforeEach
    void setUp() {
        taskService = new TaskService(mockRepo, taskMapper, idService, itemService, userService, homeService);

        // Simulate a logged-in user for all tests
        Authentication authentication = Mockito.mock(Authentication.class);
        SecurityContext securityContext = Mockito.mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn(TEST_USER_ID);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        //WHEN
        when(mockRepo.findAll()).thenReturn(new ArrayList<>());
        //THEN
        var actual = taskService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        // GIVEN
        // A personal task belonging to the current user
        TaskSeries personalTask = createTaskSeries("1", null, List.of(TEST_USER_ID));
        // A home task
        TaskSeries homeTask = createTaskSeries("2", "home-abc", null);
        // A personal task belonging to another user
        TaskSeries otherUserTask = createTaskSeries("3", null, List.of("other-user-456"));

        List<TaskSeries> allTasks = List.of(personalTask, homeTask, otherUserTask);

        when(mockRepo.findAll()).thenReturn(allTasks);
        // Mock the mapper to return a dummy DTO for any TaskSeries
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(new TaskTableReturnDTO(
                "dummyId",
                "dummySeriesId",
                "dummyName",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.MEDIUM,
                Status.OPEN,
                LocalDate.now(),
                0,
                "dummyHomeId"
        ));

        // WHEN
        var actual = taskService.getAll();

        // THEN
        // It should return the personal task and the home task, but not the other user's task.
        assertEquals(2, actual.size());
    }

    @Test
    void createNewTask_shouldCreatePersonalTask_whenHomeIdIsNull() {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO(
                "Test Task",
                new ArrayList<>(),
                Priority.HIGH,
                LocalDate.of(2025, 12, 31),
                null, // No homeId -> personal task
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
                new ArrayList<>(),
                null,
                null
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

        when(taskMapper.mapToTaskSeries(createTaskDTO)).thenReturn(taskSeries);
        when(idService.createNewId()).thenReturn(expectedTaskSeriesId);
        ArgumentCaptor<TaskSeries> taskSeriesCaptor = ArgumentCaptor.forClass(TaskSeries.class);
        when(mockRepo.save(taskSeriesCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.createNewTask(createTaskDTO);

        //THEN
        assertEquals(expectedReturn, result);

        // Verify the saved object
        TaskSeries savedTask = taskSeriesCaptor.getValue();
        assertEquals(expectedTaskSeriesId, savedTask.id());
        assertEquals(List.of(TEST_USER_ID), savedTask.ownerUserIds());
        assertEquals(null, savedTask.homeId());
    }

    @Test
    void createNewTask_shouldCreateHomeTask_whenHomeIdIsProvided() {
        //GIVEN
        String homeId = "home-abc";
        CreateTaskDTO createTaskDTO = new CreateTaskDTO(
                "Home Task",
                new ArrayList<>(),
                Priority.LOW,
                LocalDate.of(2024, 12, 31),
                homeId, // homeId is provided
                0
        );

        String expectedTaskSeriesId = "task-series-456";

        TaskSeries taskSeriesFromMapper = new TaskSeries(
                null,
                new TaskDefinition(null, "Home Task", new ArrayList<>(), new ArrayList<>(), null, Priority.LOW, 0),
                new ArrayList<>(),
                homeId,
                null
        );

        TaskTableReturnDTO expectedReturn = new TaskTableReturnDTO(
                expectedTaskSeriesId + "0",
                expectedTaskSeriesId,
                "Home Task",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.LOW,
                Status.OPEN,
                LocalDate.of(2024, 12, 31),
                0,
                homeId
        );

        when(taskMapper.mapToTaskSeries(createTaskDTO)).thenReturn(taskSeriesFromMapper);
        when(idService.createNewId()).thenReturn(expectedTaskSeriesId);
        ArgumentCaptor<TaskSeries> taskSeriesCaptor = ArgumentCaptor.forClass(TaskSeries.class);
        when(mockRepo.save(taskSeriesCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskMapper.mapToTaskTableReturn(any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.createNewTask(createTaskDTO);

        //THEN
        assertEquals(expectedReturn, result);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));

        // Verify the saved object
        TaskSeries savedTask = taskSeriesCaptor.getValue();
        assertEquals(expectedTaskSeriesId, savedTask.id());
        assertEquals(homeId, savedTask.homeId());
        assertEquals(null, savedTask.ownerUserIds());
    }

    @Test
    void editTask_shouldReturnTaskTableReturnDTO_whenTaskIsEdited() throws TaskDoesNotExistException, TaskCompletionException {
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
                null
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
        when(taskMapper.mapToTaskTableReturn(Mockito.any(TaskSeries.class))).thenReturn(expectedReturn);


        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        assertEquals(expectedReturn,result);

    }

    @Test
    void editTask_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist() {
        // GIVEN
        String id = "non-existent-id";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());
        EditTaskDTO editDto = new EditTaskDTO(Status.IN_PROGRESS, LocalDate.now());

        // WHEN & THEN
        TaskDoesNotExistException exception = assertThrows(TaskDoesNotExistException.class, () -> taskService.editTask(id, editDto));
        assertEquals("Task does not Exist", exception.getMessage());
    }

    @Test
    void editTask_shouldThrowException_whenClosingTaskWithDueDateInTheFuture() {
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
                null,
                null
        );
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.CLOSED,LocalDate.now().plusDays(5));

        // WHEN & THEN
        TaskCompletionException exception = assertThrows(TaskCompletionException.class, () -> taskService.editTask(id, editTaskDTO));
        assertEquals("Completion Date can not be in the future", exception.getMessage());
    }

    @Test
    void editTask_shouldReturnTaskTableReturnDTOWithNewTask_whenTaskIsCompleted() throws TaskDoesNotExistException, TaskCompletionException {
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
                null
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
        when(taskMapper.mapToTaskTableReturn(Mockito.any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        assertEquals(expectedReturn,result);
        assertEquals(2, savedTaskSeries.taskList().size());
        assertEquals(Status.CLOSED, savedTaskSeries.taskList().getFirst().status());
    }

    @Test
    void editTask_shouldReturnTaskWithUpdatedDueDate_whenDueDateIsUpdated() throws TaskDoesNotExistException, TaskCompletionException {
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
                null
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

        ArgumentCaptor<TaskSeries> captor = ArgumentCaptor.forClass(TaskSeries.class);
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedTaskSeries));
        when(mockRepo.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskMapper.mapToTaskTableReturn(Mockito.any(TaskSeries.class))).thenReturn(expectedReturn);

        //WHEN
        TaskTableReturnDTO result = taskService.editTask(id,editTaskDTO);

        //THEN
        assertEquals(expectedReturn,result);
        assertEquals(newDueDate, captor.getValue().taskList().getFirst().dueDate());
    }

    @Test
    void editTaskSeries_shouldUpdateTask_whenCalled() throws TaskDoesNotExistException {
        //GIVEN
        String id = "1";
        EditTaskSeriesDTO editTaskSeriesDTO = geneartateEditTaskSeriesDTO();
        TaskSeries taskSeries = createTaskSeries();

        when(mockRepo.findById(id)).thenReturn(Optional.of(taskSeries));
        //WHEN
        taskService.editTaskSeries(id,editTaskSeriesDTO);
        //THEN
        Mockito.verify(mockRepo).findById(id);
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
    }

    @Test
    void editTaskSeries_shouldThrowTaskDoesNotExistException_whenTaskDoesNotExist() {
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
        // No need to mock anything for the delete operation itself

        //WHEN
        taskService.deleteTask(id);

        //THEN
        Mockito.verify(mockRepo).deleteById(id);
    }

    private static TaskSeries createTaskSeries() {
        return createTaskSeries("1", null, List.of("user-123"));
    }

    private static TaskSeries createTaskSeries(String id, String homeId, List<String> ownerIds) {
        TaskDefinition taskDefinition = new TaskDefinition(id + "_D",
                "test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(1),
                Priority.HIGH,
                2);

        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task("1", Status.OPEN, null));
        return new TaskSeries(id,
                taskDefinition,
                taskList,
                homeId,
                ownerIds
        );
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
