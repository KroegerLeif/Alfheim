package contact

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/dashboard/internal/features/household"
	"alfheim/dashboard/internal/shared/middleware"
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

// Category handlers
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.CreateCategory(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"only owners and admins can create categories"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to create category"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) GetCategories(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.GetCategories(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to household"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to fetch categories"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	catID := chi.URLParam(r, "catId")

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.UpdateCategory(r.Context(), claims.Subject, householdID, catID, req)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			http.Error(w, `{"error":"not_found","message":"category not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to category"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to update category"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	catID := chi.URLParam(r, "catId")

	err = h.service.DeleteCategory(r.Context(), claims.Subject, householdID, catID)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			http.Error(w, `{"error":"not_found","message":"category not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to category"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to delete category"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "category deleted successfully"})
}

// Contact handlers
func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	var req CreateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.CreateContact(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"only owners, admins, and members can create contacts"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to create contact"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) GetContacts(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.GetContacts(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to household"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to fetch contacts"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	contactID := chi.URLParam(r, "contactId")

	var req CreateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.UpdateContact(r.Context(), claims.Subject, householdID, contactID, req)
	if err != nil {
		if errors.Is(err, ErrContactNotFound) {
			http.Error(w, `{"error":"not_found","message":"contact not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to contact"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to update contact"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) DeleteContact(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	contactID := chi.URLParam(r, "contactId")

	err = h.service.DeleteContact(r.Context(), claims.Subject, householdID, contactID)
	if err != nil {
		if errors.Is(err, ErrContactNotFound) {
			http.Error(w, `{"error":"not_found","message":"contact not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to contact"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to delete contact"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "contact deleted successfully"})
}
