package contact

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Handler manages contact and category API requests.
type Handler struct {
	service Service
}

// NewHandler constructs a Contact HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the REST paths for contact categories and contact records.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		// Contact Categories CRUD
		r.Get("/api/v1/households/{id}/contact-categories", h.GetCategories)
		r.Post("/api/v1/households/{id}/contact-categories", h.CreateCategory)
		r.Put("/api/v1/households/{id}/contact-categories/{catId}", h.UpdateCategory)
		r.Delete("/api/v1/households/{id}/contact-categories/{catId}", h.DeleteCategory)

		// Contacts CRUD
		r.Get("/api/v1/households/{id}/contacts", h.GetContacts)
		r.Post("/api/v1/households/{id}/contacts", h.CreateContact)
		r.Put("/api/v1/households/{id}/contacts/{contactId}", h.UpdateContact)
		r.Delete("/api/v1/households/{id}/contacts/{contactId}", h.DeleteContact)
	})
}
