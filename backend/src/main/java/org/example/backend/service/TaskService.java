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
import org.example.backend.service.security.exception.HomeDoesNotExistException;
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
    private final UserService userService;


    public TaskService(TaskSeriesRepro taskseriesRepro, TaskMapper taskMapper, IdService idService, ItemService itemService, HomeService homeService, UserService userService) {
        this.taskseriesRepro = taskseriesRepro;
        this.taskMapper = taskMapper;
        this.idService = idService;
        this.itemService = itemService;
        this.homeService = homeService;
        this.userService = userService;
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
        return taskseriesRepro.findAll().stream().map
                ((taskSeries -> taskMapper.mapToTaskTableReturn(taskSeries).withHomeId(
                        getHomeID(taskSeries.id())))
                ).toList();
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

        return taskMapper.mapToTaskTableReturn(taskSeries).withHomeId(getHomeID(taskSeries.id()));
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
            homeService.addTaskToHome(editTaskSeriesDto.homeId(), taskSeries);
        }

        taskseriesRepro.save(taskSeries);

    }

    public void deleteTask(String id) {
        taskseriesRepro.deleteById(id);
        try{
            homeService.deleteTaskFromHome(id);
        }catch (HomeDoesNotExistException e){
            //Do nothing
        }

    }

    public void addTaskToHome(String id, String homeId) {
        TaskSeries taskSeries = taskseriesRepro.findById(id).orElseThrow(() -> new TaskDoesNotExistException("Task does not Exist"));
        homeService.addTaskToHome(homeId, taskSeries);
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

    private String getHomeID(String taskSeriesId){
        try {
            return homeService.getHomeWithConnectedTask(taskSeriesId);
        } catch (HomeDoesNotExistException e) {
            return "";
        }
    }

}
