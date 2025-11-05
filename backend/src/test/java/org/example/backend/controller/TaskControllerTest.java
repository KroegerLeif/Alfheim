package org.example.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.controller.dto.create.CreateTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskDTO;
import org.example.backend.controller.dto.edit.EditTaskSeriesDTO;
import org.example.backend.controller.dto.response.TaskTableReturnDTO;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Status;
import org.example.backend.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TaskService taskService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    void getAllTasks_shouldReturnAllTasks() throws Exception {
        //GIVEN
        List<TaskTableReturnDTO> tasks = List.of(
                new TaskTableReturnDTO("1", "1", "test", new ArrayList<>(), new ArrayList<>(), Priority.HIGH, Status.OPEN, null, 0, "home-1")
        );
        when(taskService.getAll()).thenReturn(tasks);

        //WHEN
        mockMvc.perform(get("/api/task"))
                .andExpect(status().isOk())
                .andExpect(content().json(
                        """
                        [
                          {
                              "id": "1",
                              "taskSeriesId": "1",
                              "name": "test",
                              "items": [],
                              "assignedTo": [],
                              "priority": "HIGH",
                              "status": "OPEN",
                              "dueDate": null,
                              "repetition": 0,
                              "homeId": "home-1"
                          }
                        ]
                        """
                ));
    }

    @Test
    @WithMockUser
    void createTask_shouldReturnCreatedTask_whenTaskIsCreated() throws Exception {
        //GIVEN
        CreateTaskDTO createTaskDTO = new CreateTaskDTO("Test", new ArrayList<>(), Priority.HIGH, null, null, 0);
        TaskTableReturnDTO createdTask = new TaskTableReturnDTO("10", "1", "Test", new ArrayList<>(), new ArrayList<>(), Priority.HIGH, Status.OPEN, null, 0, null);
        when(taskService.createNewTask(any(CreateTaskDTO.class))).thenReturn(createdTask);

        //WHEN
        mockMvc.perform(post("/api/task/create").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createTaskDTO)))
                .andExpect(status().isCreated())
                .andExpect(content().json("""
                                    {
                                        "id": "10",
                                        "taskSeriesId": "1",
                                        "name": "Test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "OPEN",
                                        "dueDate" : null,
                                        "repetition": 0,
                                        "homeId": null
                                      }
                       
                                    """, true));
    }

    @Test
    @WithMockUser
    void editTask_shouldReturnUpdatedTask_whenTaskIsEditedToINProgress() throws Exception {
        //GIVEN
        EditTaskDTO editTaskDTO = new EditTaskDTO(Status.IN_PROGRESS, null);
        TaskTableReturnDTO updatedTask = new TaskTableReturnDTO("1", "1", "test", new ArrayList<>(), new ArrayList<>(), Priority.HIGH, Status.IN_PROGRESS, LocalDate.now(), 0, "home-1");
        when(taskService.editTask(anyString(), any(EditTaskDTO.class))).thenReturn(updatedTask);

        //WHEN
        mockMvc.perform(patch("/api/task/1/edit-task").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editTaskDTO)))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                                    {
                                        "id": "1",
                                        "taskSeriesId": "1",
                                        "name": "test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "IN_PROGRESS",
                                        "dueDate": "%s",
                                        "repetition": 0,
                                        "homeId": "home-1"
                                      }
                                    
                                    """.formatted(LocalDate.now()), true));
    }

    @Test
    @WithMockUser
    void editTaskSeries_shouldReturnStatusOk_whenCalled() throws Exception {
        //GIVEN
        EditTaskSeriesDTO editTaskSeriesDTO = generateEditTaskSeriesDTO();

        //WHEN
        mockMvc.perform(patch("/api/task/1/editTaskSeries").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editTaskSeriesDTO)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void addTaskToHome_shouldReturnStatusOK_whenCalledToBeAddedToHome() throws Exception {
        //WHEN
        mockMvc.perform(patch("/api/task/1/addTaskToHome").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                    {
                                      "homeId"  : "1"
                                    }
                                    """
                        )
                )
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void deleteTask_shouldDeleteTask_whenCalled() throws Exception {
        //WHEN
        mockMvc.perform(delete("/api/task/1/delete").with(csrf()))
                .andExpect(status().isAccepted());
    }

    private static EditTaskSeriesDTO generateEditTaskSeriesDTO() {
        List<String> itemIDs = new ArrayList<>();
        itemIDs.add("1");
        itemIDs.add("2");

        List<String> assignedUserIDs = new ArrayList<>();
        assignedUserIDs.add("1");
        assignedUserIDs.add("2");

        return new EditTaskSeriesDTO("Test",
                itemIDs,
                assignedUserIDs,
                Priority.HIGH,
                Status.OPEN,
                LocalDate.now(),
                4,
                "UniqueHome"
        );
    }
}