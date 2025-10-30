package org.example.backend.controller;

import org.example.backend.domain.task.*;
import org.example.backend.repro.TaskSeriesRepro;
import org.example.backend.service.HomeService;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest
@AutoConfigureMockMvc
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TaskSeriesRepro taskSeriesRepro;

    @MockitoBean
    private IdService idService;
    @MockitoBean
    private HomeService homeService;

    @AfterEach
    void tearDown() {
        taskSeriesRepro.deleteAll();
    }
    
    @Test
    void getAllTasks_shouldReturnAllTasks() throws Exception {
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        taskSeriesRepro.save(taskSeries);
        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/task"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
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
                              "dueDate": null
                          }
                        ]
                        """
                ));
    }

    @Test
    void createTask_shouldReturnCreatedTask_whenTaskIsCreated() throws Exception {
        //GIVEN
        when(idService.createNewId()).thenReturn("1");

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.post("/api/task/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                    {
                                      "name" : "Test",
                                      "items": [],
                                      "priority": "HIGH",
                                      "dueDate" : "",
                                      "repetition": 0
                                    }
                                """
                        ))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andExpect(MockMvcResultMatchers.content().json("""
                                    {
                                        "id": "10",
                                        "taskSeriesId": "1",
                                        "name": "Test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "OPEN",
                                        "dueDate" : null
                                      }
                       
                                    """));
    }

    @Test
    void editTask_shouldReturnUpdatedTask_whenTaskIsEditedToINProgress()throws Exception{
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        taskSeriesRepro.save(taskSeries);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/task/1/edit-task")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                    {
                                      "status" : "IN_PROGRESS",
                                      "dueDate": null
                                    }
                                """
                        ))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                                    {
                                        "id": "1",
                                        "taskSeriesId": "1",
                                        "name": "test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "IN_PROGRESS",
                                        "dueDate": "%s"
                                      }
                                    
                                    """.formatted(LocalDate.now())));
    }

    @Test
    void addTaskToHome_shouldReturnStatusOK_whenCalledToBeAddedToHome() throws Exception {
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        taskSeriesRepro.save(taskSeries);
        doNothing().when(homeService).addTaskToHome(eq("1"), any(TaskSeries.class));

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/task/1/addTaskToHome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                    {
                                      "homeId"  : "1"
                                    }
                                    """
                            )
                        )
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    void deleteTask_shouldDeleteTask_whenCalled() throws Exception {
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        taskSeriesRepro.save(taskSeries);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.delete("/api/task/1/delete"))
                .andExpect(MockMvcResultMatchers.status().isAccepted());

        //THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/task"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));
    }

    private static TaskSeries createTaskSeries() {
        TaskDefinition taskDefinition = new TaskDefinition("1",
                "test",
                new ArrayList<>(),
                new ArrayList<>(),
                new BigDecimal(1),
                Priority.HIGH,
                2);

        List<Task> taskList = new ArrayList<>();
        taskList.add(new Task("1", Status.OPEN, null));

        return new TaskSeries("1",
                taskDefinition,
                taskList);
    }
}