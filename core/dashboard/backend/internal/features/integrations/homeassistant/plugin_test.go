package homeassistant

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/internal/features/plugins"
)

func cfg(base, settings string) plugins.Config {
	return plugins.Config{BaseURL: base, Settings: json.RawMessage(settings)}
}

func TestValidateConfig(t *testing.T) {
	p := NewPlugin(nil, nil)
	many := make([]string, MaxPinnedEntities+1)
	for i := range many {
		many[i] = fmt.Sprintf(`"sensor.s%d"`, i)
	}
	for name, tc := range map[string]struct {
		cfg   plugins.Config
		field string
	}{
		"ok":         {cfg("http://ha.lan:8123", `{"pinned_entities":["light.kitchen"],"allow_control":true}`), ""},
		"empty":      {cfg("http://ha.lan:8123", ``), ""},
		"no base":    {cfg("", `{}`), "base_url"},
		"unknown":    {cfg("http://ha", `{"household_id":"x"}`), "config"},
		"bad entity": {cfg("http://ha", `{"pinned_entities":["Kitchen Light"]}`), "config.pinned_entities"},
		"duplicate":  {cfg("http://ha", `{"pinned_entities":["light.a","light.a"]}`), "config.pinned_entities"},
		"too many":   {cfg("http://ha", `{"pinned_entities":[`+strings.Join(many, ",")+`]}`), "config.pinned_entities"},
	} {
		err := p.ValidateConfig(tc.cfg)
		var verr *plugins.ValidationError
		switch {
		case tc.field == "" && err != nil:
			t.Errorf("%s: unexpected %v", name, err)
		case tc.field != "" && (!errors.As(err, &verr) || verr.Fields[0].Field != tc.field):
			t.Errorf("%s: want field %s, got %v", name, tc.field, err)
		}
	}
	if p.Type() != "homeassistant" {
		t.Errorf("type %q", p.Type())
	}
}

func TestHealthCheck(t *testing.T) {
	d := newHADouble(t)
	notHA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"message":"hello"}`))
	}))
	defer notHA.Close()
	p := NewPlugin(testClient(), nil)
	ctx := context.Background()
	good := plugins.Credentials{CredentialToken: testToken}

	for name, tc := range map[string]struct {
		base  string
		creds plugins.Credentials
		want  plugins.HealthStatus
	}{
		"ok":          {d.srv.URL, good, plugins.StatusOK},
		"trailing /":  {d.srv.URL + "/", good, plugins.StatusOK},
		"bad token":   {d.srv.URL, plugins.Credentials{CredentialToken: "wrong"}, plugins.StatusAuthFailed},
		"no token":    {d.srv.URL, plugins.Credentials{}, plugins.StatusInvalidConfig},
		"not HA":      {notHA.URL, good, plugins.StatusInvalidResponse},
		"unreachable": {"http://127.0.0.1:1", good, plugins.StatusUnreachable},
		"bad url":     {"http://[::1", good, plugins.StatusUnreachable},
	} {
		h := p.HealthCheck(ctx, cfg(tc.base, `{}`), tc.creds)
		if h.Status != tc.want {
			t.Errorf("%s: want %s, got %+v", name, tc.want, h)
		}
		assertNoToken(t, h.Detail)
	}
}

type fakeBinder struct {
	bound, unbound int
	err            error
}

func (b *fakeBinder) Bind(context.Context, plugins.EnableChange) error {
	b.bound++
	return b.err
}

func (b *fakeBinder) Unbind(context.Context, plugins.EnableChange) error {
	b.unbound++
	return b.err
}

func TestPluginEnabledChanged(t *testing.T) {
	ctx := context.Background()
	if err := NewPlugin(nil, nil).PluginEnabledChanged(ctx, plugins.EnableChange{Enabled: true}); err != nil {
		t.Fatalf("without a principal nothing is bound: %v", err)
	}
	b := &fakeBinder{}
	p := NewPlugin(nil, b)
	if err := p.PluginEnabledChanged(ctx, plugins.EnableChange{Enabled: true}); err != nil || b.bound != 1 {
		t.Fatalf("enable binds: %v %+v", err, b)
	}
	if err := p.PluginEnabledChanged(ctx, plugins.EnableChange{Enabled: false}); err != nil || b.unbound != 1 {
		t.Fatalf("disable unbinds: %v %+v", err, b)
	}
}
