package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
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

}
