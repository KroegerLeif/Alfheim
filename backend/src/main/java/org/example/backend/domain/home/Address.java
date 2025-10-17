package org.example.backend.domain.home;

public record Address(String id,
                      String street,
                      String postCode,
                      String city,
                      String country) {
}
