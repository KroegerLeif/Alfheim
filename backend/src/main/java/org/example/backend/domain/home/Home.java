package org.example.backend.domain.home;

import lombok.With;
import org.example.backend.domain.user.Role;

import java.util.Map;

@With
public record Home(String id,
                   String name,
                   Address address,
                   Map<String, Role> members) { // Key: userId, Value: Role
}
