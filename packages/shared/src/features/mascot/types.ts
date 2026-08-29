import type { AlfiCanonicalState, AlfiState } from '../../assets';

export type { AlfiCanonicalState, AlfiState };

export type AlfiSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface AlfiMascotProps {
  /** The current emotional or functional state of ALFI. Falls back to 'idle' if unmapped. */
  state?: AlfiState;
  /** Size variant or explicit pixel size */
  size?: AlfiSize;
  /** Additional CSS class names */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Whether to render dynamic state animations (glow, bounce, pulse) */
  animated?: boolean;
  /** Whether to show the ambient glow aura halo behind the mascot */
  showHalo?: boolean;
  /** Accessible alt text */
  alt?: string;
}

export interface AlfiAvatarProps {
  /** Mascot / chat status state */
  status?: AlfiState;
  /** Predefined size token */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Whether to display the bottom-right status indicator dot */
  showStatusDot?: boolean;
}

export interface AlfiLifecycleInput {
  /** Whether the user is actively typing a prompt (triggers 'listening' state) */
  isTyping?: boolean;
  /** Whether a prompt has been submitted and waiting for first token (triggers 'thinking' state) */
  isThinking?: boolean;
  /** Whether tokens are actively streaming back (triggers 'speaking' state) */
  isStreaming?: boolean;
  /** Whether an MCP tool or function is actively executing (triggers 'fixing' or 'thinking') */
  isToolCalling?: boolean;
  /** Whether an error occurred during request or stream */
  isError?: boolean;
  /** Optional active tool name (e.g. 'pantry_restock' -> 'eating', 'maintenance_schedule' -> 'fixing') */
  activeTool?: string;
  /** Optional explicit override state */
  customState?: AlfiState;
}
