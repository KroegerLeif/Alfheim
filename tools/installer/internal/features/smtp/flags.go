package smtp

import (
	"flag"
	"os"
)

// RegisterFlags adds the SMTP flags to fs, writing into s. The password has
// no flag on purpose: a flag value is visible to every local user in the
// process list, so it is read from the environment (ALFHEIM_SMTP_PASSWORD)
// or .env only.
func RegisterFlags(fs *flag.FlagSet, s *Settings) {
	fs.StringVar(&s.Host, "smtp-host", "", "SMTP server host name for Zitadel's e-mail")
	fs.StringVar(&s.Port, "smtp-port", "", "SMTP server port (default "+DefaultPort+")")
	fs.StringVar(&s.User, "smtp-user", "", "SMTP user name")
	fs.StringVar(&s.SenderAddress, "smtp-sender-address", "", "From address of Zitadel's e-mail")
	fs.StringVar(&s.SenderName, "smtp-sender-name", "", "From name of Zitadel's e-mail (default "+DefaultSenderName+")")
	fs.StringVar(&s.TLS, "smtp-tls", "", "use TLS or STARTTLS: true or false (default "+DefaultTLS+")")
}

// ApplyEnv fills every value still empty from the process environment
// (lookup is os.Getenv in production).
func (s *Settings) ApplyEnv(lookup func(string) string) {
	if lookup == nil {
		lookup = os.Getenv
	}
	env := map[string]string{}
	for key := range s.fields() {
		env[key] = lookup(key)
	}
	*s = s.Merge(FromEnv(env))
}
