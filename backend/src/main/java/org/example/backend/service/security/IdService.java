package org.example.backend.service.security;

import org.example.backend.repro.UserRepro;
import org.example.backend.service.security.exception.IdCreationException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class IdService {

    private final UserRepro userRepro;

    public IdService(UserRepro userRepro) {
        this.userRepro = userRepro;
    }

    public String createNewId()throws IdCreationException {
        for(int i = 0; i < 50; i++){
            String id = UUID.randomUUID().toString();
            if(idDoesNotExist(id)){
                return id;
            }
        }
        throw new IdCreationException("To many attempts for creating an unique id");
    }

    private boolean idDoesNotExist(String id) {
        boolean idExist = userRepro.existsById(id);
        if(idExist){
            return false;
        }
        return true;
    }

}
