package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.controller.dto.edit.EditTaskSeriesDTO;
import org.example.backend.service.TaskService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/task")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("")
    @ResponseStatus(HttpStatus.OK)
    public List<TaskTableReturnDTO> getAllTasks(Principal principal) {
        return taskService.getAll(principal.getName());
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskTableReturnDTO createTask(Principal principal, @RequestBody CreateTaskDTO createTaskDTO) {
        return taskService.createNewTask(principal.getName(),createTaskDTO);
    }

    @PatchMapping("/{id}/edit-task")
    @ResponseStatus(HttpStatus.OK)
    public TaskTableReturnDTO editTask(Principal principal, @PathVariable String id, @RequestBody EditTaskDTO editTask){
        return taskService.editTask(principal.getName(), id, editTask);
    }

    @PatchMapping("/{id}/editTaskSeries")
    @ResponseStatus(HttpStatus.OK)
    public void editTaskSeries(Principal principal,@PathVariable String id, @RequestBody EditTaskSeriesDTO editTaskSeriesDto){
        taskService.editTaskSeries(principal.getName(), id, editTaskSeriesDto);
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteTask(Principal principal, @PathVariable String id) {
        taskService.deleteTask(principal.getName(), id);
    }

}
