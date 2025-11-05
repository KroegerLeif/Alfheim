package org.example.backend.domain.user;

import lombok.Builder;

@Builder
public record User(String id,
                   String name) {
}
