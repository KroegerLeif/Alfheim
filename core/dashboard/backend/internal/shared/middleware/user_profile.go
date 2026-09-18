package middleware

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgconn"
)

// placeholderEmailDomain builds a unique, non-routable email for tokens that
// carry no email claim; user_profiles.email is NOT NULL UNIQUE.
const placeholderEmailDomain = "@users.alfheim.invalid"

// ensureUserProfileSQL provisions the minimal local user_profiles row that the
// dashboard's own user_preferences and user_links tables reference by foreign
// key. Existing rows are left untouched: the dashboard does not own profile
// data (core/household does), it only needs the referenced row to exist.
const ensureUserProfileSQL = `
	INSERT INTO user_profiles (id, email, username, first_name, last_name)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (id) DO NOTHING
`

// ProfileDB is the minimal database interface EnsureUserProfile needs.
type ProfileDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// EnsureUserProfile Just-In-Time provisions the authenticated user's
// user_profiles row before any state-changing request, so writes to
// user_preferences and user_links never violate their foreign key. Safe
// methods (GET, HEAD, OPTIONS) skip the database round trip. A failed upsert is
// logged and the request continues; the downstream write then reports its own
// error.
func EnsureUserProfile(db ProfileDB, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}

			claims, err := GetUserClaims(r.Context())
			if err != nil || claims.Subject == "" || db == nil {
				next.ServeHTTP(w, r)
				return
			}

			email := claims.Email
			if email == "" {
				email = claims.Subject + placeholderEmailDomain
			}
			username := claims.PreferredUsername
			if username == "" {
				username = claims.Subject
			}

			if _, err := db.Exec(r.Context(), ensureUserProfileSQL,
				claims.Subject, email, username, claims.GivenName, claims.FamilyName,
			); err != nil {
				log.Warn("failed to provision local user profile",
					slog.String("user_id", claims.Subject),
					slog.String("error", err.Error()))
			}

			next.ServeHTTP(w, r)
		})
	}
}
