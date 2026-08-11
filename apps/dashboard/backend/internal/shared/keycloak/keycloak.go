// Package keycloak encapsulates integration with Keycloak Admin API via gocloak/v13.
package keycloak

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Nerzal/gocloak/v13"
	"alfheim/dashboard/config"
)

// Client wraps the gocloak client and manages service-account admin tokens.
type Client struct {
	Gocloak      *gocloak.GoCloak
	cfg          config.KeycloakConfig
	log          *slog.Logger
	token        *gocloak.JWT
	tokenMu      sync.RWMutex
	tokenExpires time.Time
}

// NewClient initializes the Keycloak admin client.
func NewClient(cfg config.KeycloakConfig, log *slog.Logger) *Client {
	gc := gocloak.NewClient(cfg.BaseURL)
	return &Client{
		Gocloak: gc,
		cfg:     cfg,
		log:     log,
	}
}

// GetAdminToken obtains or refreshes the service account JWT token for Keycloak Admin API requests.
func (c *Client) GetAdminToken(ctx context.Context) (string, error) {
	c.tokenMu.RLock()
	if c.token != nil && time.Now().Before(c.tokenExpires) {
		accessToken := c.token.AccessToken
		c.tokenMu.RUnlock()
		return accessToken, nil
	}
	c.tokenMu.RUnlock()

	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	// Double check after acquiring write lock
	if c.token != nil && time.Now().Before(c.tokenExpires) {
		return c.token.AccessToken, nil
	}

	token, err := c.Gocloak.LoginClient(ctx, c.cfg.ClientID, c.cfg.ClientSecret, c.cfg.Realm)
	if err != nil {
		return "", fmt.Errorf("failed to login keycloak service account client: %w", err)
	}

	// Buffer token expiry by 30 seconds
	expiresIn := time.Duration(token.ExpiresIn)*time.Second - (30 * time.Second)
	c.token = token
	c.tokenExpires = time.Now().Add(expiresIn)

	c.log.Debug("refreshed keycloak service account admin token")
	return token.AccessToken, nil
}

// GetUserByID fetches a user's Keycloak profile representation by user UUID.
func (c *Client) GetUserByID(ctx context.Context, userID string) (*gocloak.User, error) {
	token, err := c.GetAdminToken(ctx)
	if err != nil {
		return nil, err
	}

	user, err := c.Gocloak.GetUserByID(ctx, token, c.cfg.Realm, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user %s from keycloak: %w", userID, err)
	}

	return user, nil
}

// UpdateUser updates user profile attributes in Keycloak using the Admin API.
func (c *Client) UpdateUser(ctx context.Context, user gocloak.User) error {
	token, err := c.GetAdminToken(ctx)
	if err != nil {
		return err
	}

	err = c.Gocloak.UpdateUser(ctx, token, c.cfg.Realm, user)
	if err != nil {
		return fmt.Errorf("failed to update user in keycloak: %w", err)
	}

	c.log.Info("successfully updated user in keycloak admin api", slog.String("user_id", gocloak.PString(user.ID)))
	return nil
}
