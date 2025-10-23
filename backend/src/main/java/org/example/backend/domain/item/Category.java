package org.example.backend.domain.item;

import lombok.With;

@With
public record Category(String id,
                       String name) {
}
