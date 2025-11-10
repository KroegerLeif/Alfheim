package org.example.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.Role;
import org.example.backend.domain.user.User;
import org.example.backend.repro.HomeRepro;
import org.example.backend.repro.UserRepro;
import org.example.backend.service.UserService;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest
@AutoConfigureMockMvc
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private HomeRepro homeRepro;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private IdService idService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private UserRepro userRepro;

    @BeforeEach
    void setUp() {
        User mockUser = new User("user", "user");
        when(userService.getUserById("user")).thenReturn(mockUser);
        when(userRepro.findById("user")).thenReturn(Optional.of(mockUser));

        User mockUser1 = new User("1", "user1");
        when(userService.getUserById("1")).thenReturn(mockUser1);
    }

    @AfterEach
    void tearDown() {
        homeRepro.deleteAll();
    }

    @Test
    @WithMockUser
    void getAllHomes_shouldReturnEmptyList_whenNoHomesExist() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));
    }

    @Test
    @WithMockUser
    void getAllHomes_shouldReturnListOfHomes_whenHomesExist() throws Exception {
        Address address = new Address("1", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", address, members);
        homeRepro.save(home);

        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(jsonPath("$[0].id").value("1"))
                .andExpect(jsonPath("$[0].name").value("home"))
                .andExpect(jsonPath("$[0].address.street").value("street"))
                .andExpect(jsonPath("$[0].admin").value("user"))
                .andExpect(jsonPath("$[0].members[0]").value("user"));
    }

    @Test
    @WithMockUser
    void getHomeNames_shouldReturnListOfHomeNames_whenHomesExist() throws Exception {
        Address address = new Address("1", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", address, members);
        homeRepro.save(home);

        mockMvc.perform(MockMvcRequestBuilders.get("/api/home/getNames"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(jsonPath("$[0].id").value("1"))
                .andExpect(jsonPath("$[0].name").value("home"));
    }

    @Test
    @WithMockUser
    void createHome_shouldReturnCreatedHome_whenHomeIsCreated() throws Exception {
        //GIVEN
        when(idService.createNewId()).thenReturn("1");

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.post("/api/home/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                        {
                                          "name" : "Test",
                                          "address": {
                                                      "id": "1",
                                                      "street": "street",
                                                      "postCode": "postCode",
                                                      "city": "city",
                                                      "country": "country"
                                                    }
                                        }
                                        """
                        ))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.name").value("Test"))
                .andExpect(jsonPath("$.address.street").value("street"))
                .andExpect(jsonPath("$.admin").value("user"))
                .andExpect(jsonPath("$.members[0]").value("user"));

    }

    @Test
    @WithMockUser
    void editHome_shouldUpdateAllFields_whenAllFieldsAreProvided() throws Exception {
        //GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", originalAddress, members);
        homeRepro.save(home);

        EditHomeDTO editHomeDTO = getEditHomeDTO();


        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.name").value("Updated Home"))
                .andExpect(jsonPath("$.address.street").value("new street"))
                .andExpect(jsonPath("$.admin").value("user"))
                .andExpect(jsonPath("$.members[0]").value("user"));
    }

    @Test
    @WithMockUser
    void editHome_shouldUpdateOnlyName_whenOnlyNameIsProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", originalAddress, members);
        homeRepro.save(home);

        EditHomeDTO editHomeDTO = new EditHomeDTO("Updated Name", null, new ArrayList<>());

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.name").value("Updated Name"))
                .andExpect(jsonPath("$.address.street").value("street"))
                .andExpect(jsonPath("$.admin").value("user"))
                .andExpect(jsonPath("$.members[0]").value("user"));
    }

    @Test
    @WithMockUser
    void editHome_shouldUpdateOnlyAddress_whenOnlyAddressIsProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", originalAddress, members);
        homeRepro.save(home);

        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");
        EditHomeDTO editHomeDTO = new EditHomeDTO(null, updatedAddress, null);

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.name").value("home"))
                .andExpect(jsonPath("$.address.street").value("new street"))
                .andExpect(jsonPath("$.admin").value("user"))
                .andExpect(jsonPath("$.members[0]").value("user"));
    }

    @Test
    @WithMockUser
    void deleteHome_shouldDeleteHome_whenCalled() throws Exception {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Map<String, Role> members = new HashMap<>();
        members.put("user", Role.ADMIN);
        Home home = new Home("1", "home", address, members);
        homeRepro.save(home);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.delete("/api/home/1/delete"))
                .andExpect(MockMvcResultMatchers.status().isAccepted());

        //THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));

    }

    private EditHomeDTO getEditHomeDTO() {
        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");

        List<String> userList = new ArrayList<>();
        userList.add("1");

        return new EditHomeDTO("Updated Home", updatedAddress, userList);
    }
}
