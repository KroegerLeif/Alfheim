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
import org.example.backend.domain.user.User;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.mapper.TaskMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.TaskCompletionException;
import org.example.backend.service.security.exception.TaskDoesNotExistException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;


@Service
public class TaskService {

    private final TaskSeriesRepro taskseriesRepro;
    private final TaskMapper taskMapper;
    private final IdService idService;
    private final ItemService itemService;
    private final UserService userService;
    // HomeService wird nicht mehr für die Kernlogik benötigt, nur noch für Berechtigungsprüfungen
    private final HomeService homeService;


    public TaskService(TaskSeriesRepro taskseriesRepro, TaskMapper taskMapper, IdService idService, ItemService itemService, UserService userService, HomeService homeService) {
        this.taskseriesRepro = taskseriesRepro;
        this.taskMapper = taskMapper;
        this.idService = idService;
        this.itemService = itemService;
        this.userService = userService;
        this.homeService = homeService;
    }

    public TaskTableReturnDTO createNewTask(CreateTaskDTO createTaskDTO) {
        TaskSeries taskSeries = taskMapper.mapToTaskSeries(createTaskDTO);

        // Wenn keine homeId angegeben ist, ist es eine persönliche Task
        if (taskSeries.homeId() == null || taskSeries.homeId().isEmpty()) {
            String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();
            taskSeries = taskSeries.withOwnerUserIds(List.of(currentUserId));
        } else {
            // TODO: Berechtigungsprüfung: Darf der User in diesem Haus Tasks erstellen?
            // homeService.isUserMemberOfHome(taskSeries.homeId(), currentUserId);
        }

        taskSeries = createUniqueIds(taskSeries);

        //added first task to tasklist
        taskSeries.taskList()
                .add(createFirstTask(
                        taskSeries.id(),
                        createTaskDTO));

        taskseriesRepro.save(taskSeries);

        return taskMapper.mapToTaskTableReturn(taskSeries);
    }

    public List<TaskTableReturnDTO> getAll(){
        String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();
        // TODO: Hole die Home-IDs, in denen der User Mitglied ist, z.B. über den HomeService
        // List<String> userHomeIds = homeService.getHomeIdsForUser(currentUserId);

        // Dies ist eine vereinfachte Logik. Eine performantere Lösung würde eine custom Query im Repository verwenden.
        return taskseriesRepro.findAll().stream()
                .filter(ts -> {
                    // Task gehört zu einem Haus, in dem der User Mitglied ist
                    boolean isHomeTask = ts.homeId() != null; // && userHomeIds.contains(ts.homeId());
                    // Task gehört direkt dem User
                    boolean isPersonalTask = ts.ownerUserIds() != null && ts.ownerUserIds().contains(currentUserId);
                    return isHomeTask || isPersonalTask;
                })
                .map(taskMapper::mapToTaskTableReturn)
                .collect(Collectors.toList());
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

        // Logik zum Ändern der Zugehörigkeit
        if (editTaskSeriesDto.homeId() != null){
            // TODO: Berechtigungsprüfung: Darf der User die Task diesem Haus zuordnen?
            taskSeries = taskSeries.withHomeId(editTaskSeriesDto.homeId()).withOwnerUserIds(null);
        }

        taskseriesRepro.save(taskSeries);

    }

    public void deleteTask(String id) {
        // TODO: Berechtigungsprüfung: Darf der aktuelle User diese Task löschen?
        taskseriesRepro.deleteById(id);
    }

    public void addTaskToHome(String id, String homeId) {
        // Diese Methode ist jetzt veraltet und sollte durch die Logik in editTaskSeries ersetzt werden.
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> new TaskDoesNotExistException("Task does not Exist"));
        // TODO: Berechtigungsprüfung
        taskseriesRepro.save(taskSeries.withHomeId(homeId).withOwnerUserIds(null));
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
                taskSeries.ownerUserIds()
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

        Task newTask = new Task(uniqueId, Status.OPEN, nextDueDate);
        taskSeries.taskList().add(newTask);
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
        List<User> assignedUserList = new ArrayList<>();
        for(String s: assignedUser){
            assignedUserList.add(userService.getUserById(s));
        }
        return taskSeries.withDefinition(taskSeries.definition().withResponsible(assignedUserList));
    }

    private  TaskSeries changePriority(Priority newPriority, TaskSeries taskSeries){
        return taskSeries.withDefinition(taskSeries.definition().withPriority(newPriority));
    }

    private TaskSeries changeRepetition(int newRepetition, TaskSeries taskSeries){
        return taskSeries.withDefinition(taskSeries.definition().withRepetition(newRepetition));
    }

}
