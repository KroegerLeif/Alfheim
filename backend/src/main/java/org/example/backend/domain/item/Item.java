package org.example.backend.domain.item;

import lombok.With;

@With
public record Item(String id,
                   String name,
                   Category category,
                   EnergyLabel energyLabel,
                   String homeId) {
}
