package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.Role;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class) // Ermöglicht die Verwendung von @Mock-Annotationen ohne manuelles Mocking
class HomeServiceTest {

    @Mock
    private final HomeRepro mockRepo = Mockito.mock(HomeRepro.class);
    @Mock
    private final HomeMapper homeMapper = Mockito.mock(HomeMapper.class);
    @Mock
    private final IdService idService = Mockito.mock(IdService.class);

    private HomeService homeService;

    @BeforeEach
    void setUp() {
        homeService = new HomeService(mockRepo, homeMapper, idService);
    }


    @Test
    void getAllHomes() {
        //WHEN
        ArrayList<Home> response = new ArrayList<>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        homeService.getAllHomes();
        Mockito.verify(mockRepo).findAll();
    }

    @Test
    void getHomeNames_shouldReturnAllHomes_whenCalled(){
        //GIVEN
        Home home = new Home("1", "Test", new Address("1", "street", "postCode", "city", "country"), new HashMap<>());
        ArrayList<Home> response = new ArrayList<>();
        response.add(home);

        when(mockRepo.findAll()).thenReturn(response);
        //WHEN
        homeService.getHomeNames();
        //THEN
        Mockito.verify(mockRepo).findAll();
    }

    @Test
    void createNewHome_shouldReturnHomeTableReturnDTO_whenHomeIsCreated() {
        //GIVEN
        String testUserId = "user-123";
        Address address = new Address("1", "street", "postCode", "city", "country");
        CreateHomeDTO createHomeDTO = new CreateHomeDTO("New Home", address);

        // 1. Simulieren, dass ein Benutzer angemeldet ist
        Authentication authentication = Mockito.mock(Authentication.class);
        SecurityContext securityContext = Mockito.mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn(testUserId);
        SecurityContextHolder.setContext(securityContext);

        // 2. Vorbereiten der gemockten Methodenaufrufe
        Home homeWithoutIdAndMembers = new Home(null, "New Home", address, null);
        when(homeMapper.mapToHome(createHomeDTO)).thenReturn(homeWithoutIdAndMembers);
        when(idService.createNewId()).thenReturn("1");

        // ArgumentCaptor, um das gespeicherte Objekt zu überprüfen
        ArgumentCaptor<Home> homeCaptor = ArgumentCaptor.forClass(Home.class);
        when(mockRepo.save(homeCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        HomeTableReturnDTO expectedDTO = new HomeTableReturnDTO("1", "New Home", address, "admin", 0, 0, new ArrayList<>());
        when(homeMapper.mapToHomeTableReturn(any(Home.class))).thenReturn(expectedDTO);

        //WHEN
        HomeTableReturnDTO actual = homeService.createNewHome(createHomeDTO);

        //THEN
        assertEquals(expectedDTO, actual);

        Home savedHome = homeCaptor.getValue();
        assertEquals("1", savedHome.id());
        assertEquals(Role.ADMIN, savedHome.members().get(testUserId));
    }

    @Test
    void editHome_shouldReturnAnUpdatedHome_whenHomeIsEdited() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Address address2 = new Address("2", "street2", "postCode", "Town", "country");
        Home home = new Home("1", "home", address, new HashMap<>());
        String id = "1";
        EditHomeDTO editHomeDTO = new EditHomeDTO("Updated Home", address2, new ArrayList<>(),new ArrayList<>());
        HomeTableReturnDTO expected = new HomeTableReturnDTO("1", "Updated Home", address2, "admin", 0, 0, new ArrayList<>());

        //MOCKING
        when(mockRepo.findById(id)).thenReturn(java.util.Optional.of(home));
        when(mockRepo.save(any(Home.class))).thenReturn(home);
        when(homeMapper.mapToHomeTableReturn(any(Home.class))).thenReturn(expected);

        //
        var actual = homeService.editHome(id, editHomeDTO);

        //THEN
        assertEquals(expected,actual);

    }

    @Test
    void deleteHome_shouldDeleteHome_whenCalled() {
        //GIVEN
        String id = "1";

        //WHEN
        homeService.deleteHome(id);
        //THEN
        Mockito.verify(mockRepo).deleteById(id);

    }

}