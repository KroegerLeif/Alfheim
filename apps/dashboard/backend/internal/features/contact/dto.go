package contact

// CreateCategoryRequest defines fields needed to register/update a contact category.
type CreateCategoryRequest struct {
	Name  string `json:"name" binding:"required"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

// CreateContactRequest defines fields needed to register/update a contact.
type CreateContactRequest struct {
	CategoryID  *string  `json:"category_id"`
	Name        string   `json:"name" binding:"required"`
	Phone       string   `json:"phone"`
	Email       string   `json:"email"`
	Address     string   `json:"address"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	Description string   `json:"description"`
	Links       []string `json:"links"`
}
