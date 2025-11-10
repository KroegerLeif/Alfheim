package org.example.backend.service.security;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.user.User;
import org.example.backend.repro.UserRepro;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepro userRepo;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        // Use the protected method to allow mocking
        OAuth2User oauthUser = loadSuperUser(userRequest);

        userRepo.findById(oauthUser.getName())
                .orElseGet(() -> createAndSaveUser(userRequest, oauthUser));

        return oauthUser;
    }

    /**
     * Protected method to delegate to the parent class.
     * This allows for mocking in tests.
     */
    protected OAuth2User loadSuperUser(OAuth2UserRequest userRequest) {
        return super.loadUser(userRequest);
    }

    private User createAndSaveUser(OAuth2UserRequest userRequest, OAuth2User oauthUser) {
        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        User newUser = switch (registrationId) {
            case "google" -> createGoogleUser(oauthUser);
            case "github" -> createGithubUser(oauthUser);
            default -> throw new IllegalArgumentException("Unknown OAuth2 provider: " + registrationId);
        };

        return userRepo.save(newUser);
    }

    private User createGoogleUser(OAuth2User oauthUser) {
        return User.builder()
                .id(oauthUser.getName()) // This is the 'sub' claim
                .name(oauthUser.getAttribute("name"))
                .build();
    }

    private User createGithubUser(OAuth2User oauthUser) {
        return User.builder()
                .id(oauthUser.getName()) // This is the 'id' attribute
                .name(oauthUser.getAttribute("login"))
                .build();
    }
}
