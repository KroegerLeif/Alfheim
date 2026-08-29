package conversations

import (
	"context"
	"log/slog"
	"slices"

	"alfheim/chat/internal/shared/llm"
	"alfheim/chat/internal/shared/mcp"
)

// MCPServerLister is the subset of mcpservers.Service this package depends on,
// defined here (the consumer) rather than in the mcpservers package, per this
// monorepo's Go conventions. mcpservers.Service satisfies this interface structurally.
type MCPServerLister interface {
	ListEnabledServers(ctx context.Context) ([]mcp.ServerRef, error)
}

// MCPClientPool is the subset of *mcp.ClientPool this package needs, letting tests
// supply fake mcp.ToolCaller instances instead of dialing a real MCP server.
type MCPClientPool interface {
	Get(endpointURL string) mcp.ToolCaller
}

// buildToolDefinitions discovers tools from every enabled MCP server allowed by
// policy, translates them into the provider-agnostic llm.ToolDefinition format, and
// returns a lookup from tool name back to the server that offers it (for dispatching
// tools/call). Discovery is best-effort per server: a server that is unreachable or
// errors is logged and skipped rather than failing the whole chat turn, so one
// Fach-App being down does not take down tool-calling for every other app.
func buildToolDefinitions(
	ctx context.Context,
	lister MCPServerLister,
	pool MCPClientPool,
	allowedApps []string,
	log *slog.Logger,
) ([]llm.ToolDefinition, map[string]mcp.ServerRef) {
	servers, err := lister.ListEnabledServers(ctx)
	if err != nil {
		log.Warn("failed to list enabled mcp servers; proceeding without tools", slog.String("error", err.Error()))
		return nil, nil
	}

	var defs []llm.ToolDefinition
	toolServer := make(map[string]mcp.ServerRef)

	for _, server := range servers {
		if len(allowedApps) > 0 && !slices.Contains(allowedApps, server.Slug) {
			continue
		}

		client := pool.Get(server.EndpointURL)
		tools, err := client.ListTools(ctx)
		if err != nil {
			log.Warn("failed to list tools from mcp server; skipping",
				slog.String("app_slug", server.Slug), slog.String("error", err.Error()))
			continue
		}

		for _, tool := range tools {
			if existing, ok := toolServer[tool.Name]; ok {
				log.Warn("duplicate mcp tool name across servers; keeping the first registration",
					slog.String("tool_name", tool.Name), slog.String("kept_app_slug", existing.Slug), slog.String("ignored_app_slug", server.Slug))
				continue
			}
			toolServer[tool.Name] = server
			defs = append(defs, llm.ToolDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  tool.InputSchema,
			})
		}
	}

	return defs, toolServer
}
