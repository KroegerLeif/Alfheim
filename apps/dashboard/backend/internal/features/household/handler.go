package household

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"loeger-os/dashboard/internal/shared/middleware"
)

// Handler manages HTTP transport for household endpoints.
type Handler struct {
	service Service
}

// NewHandler initializes household HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers household endpoints with the chi router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/households", h.CreateHousehold)
		r.Get("/api/v1/households/me", h.GetMyHouseholds)
		r.Post("/api/v1/households/{id}/members", h.AddMember)
	})
}

// CreateHousehold handles creating a new household.
func (h *Handler) CreateHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var dto CreateHouseholdDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	created, err := h.service.CreateHousehold(r.Context(), claims.Subject, dto)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to create household"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(ToResponse(created, string(RoleOwner)))
}

// GetMyHouseholds retrieves all households the authenticated user belongs to.
func (h *Handler) GetMyHouseholds(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	list, err := h.service.GetUserHouseholds(r.Context(), claims.Subject)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to fetch households"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

// AddMember adds a user to an existing household.
func (h *Handler) AddMember(w http.ResponseWriter, r *http.Request) {
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

	var dto AddMemberDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.AddMember(r.Context(), claims.Subject, householdID, dto); err != nil {
		http.Error(w, `{"error":"forbidden","message":"failed to add member"}`, http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "member added successfully"})
}
