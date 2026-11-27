/** Placeholder shown in the snippet when the secret is not in front of the user any more. */
export const SECRET_PLACEHOLDER = '<YOUR_WEBHOOK_SECRET>';

/**
 * The shell script Home Assistant runs to send one signed event. Home Assistant's `rest_command`
 * cannot compute an HMAC, so the command signs with openssl and posts with curl. Event id and type
 * arrive as positional arguments, never spliced into the script, so a template value cannot
 * inject shell code.
 */
const SCRIPT = [
  'ts=$(date +%s);',
  'body=$(printf "{\\"event_id\\":\\"%s\\",\\"event_type\\":\\"%s\\",\\"data\\":{}}" "$1" "$2");',
  'sig=$(printf "%s.%s" "$ts" "$body" | openssl dgst -sha256 -hmac "$3" | sed "s/^.*= //");',
  'curl -fsS -X POST "$4" -H "Content-Type: application/json" -H "X-Alfheim-Webhook-Id: $5"',
  '-H "X-Alfheim-Timestamp: $ts" -H "X-Alfheim-Signature: sha256=$sig" --data-raw "$body"',
].join(' ');

interface SnippetInput {
  /** Absolute URL of the events endpoint. */
  url: string;
  webhookId: string;
  /** The secret while it is shown once, otherwise undefined. */
  secret?: string;
}

/** The `configuration.yaml` block that defines `shell_command.alfheim_event` for Home Assistant. */
export function buildCommandSnippet({ url, webhookId, secret }: SnippetInput): string {
  return [
    'shell_command:',
    '  alfheim_event: >-',
    `    sh -c '${SCRIPT}'`,
    `    alfheim {{ event_id }} {{ event_type }} ${secret || SECRET_PLACEHOLDER} ${url} ${webhookId}`,
    '',
  ].join('\n');
}
