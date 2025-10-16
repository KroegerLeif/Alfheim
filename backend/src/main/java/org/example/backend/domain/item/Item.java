package org.example.backend.domain.item;

public record Item(String id,
                   String name,
                   Category category,
                   EnergyLabel energyLabel) {
}
