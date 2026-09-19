package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/householdclient"
)

// HouseholdHeader selects the household a request acts in.
const HouseholdHeader = "X-Household-ID"

// HouseholdContextKey is the context key for the verified HouseholdContext.
const HouseholdContextKey contextKey = "household_context"

// Household error codes, identical to the Python backends' contract.
const (
	CodeHouseholdRequired           = "household_required"
	CodeHouseholdInvalid            = "household_invalid"
	CodeHouseholdForbidden          = "household_forbidden"
	CodeHouseholdServiceUnavailable = "household_service_unavailable"
)

// HouseholdContext is the verified household scope of a request: the caller
// (Subject) is a member of HouseholdID with Role, as confirmed by core/household.
type HouseholdContext struct {
	HouseholdID uuid.UUID
	Role        householdclient.Role
	Subject     string
}

// RequireHousehold returns a middleware for household-scoped routes. It must run
// after AuthenticateMiddleware. It requires a UUID X-Household-ID header, checks
// the caller's membership against core/household and stores a HouseholdContext in
// the request context. It never fails open: if membership cannot be determined the
// request is rejected with 503.
func RequireHousehold(checker householdclient.Checker, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := GetUserClaims(r.Context())
			if err != nil {
				writeUnauthorized(w, "missing authenticated user context")
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
			case errors.Is(err, householdclient.ErrNotMember):
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

			hc := &HouseholdContext{HouseholdID: householdID, Role: membership.Role, Subject: claims.Subject}
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

// Chain composes middlewares so that the first one listed runs first.
func Chain(mws ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		for i := len(mws) - 1; i >= 0; i-- {
			next = mws[i](next)
		}
		return next
	}
}

type householdErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeHouseholdError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]householdErrorDetail{"detail": {Code: code, Message: message}})
}
