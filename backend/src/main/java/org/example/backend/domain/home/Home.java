package org.example.backend.domain.home;

import lombok.With;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.user.Role;
import org.example.backend.domain.user.User;

import java.util.List;
import java.util.Map;

@With
public record Home(String id,
                   String name,
                   Address address,
                   List<String> items,
                   List<String> taskSeries,
                   Map<User, Role> members) {
}
