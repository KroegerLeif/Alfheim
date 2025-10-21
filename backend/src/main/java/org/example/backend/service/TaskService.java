package org.example.backend.service;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.example.backend.domain.task.Status;
import org.example.backend.domain.task.Task;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;
import org.springframework.stereotype.Service;


@Service
public class TaskService {

    private final TaskSeriesRepro taskseriesRepro;
    private final TaskMapper taskMapper;
    private final IdService idService;

    public TaskService(TaskSeriesRepro taskseriesRepro, TaskMapper taskMapper, IdService idService) {
        this.taskseriesRepro = taskseriesRepro;
        this.taskMapper = taskMapper;
        this.idService = idService;
    }

    public TaskTableReturnDTO createNewTask(CreateTaskDTO createTaskDTO) {
        TaskSeries task_series = createUniqueIds(taskMapper.mapToTaskSeries(createTaskDTO));

        //added first task to tasklist
        task_series.taskList()
                .add(createFirstTask(
                        task_series.id(),
                        createTaskDTO)
                );

        taskseriesRepro.save(task_series);

        return taskMapper.mapToTaskTableReturn(task_series);

    }

    private TaskSeries createUniqueIds(TaskSeries task_series){
        //Creation of new IDs
        String taskService_id = idService.createNewId();
        String taskDef_id = taskService_id + "_D";

        return new TaskSeries(
                taskService_id,
                task_series.definition().withId(taskDef_id),
                task_series.taskList()
        );
    }

    private Task createFirstTask(String uniqueId, CreateTaskDTO createTaskDTO){
        return new Task(uniqueId + 1,
                        Status.OPEN,
                        createTaskDTO.dueDate(),
                        null
                        );
    }

}
