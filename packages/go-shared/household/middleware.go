package household

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"alfheim/go-shared/auth"
)

// HouseholdHeader selects the household a request acts in.
const HouseholdHeader = "X-Household-ID"

type contextKey string

// HouseholdContextKey is the context key for the verified HouseholdContext.
const HouseholdContextKey contextKey = "household_context"

// Household error codes, identical to the Python backends' contract.
const (
	CodeHouseholdRequired           = "household_required"
	CodeHouseholdInvalid            = "household_invalid"
	CodeHouseholdForbidden          = "household_forbidden"
	CodeHouseholdServiceUnavailable = "household_service_unavailable"
	CodeHouseholdRoleForbidden      = "household_role_forbidden"
	CodeHouseholdContextMissing     = "household_context_missing"
)

// HouseholdContext is the verified household scope of a request: the caller
// (Subject) is a member of HouseholdID with Role, as confirmed by core/household.
// On a route that opted in with AllowServiceScopes the caller may instead be a
// service principal bound to HouseholdID: Role is RoleService and Scopes lists
// what the binding grants.
type HouseholdContext struct {
	HouseholdID uuid.UUID
	Role        Role
	Subject     string
	Scopes      []string
}

// IsService reports whether the caller is a household-bound service principal.
func (hc *HouseholdContext) IsService() bool {
	return hc.Role == RoleService
}

// RequireHousehold returns a middleware for household-scoped routes. It must run
// after AuthenticateMiddleware. It requires a UUID X-Household-ID header, checks
// the caller's membership against core/household and stores a HouseholdContext in
// the request context. It never fails open: if membership cannot be determined the
// request is rejected with 503. A service principal is rejected with 403 unless
// opts contain AllowServiceScopes and the binding grants every listed scope.
func RequireHousehold(checker Checker, log *slog.Logger, opts ...RequireOption) func(http.Handler) http.Handler {
	cfg := newRequireConfig(opts)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := auth.GetUserClaims(r.Context())
			if err != nil {
				auth.WriteUnauthorized(w, "missing authenticated user context")
				return
			}

			raw := strings.TrimSpace(r.Header.Get(HouseholdHeader))
			if raw == "" {
				writeHouseholdError(w, http.StatusBadRequest, CodeHouseholdRequired, "X-Household-ID header is required")
				return
			}
			householdID, err := uuid.Parse(raw)
			if err != nil || len(raw) != 36 {
				writeHouseholdError(w, http.StatusBadRequest, CodeHouseholdInvalid, "X-Household-ID must be a UUID")
				return
			}

			membership, err := checker.CheckMembership(r.Context(), householdID, claims.Subject)
			switch {
			case err == nil:
			case errors.Is(err, ErrNotMember):
				log.Warn("household access denied: caller is not a member",
					slog.String("household_id", householdID.String()),
					slog.String("user_id", claims.Subject))
				writeHouseholdError(w, http.StatusForbidden, CodeHouseholdForbidden, "user is not a member of the requested household")
				return
			default:
				log.Error("household membership check failed; rejecting request",
					slog.String("household_id", householdID.String()),
					slog.String("error", err.Error()))
				writeHouseholdError(w, http.StatusServiceUnavailable, CodeHouseholdServiceUnavailable, "household membership could not be verified")
				return
			}

			if membership.Role == RoleService && !cfg.admitsService(membership.Scopes) {
				log.Warn("household access denied: service principal not admitted on this route",
					slog.String("household_id", householdID.String()),
					slog.String("user_id", claims.Subject))
				writeHouseholdError(w, http.StatusForbidden, CodeHouseholdForbidden, "service principals may not call this endpoint")
				return
			}

			hc := &HouseholdContext{HouseholdID: householdID, Role: membership.Role, Subject: claims.Subject, Scopes: membership.Scopes}
			ctx := context.WithValue(r.Context(), HouseholdContextKey, hc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetHousehold retrieves the verified HouseholdContext from the request context.
func GetHousehold(ctx context.Context) (*HouseholdContext, error) {
	hc, ok := ctx.Value(HouseholdContextKey).(*HouseholdContext)
	if !ok || hc == nil {
		return nil, errors.New("household context not found in request context")
	}
	return hc, nil
}

// ContextWithHousehold returns ctx carrying hc, as RequireHousehold does. Exposed
// for handler tests that bypass the real middleware.
func ContextWithHousehold(ctx context.Context, hc *HouseholdContext) context.Context {
	return context.WithValue(ctx, HouseholdContextKey, hc)
}

type householdErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteHouseholdError writes the shared household error body
// {"detail": {"code", "message"}}. Handlers use it for role checks
// (CodeHouseholdRoleForbidden) so every household rejection has the same shape.
func WriteHouseholdError(w http.ResponseWriter, status int, code, message string) {
	writeHouseholdError(w, status, code, message)
}

func writeHouseholdError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]householdErrorDetail{"detail": {Code: code, Message: message}})
}
