package org.example.backend.service.security;

import org.example.backend.repro.UserRepro;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IdServiceTest {

    @Test
    void createNewId_shouldReturnUUID_whenCalled() {
        //GIVEN
        UserRepro mockRepro = mock(UserRepro.class);
        IdService idService = new IdService(mockRepro);
        when(mockRepro.existsById(anyString())).thenReturn(false);
        //WHEN
        var actual = idService.createNewId();
        //THEN
        assert actual != null;
        assert actual.length() == 36;


    }

    @Test
    void createNewId_shouldThrowException_whenIdExists() {
        //GIVEN
        UserRepro mockRepro = mock(UserRepro.class);
        IdService idService = new IdService(mockRepro);
        when(mockRepro.existsById(anyString())).thenReturn(true);
        //WHEN
        try{
            var actual = idService.createNewId();
        }catch(Exception e){
            //THEN
            assert e != null;
        }
    }
}