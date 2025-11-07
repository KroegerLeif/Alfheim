package org.example.backend.service.security;

import org.example.backend.domain.user.User;
import org.example.backend.repro.UserRepro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomOAuth2UserServiceTest {

    @Mock
    private UserRepro userRepo;

    @Mock
    private OAuth2UserRequest userRequest;

    @Mock
    private OAuth2User oauthUser;

    private CustomOAuth2UserService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = Mockito.spy(new CustomOAuth2UserService(userRepo));
    }

    @Test
    void loadUser_shouldReturnExistingUser_whenUserAlreadyExists() {
        // given
        when(oauthUser.getName()).thenReturn("12345");
        when(userRepo.findById("12345"))
                .thenReturn(Optional.of(User.builder().id("12345").name("TestUser").build()));

        // 👉 Nur super.loadUser(...) wird ersetzt
        doReturn(oauthUser).when(service).loadOAuth2User(any(OAuth2UserRequest.class));

        // when
        OAuth2User result = service.loadUser(userRequest);

        // then
        assertEquals(oauthUser, result);
        verify(userRepo).findById("12345");
        verify(userRepo, never()).save(any());
    }

    @Test
    void loadUser_shouldCreateNewUser_whenUserDoesNotExist() {
        // given
        when(oauthUser.getName()).thenReturn("newUser");
        when(oauthUser.getAttribute("login")).thenReturn("newUserLogin");
        when(userRepo.findById("newUser")).thenReturn(Optional.empty());
        when(userRepo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        doReturn(oauthUser).when(service).loadOAuth2User(any(OAuth2UserRequest.class));

        // when
        OAuth2User result = service.loadUser(userRequest);

        // then
        assertEquals(oauthUser, result);
        verify(userRepo).findById("newUser");
        verify(userRepo).save(any(User.class));
    }
}
