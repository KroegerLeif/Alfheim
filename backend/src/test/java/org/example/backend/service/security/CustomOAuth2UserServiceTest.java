package org.example.backend.service.security;

import org.example.backend.domain.user.User;
import org.example.backend.repro.UserRepro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class CustomOAuth2UserServiceTest {

    @Mock
    private UserRepro userRepo;

    @Mock
    private OAuth2UserRequest userRequest;

    @Mock
    private ClientRegistration clientRegistration;

    @Mock
    private OAuth2User oauthUser;

    private CustomOAuth2UserService service;

    @Captor
    private ArgumentCaptor<User> userArgumentCaptor;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = Mockito.spy(new CustomOAuth2UserService(userRepo));
    }

    @Test
    void loadUser_shouldReturnExistingUser_whenUserAlreadyExists() {
        // GIVEN
        when(oauthUser.getName()).thenReturn("12345");
        when(userRepo.findById("12345"))
                .thenReturn(Optional.of(User.builder().id("12345").name("ExistingTestUser").build()));

        // Mock the call to the super class method
        doReturn(oauthUser).when(service).loadSuperUser(any(OAuth2UserRequest.class));

        // WHEN
        OAuth2User result = service.loadUser(userRequest);

        // THEN
        assertEquals(oauthUser, result);
        verify(userRepo).findById("12345");
        verify(userRepo, never()).save(any());
    }

    @Test
    void loadUser_shouldCreateNewGithubUser_whenUserDoesNotExist() {
        // GIVEN
        when(userRequest.getClientRegistration()).thenReturn(clientRegistration);
        when(clientRegistration.getRegistrationId()).thenReturn("github");

        when(oauthUser.getName()).thenReturn("newUserGithub");
        when(oauthUser.getAttribute("login")).thenReturn("githubUserLogin");
        when(userRepo.findById("newUserGithub")).thenReturn(Optional.empty());
        when(userRepo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // Mock the call to the super class method
        doReturn(oauthUser).when(service).loadSuperUser(any(OAuth2UserRequest.class));

        // WHEN
        service.loadUser(userRequest);

        // THEN
        verify(userRepo).findById("newUserGithub");
        verify(userRepo).save(userArgumentCaptor.capture());
        User savedUser = userArgumentCaptor.getValue();
        assertEquals("newUserGithub", savedUser.id());
        assertEquals("githubUserLogin", savedUser.name());
    }

    @Test
    void loadUser_shouldCreateNewGoogleUser_whenUserDoesNotExist() {
        // GIVEN
        when(userRequest.getClientRegistration()).thenReturn(clientRegistration);
        when(clientRegistration.getRegistrationId()).thenReturn("google");

        when(oauthUser.getName()).thenReturn("newUserGoogle");
        when(oauthUser.getAttribute("name")).thenReturn("googleUserName");
        when(userRepo.findById("newUserGoogle")).thenReturn(Optional.empty());
        when(userRepo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // Mock the call to the super class method
        doReturn(oauthUser).when(service).loadSuperUser(any(OAuth2UserRequest.class));

        // WHEN
        service.loadUser(userRequest);

        // THEN
        verify(userRepo).findById("newUserGoogle");
        verify(userRepo).save(userArgumentCaptor.capture());
        User savedUser = userArgumentCaptor.getValue();
        assertEquals("newUserGoogle", savedUser.id());
        assertEquals("googleUserName", savedUser.name());
    }
}
