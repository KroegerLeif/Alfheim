package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.Role;
import org.example.backend.repro.HomeRepro;

import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.HomeDoesNotExistException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class HomeService {

    private final HomeRepro homeRepro;
    private final HomeMapper homeMapper;
    private final IdService idService;


    public HomeService(HomeRepro homeRepro, HomeMapper homeMapper, IdService idService) {
        this.homeRepro = homeRepro;
        this.homeMapper = homeMapper;
        this.idService = idService;
    }

    public List<HomeTableReturnDTO> getAllHomes() {
        // TODO: Diese Methode sollte nur die Häuser des aktuellen Benutzers zurückgeben.
        // String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();
        // return homeRepro.findByMembersContainsKey(currentUserId).stream()...
        return homeRepro.findAll().stream() // Vorerst lassen wir es so.
                .map(homeMapper::mapToHomeTableReturn).toList();

    }

    public HomeTableReturnDTO createNewHome(CreateHomeDTO createHomeDTO) {
        // 1. Finde heraus, wer der angemeldete Benutzer ist.
        // Der "Name" der Authentication ist in der Regel die User-ID (z.B. die 'sub' aus dem JWT).
        String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();

        // 2. Erstelle die Mitgliederliste mit dem aktuellen User als ADMIN.
        Map<String, Role> members = Collections.singletonMap(currentUserId, Role.ADMIN);

        // 3. Erstelle das Home-Objekt mit den neuen Informationen.
        Home homeToSave = homeMapper.mapToHome(createHomeDTO)
                .withId(idService.createNewId())
                .withMembers(members);

        Home savedHome = homeRepro.save(homeToSave);
        return homeMapper.mapToHomeTableReturn(savedHome);
    }

    public HomeTableReturnDTO editHome(String id, EditHomeDTO editHomeDTO) throws HomeDoesNotExistException {
        Home home = homeRepro.findById(id).orElseThrow(() ->(new HomeDoesNotExistException("No Home with this ID found")));

        //Changes Values if Change is provided by User
        if(editHomeDTO.name() != null){
            home = home.withName(editHomeDTO.name());
        }

        if(editHomeDTO.address() != null){
            home = home.withAddress(editHomeDTO.address());
        }

        // TODO: Berechtigungsprüfung! Darf der aktuelle User dieses Haus bearbeiten?
        homeRepro.save(home);

        return homeMapper.mapToHomeTableReturn(home);

    }

    public void deleteHome(String id) {
        // TODO: Berechtigungsprüfung! Ist der User Admin dieses Hauses?
        homeRepro.deleteById(id);
        // TODO: Was passiert mit den Items und Tasks, die zu diesem Haus gehörten?
        // itemRepository.deleteAllByHomeId(id);
        // taskSeriesRepository.deleteAllByHomeId(id);
    }

    public List<HomeListReturnDTO> getHomeNames() {
        // TODO: Auch hier nur die Häuser des aktuellen Benutzers anzeigen.
        return homeRepro.findAll().stream()
                .map(homeMapper::mapToHomeListReturn)
                .toList();
    }
}
