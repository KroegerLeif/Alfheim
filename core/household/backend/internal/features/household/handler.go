package household

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
)

// Handler manages HTTP endpoints for the household domain.
type Handler struct {
	service Service
}

// NewHandler constructs a household HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts household REST endpoints onto a chi router with auth middleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/households", h.CreateHousehold)
		r.Get("/api/v1/households/me", h.GetMyHouseholds)
		r.Get("/api/v1/households/{id}", h.GetHouseholdDetails)
		r.Patch("/api/v1/households/{id}", h.RenameHousehold)
		r.Delete("/api/v1/households/{id}", h.DeleteHousehold)
		r.Post("/api/v1/households/invite", h.CreateInvite)
		r.Post("/api/v1/households/join", h.JoinHousehold)
		r.Get("/api/v1/households/{id}/invites", h.ListInvites)
		r.Delete("/api/v1/households/{id}/invites/{token}", h.RevokeInvite)
		r.Post("/api/v1/households/{id}/transfer-ownership", h.TransferOwnership)
		r.Post("/api/v1/households/{id}/leave", h.LeaveHousehold)
		r.Put("/api/v1/households/{id}/default", h.SetDefaultHousehold)
		r.Put("/api/v1/households/{id}/members/{userID}/role", h.UpdateMemberRole)
		r.Delete("/api/v1/households/{id}/members/{userID}", h.RemoveMember)
		r.Put("/api/v1/households/{id}/address", h.UpdateHouseholdAddress)
	})
}

// writeServiceError maps domain errors to HTTP responses for the endpoints
// added with the household service; fallback is used for unknown errors.
func writeServiceError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, ErrInvalidRole):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "role must be one of OWNER, ADMIN, MEMBER, GUEST")
	case errors.Is(err, ErrInvalidHouseholdName):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "household name must be 1-150 characters")
	case errors.Is(err, ErrInvalidTransferTarget):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "user_id must be another member of the household")
	case errors.Is(err, ErrOwnerCannotLeave):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", ErrOwnerCannotLeave.Error())
	case errors.Is(err, ErrCannotChangeOwnerRole):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", ErrCannotChangeOwnerRole.Error())
	case errors.Is(err, ErrCannotRemoveOwner):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "household owner cannot be removed")
	case errors.Is(err, ErrOwnerRoleNotAssignable):
		httpjson.WriteError(w, http.StatusForbidden, "forbidden", ErrOwnerRoleNotAssignable.Error())
	case errors.Is(err, ErrUnauthorizedHouseholdAccess):
		httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
	case errors.Is(err, ErrHouseholdNotFound):
		httpjson.WriteError(w, http.StatusNotFound, "not_found", "household not found")
	case errors.Is(err, ErrMemberNotFound):
		httpjson.WriteError(w, http.StatusNotFound, "not_found", "member not found")
	case errors.Is(err, ErrInviteNotFound):
		httpjson.WriteError(w, http.StatusNotFound, "not_found", "invite not found")
	default:
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", fallback)
	}
}
