package org.example.backend.service;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Status;
import org.example.backend.domain.task.TaskDefinition;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;

import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.util.ArrayList;


class TaskServiceTest {

    @Mock
    private final TaskSeriesRepro mockRepo = Mockito.mock(TaskSeriesRepro.class);
    @Mock
    private final TaskMapper homeMapper = Mockito.mock(TaskMapper.class);
    @Mock
    private final IdService idService = Mockito.mock(IdService.class);

    TaskService taskService = new TaskService(mockRepo, homeMapper, idService);

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
                "Test Task",
                new ArrayList<>(),
                new ArrayList<>(),
                Priority.HIGH,
                Status.OPEN,
                LocalDate.of(2025, 12, 31)
        );
        
        Mockito.when(homeMapper.mapToTaskSeries(createTaskDTO)).thenReturn(taskSeries);
        Mockito.when(idService.createNewId()).thenReturn(expectedTaskSeriesId);
        Mockito.when(mockRepo.save(Mockito.any(TaskSeries.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(homeMapper.mapToTaskTableReturn(Mockito.any(TaskSeries.class))).thenReturn(expectedReturn);
        
        //WHEN
        TaskTableReturnDTO result = taskService.createNewTask(createTaskDTO);
        
        //THEN
        Mockito.verify(homeMapper).mapToTaskSeries(createTaskDTO);
        Mockito.verify(idService, Mockito.times(1)).createNewId();
        Mockito.verify(mockRepo).save(Mockito.any(TaskSeries.class));
        Mockito.verify(homeMapper).mapToTaskTableReturn(Mockito.any(TaskSeries.class));
        
        assert result != null;
        assert result.id().equals(expectedTaskSeriesId);
        assert result.name().equals("Test Task");
        assert result.priority().equals(Priority.HIGH);
        assert result.status().equals(Status.OPEN);
        assert result.dueDate().equals(LocalDate.of(2025, 12, 31));
    }
}