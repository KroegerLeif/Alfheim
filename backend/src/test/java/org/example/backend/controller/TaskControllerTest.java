package org.example.backend.controller;

import org.example.backend.domain.task.*;
import org.example.backend.repro.TaskSeriesRepro;
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
import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureMockMvc
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TaskSeriesRepro taskSeriesRepro;

    @MockitoBean
    private IdService idService;

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
                                        "id": "11",
                                        "name": "Test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "OPEN",
                                        "dueDate" : null
                                      }
                       
                                    """));
    }
    
}