package launchers

// allowedIcons are the lucide icon names a launcher may use. The frontend maps
// the same names to lucide-react components
// (core/dashboard/frontend/src/features/launchers/icons.ts); keep both lists equal.
var allowedIcons = map[string]struct{}{
	"book-open": {}, "calendar": {}, "camera": {}, "clapperboard": {}, "cloud": {},
	"cpu": {}, "film": {}, "folder": {}, "gamepad-2": {}, "gauge": {},
	"globe": {}, "headphones": {}, "house": {}, "image": {}, "lightbulb": {},
	"link": {}, "lock": {}, "mail": {}, "music": {}, "network": {},
	"play": {}, "podcast": {}, "printer": {}, "radio": {}, "router": {},
	"server": {}, "shield": {}, "tv": {}, "video": {}, "wifi": {},
}

// DefaultIcon is used when a request names no icon.
const DefaultIcon = "link"

// IconAllowed reports whether name is one of the allowed lucide icon names.
func IconAllowed(name string) bool {
	_, ok := allowedIcons[name]
	return ok
}
