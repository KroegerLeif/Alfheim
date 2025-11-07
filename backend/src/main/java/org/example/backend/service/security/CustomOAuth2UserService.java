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
        OAuth2User oauthUser = loadOAuth2User(userRequest);

        User appUser = userRepo.findById(oauthUser.getName())
                .orElseGet(() -> createAndSaveUser(oauthUser));

        return oauthUser;
    }

    protected OAuth2User loadOAuth2User(OAuth2UserRequest request) {
        return super.loadUser(request);
    }

    private User createAndSaveUser(OAuth2User oauthUser) {
        User newUser = User.builder()
                .id(oauthUser.getName())
                .name(oauthUser.getAttribute("login"))
                .build();

        return userRepo.save(newUser);
    }
}
