package org.example.backend.service.mapper.item;

import org.example.backend.domain.item.Category;
import org.springframework.stereotype.Service;

@Service
public class CategoryMapper {

    public Category mapToCategory(String name){
        return new Category(null, name);
    }
}
