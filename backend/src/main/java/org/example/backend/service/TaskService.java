package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskSeriesDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.Priority;
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
import java.util.ArrayList;
import java.util.List;


@Service
public class TaskService {

    private final TaskSeriesRepro taskseriesRepro;
    private final TaskMapper taskMapper;
    private final IdService idService;
    private final ItemService itemService;
    private final HomeService homeService;


    public TaskService(TaskSeriesRepro taskseriesRepro, TaskMapper taskMapper, IdService idService, ItemService itemService, HomeService homeService) {
        this.taskseriesRepro = taskseriesRepro;
        this.taskMapper = taskMapper;
        this.idService = idService;
        this.itemService = itemService;
        this.homeService = homeService;
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

    public List<TaskTableReturnDTO> getAll(String userName){
        List<String> homeId = homeService.findHomeConnectedToUser(userName);
        //Check User associated with the task
        List<TaskSeries> connectedTasks = taskseriesRepro.findAllByTaskMembersContaining(userName);
        //Check for the task with associated with the House
        for(String connectedHome: homeId){
            connectedTasks.addAll(taskseriesRepro.findAllByHomeId(connectedHome));
        }

        return connectedTasks.stream()
                .map((taskMapper::mapToTaskTableReturn))
                .toList();
    }

    public TaskTableReturnDTO editTask(String id, EditTaskDTO editTaskDTO) throws TaskDoesNotExistException, TaskCompletionException{
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> (new TaskDoesNotExistException("Task does not Exist")));

        if(editTaskDTO.status() == Status.CLOSED){
            //Checks if completion date is in the future
            if(editTaskDTO.dueDate() != null && editTaskDTO.dueDate().isAfter(LocalDate.now())){
                throw new TaskCompletionException("Completion Date can not be in the future");
            }
            //Replaced last task with closed task
            changeTaskStatus(taskSeries, Status.CLOSED);
            //Creation of new Task
            createNextTask(taskSeries);
        } else if (editTaskDTO.status() != taskSeries.taskList().getLast().status()) {
            changeTaskStatus(taskSeries, editTaskDTO.status());
        }

        if(editTaskDTO.dueDate() != null && editTaskDTO.dueDate() != taskSeries.taskList().getLast().dueDate()){
            //Changes the due date of the last task in the tasklist
            updateDueDate(taskSeries, editTaskDTO.dueDate());
        }

        taskseriesRepro.save(taskSeries);

        return taskMapper.mapToTaskTableReturn(taskSeries);
    }

    public void editTaskSeries(String id, EditTaskSeriesDTO editTaskSeriesDto) throws TaskDoesNotExistException {
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> new TaskDoesNotExistException("Task does not Exist"));

        if(editTaskSeriesDto.name() != null){
            taskSeries = changeTaskName(editTaskSeriesDto.name(), taskSeries);
        }

        if(editTaskSeriesDto.itemId() != null){
            taskSeries = changeTaskItems(editTaskSeriesDto.itemId(), taskSeries);
        }

        if(editTaskSeriesDto.assignedUser() != null){
            taskSeries = changeAssignedUsers(editTaskSeriesDto.assignedUser(), taskSeries);
        }

        if(editTaskSeriesDto.priority() != null){
            taskSeries = changePriority(editTaskSeriesDto.priority(), taskSeries);
        }

        if(editTaskSeriesDto.dueDate() != null){
            updateDueDate(taskSeries, editTaskSeriesDto.dueDate());
        }

        if (editTaskSeriesDto.repetition() != taskSeries.definition().repetition()) {
            taskSeries = changeRepetition(editTaskSeriesDto.repetition(), taskSeries);
        }

        if (editTaskSeriesDto.homeId() != null && !editTaskSeriesDto.homeId().isEmpty()){
            taskSeries = taskSeries.withHomeId(editTaskSeriesDto.homeId());
        }

        taskseriesRepro.save(taskSeries);

    }

    public void deleteTask(String id) {
        taskseriesRepro.deleteById(id);
    }

    public void addTaskToHome(String id, String homeId) {
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> new TaskDoesNotExistException("Task does not Exist"));
        taskseriesRepro.save(taskSeries.withHomeId(homeId));
    }

    private TaskSeries createUniqueIds(TaskSeries taskSeries){
        //Creation of new IDs
        String taskServiceId = idService.createNewId();
        String taskDefId = taskServiceId + "_D";

        return new TaskSeries(
                taskServiceId,
                taskSeries.definition().withId(taskDefId),
                taskSeries.taskList(),
                taskSeries.homeId(),
                taskSeries.taskMembers()
        );
    }

    private Task createFirstTask(String uniqueId, CreateTaskDTO createTaskDTO){
        return new Task(uniqueId + 0,
                        Status.OPEN,
                        createTaskDTO.dueDate()
                        );
    }

    private void changeTaskStatus(TaskSeries taskSeries, Status newStatus){
        Task lastTask = taskSeries.taskList().getLast();
        lastTask = lastTask.withDueDate(LocalDate.now());
        lastTask = lastTask.withStatus(newStatus);

        taskSeries.taskList().removeLast();
        taskSeries.taskList().add(lastTask);
    }

    private void createNextTask(TaskSeries taskSeries){
        String uniqueId = (taskSeries.id()) + (taskSeries.taskList().size());

        LocalDate nextDueDate = taskSeries.taskList().getLast().dueDate()
                                                .plusDays(
                                                    taskSeries.definition().repetition()
                                                );

        //Adds new Task if the due date is not the same as the last task in the tasklist
        if(nextDueDate != taskSeries.taskList().getLast().dueDate()){
            Task newTask = new Task(uniqueId, Status.OPEN, nextDueDate);
            taskSeries.taskList().add(newTask);
        }
    }

    private void updateDueDate(TaskSeries taskSeries, LocalDate newDueDate){
        Task lastTask = taskSeries.taskList().getLast();
        lastTask = lastTask.withDueDate(newDueDate);

        taskSeries.taskList().removeLast();
        taskSeries.taskList().add(lastTask);
    }

    private TaskSeries changeTaskName(String newName, TaskSeries taskSeries) {
        return taskSeries.withDefinition(taskSeries.definition().withName(newName));
    }

    private  TaskSeries changeTaskItems(List<String> itemId, TaskSeries taskSeries){
        List<Item> itemList = new ArrayList<>();
        for(String s: itemId){
            itemList.add(itemService.getItemById(s));
        }
        return taskSeries.withDefinition(taskSeries.definition().withConnectedItems(itemList));
    }

    private  TaskSeries changeAssignedUsers(List<String> assignedUser, TaskSeries taskSeries){
        return taskSeries.withDefinition(taskSeries.definition().withResponsible(assignedUser));
    }

    private  TaskSeries changePriority(Priority newPriority, TaskSeries taskSeries){
        return taskSeries.withDefinition(taskSeries.definition().withPriority(newPriority));
    }

    private TaskSeries changeRepetition(int newRepetition, TaskSeries taskSeries){
        return taskSeries.withDefinition(taskSeries.definition().withRepetition(newRepetition));
    }

    private List<String> getHomeIds(String userId){
        return homeService.findHomeConnectedToUser(userId);
    }

}
