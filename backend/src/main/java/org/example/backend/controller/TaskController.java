package org.example.backend.controller;

import org.example.backend.controller.dto.CreateTaskDTO;
import org.example.backend.controller.dto.TaskTableReturnDTO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/task")
public class TaskController {

    @PostMapping("/create")
    public ResponseEntity<TaskTableReturnDTO> createTask(@RequestBody CreateTaskDTO createTaskDTO) {
        TaskTableReturnDTO createdTask = taskService.createNewHome(createTaskDTO);
        return new ResponseEntity<>(createdTask, HttpStatus.CREATED);
    }

}
