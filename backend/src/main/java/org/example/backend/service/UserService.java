package org.example.backend.service;

import org.example.backend.domain.user.User;
import org.example.backend.repro.UserRepro;
import org.example.backend.service.security.exception.UserNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepro userRepro;

    public UserService(UserRepro userRepro) {
        this.userRepro = userRepro;
    }

    public User getUserById(String id) throws UserNotFoundException {
        return userRepro.findById(id).orElseThrow(()-> new UserNotFoundException("No User with this ID"));
    }

    public void saveUser(User user){
        userRepro.save(user);
    }
}
