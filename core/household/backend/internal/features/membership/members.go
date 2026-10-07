package membership

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
)

// MemberEntry is one member in the internal member listing.
type MemberEntry struct {
	// UserID is the OIDC subject stored by the household app.
	UserID string `json:"user_id"`
	// AppUserID is the UUID other apps store for this user: the subject itself
	// when it is a UUID, else uuid5(NAMESPACE_DNS, subject). It matches
	// backend_shared.household.derive_user_id.
	AppUserID string `json:"app_user_id"`
	Role      string `json:"role"`
}

// MembersResponse is the body of GET /internal/v1/households/{householdId}/members.
type MembersResponse struct {
	HouseholdID string        `json:"household_id"`
	Members     []MemberEntry `json:"members"`
}

// DeriveAppUserID maps an OIDC subject to the user UUID the other apps store.
func DeriveAppUserID(sub string) string {
	if parsed, err := uuid.Parse(sub); err == nil {
		return parsed.String()
	}
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(sub)).String()
}

// ListMembers handles GET /internal/v1/households/{householdId}/members.
//
// Apps only know the derived user id of other members (see DeriveAppUserID),
// so they cannot use the per-subject membership lookup to validate "is this
// other user a member" (issue #583). This listing returns every member with
// both ids and the role; it carries no profile data.
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	householdID, ok := h.authorizeRequest(w, r)
	if !ok {
		return
	}

	members, err := h.reader.GetMembers(r.Context(), householdID)
	if err != nil {
		h.log.Error("internal member listing failed", slog.String("household_id", householdID), slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, "internal_server_error", "member listing failed")
		return
	}
	// Every household has at least its owner, so no rows means no household.
	if len(members) == 0 {
		writeError(w, http.StatusNotFound, "not_found", "household not found")
		return
	}

	entries := make([]MemberEntry, len(members))
	for i, m := range members {
		entries[i] = MemberEntry{UserID: m.UserID, AppUserID: DeriveAppUserID(m.UserID), Role: string(m.Role)}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(MembersResponse{HouseholdID: householdID, Members: entries})
}
