// Package membership exposes the internal, service-to-service membership API
// that other Alfheim backends use to authorize household-scoped requests.
//
// It is never routed by the Caddy gateway and uses a shared bearer token
// (ALFHEIM_INTERNAL_TOKEN) instead of an end-user JWT.
package membership

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/household/internal/features/household"
	"alfheim/household/internal/features/servicebindings"
)

// Reader resolves memberships of a household (satisfied by household.Repository).
type Reader interface {
	GetMemberRole(ctx context.Context, householdID string, userID string) (household.HouseholdRole, error)
	GetMembers(ctx context.Context, householdID string) ([]*household.Member, error)
}

// ServiceResolver resolves household-bound service principals (#958);
// satisfied by *servicebindings.Service. It returns servicebindings.ErrNotFound
// when the subject has no binding to the household.
type ServiceResolver interface {
	Resolve(ctx context.Context, householdID, principalID string) (servicebindings.Binding, error)
}

// RoleService is the role reported for a bound service principal. It is never
// stored in household_members.
const RoleService = "SERVICE"

// Response is the body of a successful membership lookup. Scopes is set only
// for role SERVICE.
type Response struct {
	HouseholdID string   `json:"household_id"`
	UserID      string   `json:"user_id"`
	Role        string   `json:"role"`
	Scopes      []string `json:"scopes,omitempty"`
}

// Handler serves the internal membership API:
//
//	GET /internal/v1/memberships/{householdId}/{userSub}
//	GET /internal/v1/households/{householdId}/members
type Handler struct {
	reader    Reader
	services  ServiceResolver
	tokenHash [32]byte
	enabled   bool
	log       *slog.Logger
}

// Option customizes the Handler.
type Option func(*Handler)

// WithServiceBindings lets GetMembership answer for bound service principals
// with role SERVICE and their scopes. Without it only members are resolved.
func WithServiceBindings(resolver ServiceResolver) Option {
	return func(h *Handler) { h.services = resolver }
}

// NewHandler builds the internal API handler. An empty token disables the API:
// every request is answered with 503 and a warning is logged once at startup.
func NewHandler(reader Reader, internalToken string, log *slog.Logger, opts ...Option) *Handler {
	h := &Handler{reader: reader, log: log, enabled: internalToken != ""}
	for _, opt := range opts {
		opt(h)
	}
	if h.enabled {
		h.tokenHash = sha256.Sum256([]byte(internalToken))
	} else {
		log.Warn("ALFHEIM_INTERNAL_TOKEN is not set; internal membership API will answer 503")
	}
	return h
}

// RegisterRoutes mounts the internal API. It deliberately bypasses the OIDC middleware.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/internal/v1/memberships/{householdId}/{userSub}", h.GetMembership)
	r.Get("/internal/v1/households/{householdId}/members", h.ListMembers)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": message})
}

// authorized compares the presented bearer token with the configured one in
// constant time (hashing first so length differences do not leak either).
func (h *Handler) authorized(r *http.Request) bool {
	const prefix = "bearer "
	header := r.Header.Get("Authorization")
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return false
	}
	presented := sha256.Sum256([]byte(strings.TrimSpace(header[len(prefix):])))
	return subtle.ConstantTimeCompare(presented[:], h.tokenHash[:]) == 1
}

// authorizeRequest enforces the internal token and returns the normalized
// household id from the path. It writes the error response and returns false
// when the request must not proceed. The token is checked before any input.
func (h *Handler) authorizeRequest(w http.ResponseWriter, r *http.Request) (string, bool) {
	if !h.enabled {
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "internal membership API is not configured")
		return "", false
	}
	if !h.authorized(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or missing internal token")
		return "", false
	}
	parsed, err := uuid.Parse(chi.URLParam(r, "householdId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "household id must be a UUID")
		return "", false
	}
	return parsed.String(), true
}

// GetMembership handles GET /internal/v1/memberships/{householdId}/{userSub}.
func (h *Handler) GetMembership(w http.ResponseWriter, r *http.Request) {
	householdID, ok := h.authorizeRequest(w, r)
	if !ok {
		return
	}
	userSub := chi.URLParam(r, "userSub")
	if userSub == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "missing user subject")
		return
	}

	role, err := h.reader.GetMemberRole(r.Context(), householdID, userSub)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			h.answerService(w, r, householdID, userSub)
			return
		}
		h.log.Error("internal membership lookup failed", slog.String("household_id", householdID), slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, "internal_server_error", "membership lookup failed")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(Response{HouseholdID: householdID, UserID: userSub, Role: string(role)})
}

// answerService answers a lookup for a subject that is not a member: role
// SERVICE when it is a service principal bound to the household, else 404.
// Nothing is cached here, so a revoked binding is gone on the next lookup.
func (h *Handler) answerService(w http.ResponseWriter, r *http.Request, householdID, userSub string) {
	if h.services == nil {
		writeError(w, http.StatusNotFound, "not_found", "user is not a member of this household")
		return
	}
	binding, err := h.services.Resolve(r.Context(), householdID, userSub)
	if errors.Is(err, servicebindings.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "user is not a member of this household")
		return
	}
	if err != nil {
		h.log.Error("internal service binding lookup failed", slog.String("household_id", householdID), slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, "internal_server_error", "membership lookup failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(Response{HouseholdID: householdID, UserID: userSub, Role: RoleService, Scopes: binding.Scopes})
}
