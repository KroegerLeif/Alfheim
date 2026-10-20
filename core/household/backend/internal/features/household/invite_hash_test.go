package household

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestRepository_InviteTokenIsStoredHashed(t *testing.T) {
	var args []any
	repo := newRepositoryWithDB(&mockDBTX{
		execFunc: func(ctx context.Context, sql string, a ...any) (pgconn.CommandTag, error) {
			args = a
			return pgconn.NewCommandTag("INSERT 0 1"), nil
		},
	})

	inv := &Invite{Token: "plain-secret", Role: RoleMember}
	if err := repo.CreateInvite(context.Background(), inv); err != nil {
		t.Fatal(err)
	}
	want := hashInviteToken("plain-secret")
	if len(want) != 64 || want == "plain-secret" {
		t.Fatalf("unexpected hash %q", want)
	}
	for _, a := range args {
		if a == "plain-secret" {
			t.Fatal("plaintext token must never be bound to the INSERT")
		}
	}
	if args[0] != want || inv.ID != want {
		t.Errorf("expected hash %q as stored id, got arg %v / ID %q", want, args[0], inv.ID)
	}
	if inv.Token != "plain-secret" {
		t.Error("plaintext token must stay on the created invite so it can be returned once")
	}
}
