package org.example.backend.service;

import org.example.backend.domain.user.User;
import org.example.backend.repro.UserRepro;
import org.example.backend.service.security.exception.UserNotFoundException;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

public class UserServiceTest {

    @Mock
    private final UserRepro userRepro = Mockito.mock(UserRepro.class);

    private final UserService userService = new UserService(userRepro);


    @Test
    void getUserByID_shouldReturnUser_whenUserExists() {
        //GIVEN
        String id = "1";
        User user = generateUser();
        userRepro.save(user);
        Mockito.when(userRepro.findById(id)).thenReturn(java.util.Optional.of(user));
        //WHEN
        userService.getUserById(id);
        //THEN
        Mockito.verify(userRepro).findById(id);
    }

    @Test
    void getUserByID_shouldThrowUserNotFoundException_whenUserDoesNotExist() throws UserNotFoundException {
        //GIVEN
        String id = "1";
        Mockito.when(userRepro.findById(id)).thenReturn(java.util.Optional.empty());
        try {
            //WHEN
            userService.getUserById(id);
            //THEN
            Mockito.verify(userRepro).findById(id);
        }catch (UserNotFoundException e){
            assert e.getMessage().equals("No User with this ID");
        }
    }

    @Test
    void saveUser_shouldSaveUser_whenCalled() {
        //GIVEN
        User user = generateUser();
        Mockito.when(userRepro.save(user)).thenReturn(user);
        //WHEN
        userService.saveUser(user);
        //THEN
        Mockito.verify(userRepro).save(user);
    }

    private User generateUser(){
        return new User("1","test");
    }
}
