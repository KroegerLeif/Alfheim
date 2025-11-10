package org.example.backend.controller;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.oauth2.core.user.OAuth2User;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthControlllerTest {

    private final AuthControlller controller = new AuthControlller();

    @Test
    void getMe_whenLoginAttributePresent_returnsUppercaseLogin() {
        OAuth2User mockUser = mock(OAuth2User.class);
        when(mockUser.getAttribute("login")).thenReturn("githubuser");
        when(mockUser.getAttribute("name")).thenReturn(null);

        String result = controller.getMe(mockUser);

        assertEquals("GITHUBUSER", result);
    }

    @Test
    void getMe_whenLoginAbsentNamePresent_returnsUppercaseName() {
        OAuth2User mockUser = mock(OAuth2User.class);
        when(mockUser.getAttribute("login")).thenReturn(null);
        when(mockUser.getAttribute("name")).thenReturn("Test User");

        String result = controller.getMe(mockUser);

        assertEquals("TEST USER", result);
    }

    @Test
    void getMe_whenBothAttributesAbsent_shouldThrowException() {
        OAuth2User mockUser = mock(OAuth2User.class);
        when(mockUser.getAttribute("login")).thenReturn(null);
        when(mockUser.getAttribute("name")).thenReturn(null);

        NullPointerException exception = assertThrows(NullPointerException.class, () -> {
            controller.getMe(mockUser);
        });

        assertNotNull(exception);
    }
}
