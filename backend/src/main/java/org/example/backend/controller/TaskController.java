package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.controller.dto.edit.EditTaskSeriesDTO;
import org.example.backend.service.TaskService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public List<TaskTableReturnDTO> getAllTasks() {
        return taskService.getAll();
    }

    @PostMapping("/create")
    public ResponseEntity<TaskTableReturnDTO> createTask(@RequestBody CreateTaskDTO createTaskDTO) {
        TaskTableReturnDTO createdTask = taskService.createNewTask(createTaskDTO);
        return new ResponseEntity<>(createdTask, HttpStatus.CREATED);
    }

    @PatchMapping("/{id}/edit-task")
    @ResponseStatus(HttpStatus.OK)
    public TaskTableReturnDTO editTask(@PathVariable String id, @RequestBody EditTaskDTO editTask){
        return taskService.editTask(id, editTask);
    }

    @PatchMapping("/{id}/addTaskToHome")
    @ResponseStatus(HttpStatus.OK)
    public void addTaskToHome(@PathVariable String id, @RequestBody String homeId){
        taskService.addTaskToHome(id, homeId);
    }

    @PatchMapping("/{id}/editTaskSeries")
    @ResponseStatus(HttpStatus.OK)
    public void editTaskSeries(@PathVariable String id, @RequestBody EditTaskSeriesDTO editTaskSeriesDto){
        taskService.editTaskSeries(id, editTaskSeriesDto);
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteTask(@PathVariable String id) {
        taskService.deleteTask(id);
    }

}
