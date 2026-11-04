package datapaths

import (
	"strings"

	"github.com/charmbracelet/huh"
)

// RunForm asks for the data locations and writes the answers into p. It first
// asks whether to use host directories at all, so the default path through the
// wizard keeps named volumes. The rules live in Paths.Validate, so the
// headless path enforces the same ones.
func RunForm(p Paths) error {
	useHost := len(p.Configured()) > 0

	values := make(map[string]*string, len(Classes))
	fields := make([]huh.Field, 0, len(Classes))
	for _, c := range Classes {
		v := p[c.Key]
		values[c.Key] = &v
		fields = append(fields, huh.NewInput().
			Title(c.Title+" directory").
			Description("Absolute host path, or empty for the Docker named volume "+c.VolumeName+".").
			Placeholder("/mnt/alfheim/"+strings.TrimSuffix(c.Flag, "-data-path")).
			Value(values[c.Key]))
	}

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Store data in host directories?").
				Description("No keeps Docker named volumes (the default). Yes lets you put the database, "+
					"object storage and telemetry on their own disks.").
				Value(&useHost),
		),
		huh.NewGroup(fields...).WithHideFunc(func() bool { return !useHost }),
	)
	if err := form.Run(); err != nil {
		return err
	}

	for _, c := range Classes {
		if useHost && strings.TrimSpace(*values[c.Key]) != "" {
			p[c.Key] = strings.TrimSpace(*values[c.Key])
		} else {
			delete(p, c.Key)
		}
	}
	return nil
}
