package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.task.Status;
import org.example.backend.domain.task.Task;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.TaskCompletionException;
import org.example.backend.service.security.exception.TaskDoesNotExistException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;


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
        TaskSeries taskSeries = createUniqueIds(taskMapper.mapToTaskSeries(createTaskDTO));

        //added first task to tasklist
        taskSeries.taskList()
                .add(createFirstTask(
                        taskSeries.id(),
                        createTaskDTO)
                );

        taskseriesRepro.save(taskSeries);

        return taskMapper.mapToTaskTableReturn(taskSeries);

    }

    public List<TaskTableReturnDTO> getAll(){
        return taskseriesRepro.findAll().stream().map(taskMapper::mapToTaskTableReturn).toList();
    }

    public TaskTableReturnDTO editTask(String id, EditTaskDTO editTaskDTO) throws TaskDoesNotExistException, TaskCompletionException{
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> (new TaskDoesNotExistException("Task does not Exist")));

        if(editTaskDTO.status() == Status.CLOSED){
            //Checks if completion date is in the future
            if(editTaskDTO.dueDate().isAfter(LocalDate.now())){
                throw new TaskCompletionException("Completion Date can not be in the future");
            }
            //Replaced last task with closed task
            taskSeries = changeTaskStatus(taskSeries, Status.CLOSED);
            //Creation of new Task
            taskSeries = createNextTask(taskSeries);
        } else if (editTaskDTO.status() != taskSeries.taskList().getLast().status()) {
            taskSeries = changeTaskStatus(taskSeries, editTaskDTO.status());
        }

        if(editTaskDTO.dueDate() != taskSeries.taskList().getLast().dueDate()){
            //Changes the due date of the last task in the tasklist
            taskSeries = updateDueDate(taskSeries, editTaskDTO.dueDate());
        }

        taskseriesRepro.save(taskSeries);

        return taskMapper.mapToTaskTableReturn(taskSeries);
    }

    private TaskSeries createUniqueIds(TaskSeries taskSeries){
        //Creation of new IDs
        String taskServiceId = idService.createNewId();
        String taskDefId = taskServiceId + "_D";

        return new TaskSeries(
                taskServiceId,
                taskSeries.definition().withId(taskDefId),
                taskSeries.taskList()
        );
    }

    private Task createFirstTask(String uniqueId, CreateTaskDTO createTaskDTO){
        return new Task(uniqueId + 1,
                        Status.OPEN,
                        createTaskDTO.dueDate()
                        );
    }

    private TaskSeries changeTaskStatus(TaskSeries taskSeries, Status newStatus){
        Task lastTask = taskSeries.taskList().getLast();
        lastTask = lastTask.withDueDate(LocalDate.now());
        lastTask = lastTask.withStatus(newStatus);

        taskSeries.taskList().removeLast();
        taskSeries.taskList().add(lastTask);

        return taskSeries;
    }

    private TaskSeries createNextTask(TaskSeries taskSeries){
        String uniqueId = (taskSeries.id()) + (taskSeries.taskList().size());

        LocalDate nextDueDate = taskSeries.taskList().getLast().dueDate()
                                                .plusDays(
                                                    taskSeries.definition().repetition()
                                                );

        Task newTask = new Task(uniqueId, Status.OPEN, nextDueDate);
        taskSeries.taskList().add(newTask);

        return taskSeries;
    }

    private TaskSeries updateDueDate(TaskSeries taskSeries, LocalDate newDueDate){
        Task lastTask = taskSeries.taskList().getLast();
        lastTask = lastTask.withDueDate(newDueDate);

        taskSeries.taskList().removeLast();
        taskSeries.taskList().add(lastTask);

        return taskSeries;
    }

}
